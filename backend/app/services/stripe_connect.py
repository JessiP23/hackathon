"""Stripe Connect — Express accounts, Account Links (no raw PAN on connected accounts)."""
from __future__ import annotations

import os
from typing import Any, Literal

try:
    import stripe

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    STRIPE_OK = bool(stripe.api_key)
except ImportError:
    STRIPE_OK = False
    stripe = None  # type: ignore

ConnectOnboardErrorKind = Literal["connect_signup_required", "generic"]


def classify_connect_account_creation_error(exc: BaseException) -> ConnectOnboardErrorKind:
    """
    Stripe returns a specific phrase when the platform account has not completed Connect
    registration. Do not match loosely on \"connect\" + \"dashboard\" — many unrelated errors
    include those substrings and would mislead operators.
    """
    t = str(exc).lower()
    if "signed up for connect" in t:
        return "connect_signup_required"
    if "you can only create new accounts if you've signed" in t:
        return "connect_signup_required"
    return "generic"


def log_stripe_exception(prefix: str, exc: BaseException) -> None:
    """Best-effort structured log for StripeError and fallbacks."""
    code = getattr(exc, "code", None)
    rid = getattr(exc, "request_id", None)
    http = getattr(exc, "http_status", None)
    print(f"[{prefix}] Stripe error code={code} http_status={http} request_id={rid}: {exc!r}", flush=True)


def _account_return_and_refresh_urls() -> tuple[str, str]:
    """HTTPS URLs Stripe redirects to after onboarding / when link needs refresh."""
    api = os.getenv("BACKEND_PUBLIC_URL", "").strip().rstrip("/")
    web = os.getenv("FRONTEND_URL", "http://localhost:3000").strip().rstrip("/")
    base = api or web
    print(f"[Stripe Connect] AccountLink redirect base: {base}", flush=True)
    return (
        f"{base}/stripe/connect/return",
        f"{base}/stripe/connect/refresh",
    )


def vendor_stall_public_url(vendor_id: str) -> str:
    """Public stall page on InfraStreet — satisfies Stripe business_profile.url for vendors without their own site."""
    front = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if not front:
        front = os.getenv("BACKEND_PUBLIC_URL", "").strip().rstrip("/")
    if not front:
        front = "https://example.com"
    return f"{front}/vendor/{vendor_id}"


def ensure_vendor_connect_business_profile(account_id: str, vendor_id: str) -> None:
    """
    Vendors only use Telegram — they do not have a personal marketing site.
    Stripe still requires a business_url-like field; we use their InfraStreet vendor page.
    """
    if not STRIPE_OK or stripe is None:
        return
    stall = vendor_stall_public_url(vendor_id)
    try:
        stripe.Account.modify(
            account_id,
            business_type="individual",
            business_profile={
                "url": stall,
                "mcc": "5812",
                "product_description": "Pickup food sales via InfraStreet marketplace stall.",
            },
        )
    except Exception as e:
        log_stripe_exception("StripeConnect.ensure_vendor_profile", e)


def create_express_account(vendor_id: str) -> str:
    """Create a new Connect Express connected account; returns acct_ id. Caller persists to DB."""
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")
    stall = vendor_stall_public_url(vendor_id)
    account = stripe.Account.create(
        type="express",
        country="US",
        business_type="individual",
        business_profile={
            "url": stall,
            "mcc": "5812",
            "product_description": "Pickup food sales via InfraStreet marketplace stall.",
        },
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        settings={
            "payouts": {
                "schedule": {"interval": "manual"},
                "debit_negative_balances": False,
            }
        },
        metadata={"infrastreet_vendor_id": vendor_id},
    )
    return account.id


def create_onboarding_account_link(account_id: str, vendor_id: str | None = None) -> str:
    """Hosted Stripe onboarding (bank / KYC). Telegram vendors open this in a browser."""
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")
    if vendor_id:
        ensure_vendor_connect_business_profile(account_id, vendor_id)
    ret, ref = _account_return_and_refresh_urls()
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=ref,
        return_url=ret,
        type="account_onboarding",
    )
    return link.url


def create_account_update_link(account_id: str, vendor_id: str | None = None) -> str:
    """For active vendors updating payout details."""
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")
    if vendor_id:
        ensure_vendor_connect_business_profile(account_id, vendor_id)
    ret, ref = _account_return_and_refresh_urls()
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=ref,
        return_url=ret,
        type="account_update",
    )
    return link.url


def _account_to_dict(account: Any) -> dict:
    if isinstance(account, dict):
        return account
    if hasattr(account, "to_dict"):
        return account.to_dict()
    try:
        return dict(account)
    except Exception:
        return {}


def payouts_ready(account: Any) -> bool:
    """True when Stripe allows payouts on this connected account."""
    d = _account_to_dict(account)
    return bool(d.get("payouts_enabled"))


def connect_requirements_summary(account: Any, max_fields: int = 12) -> str:
    """Short hint for Telegram when payouts_enabled is still false."""
    d = _account_to_dict(account)
    bits = [
        f"payouts_enabled={d.get('payouts_enabled')}",
        f"details_submitted={d.get('details_submitted')}",
    ]
    req = d.get("requirements") or {}
    due = list(req.get("currently_due") or [])
    past = list(req.get("past_due") or [])
    dr = req.get("disabled_reason")
    if dr:
        bits.append(f"disabled_reason={dr}")
    combined = due or past
    if combined:
        show = combined[:max_fields]
        tail = f" (+{len(combined) - len(show)} more)" if len(combined) > len(show) else ""
        bits.append("Stripe still wants: " + ", ".join(show) + tail)
    elif not d.get("details_submitted"):
        bits.append("Finish every screen in the Stripe window (back arrow if something was skipped).")
    return "\n".join(bits)


def external_account_last4(account: Any) -> str | None:
    d = _account_to_dict(account)
    ext = d.get("external_accounts") or {}
    for ea in ext.get("data") or []:
        if isinstance(ea, dict) and ea.get("last4"):
            return str(ea["last4"])
    return None


def retrieve_account(account_id: str) -> Any:
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")
    return stripe.Account.retrieve(account_id)


def derive_account_status(account: Any) -> str:
    """Classify connected account without an extra API round-trip."""
    d = _account_to_dict(account)
    if d.get("charges_enabled") and d.get("payouts_enabled"):
        return "active"
    req = d.get("requirements") or {}
    if req.get("disabled_reason"):
        return "restricted"
    return "pending"


def release_payout_to_vendor(
    vendor_stripe_account_id: str,
    net_amount_cents: int,
    order_id: str,
    vendor_id: str,
) -> str:
    """
    Transfer from platform balance to the connected account (when funds are on the platform).
    Used for customer no-show when a separate transfer is required; many flows use destination
    charges instead (see fulfillment_service).
    """
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")

    transfer = stripe.Transfer.create(
        amount=int(net_amount_cents),
        currency="usd",
        destination=vendor_stripe_account_id,
        metadata={
            "infrastreet_order_id": order_id,
            "infrastreet_vendor_id": vendor_id,
        },
    )
    return transfer.id


def get_connect_account_status(stripe_account_id: str) -> str:
    """Return 'active' | 'restricted' | 'pending'."""
    if not STRIPE_OK or stripe is None:
        return "pending"
    account = stripe.Account.retrieve(stripe_account_id)
    d = _account_to_dict(account)
    if d.get("charges_enabled") and d.get("payouts_enabled"):
        return "active"
    req = d.get("requirements") or {}
    if req.get("disabled_reason"):
        return "restricted"
    return "pending"

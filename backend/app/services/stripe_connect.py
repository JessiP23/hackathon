"""Stripe Connect — Express accounts and payouts (InfraStreet)."""
from __future__ import annotations

import os

try:
    import stripe

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    STRIPE_OK = bool(stripe.api_key)
except ImportError:
    STRIPE_OK = False
    stripe = None  # type: ignore


def create_vendor_connect_account(vendor_id: str, debit_card_number: str) -> dict:
    """
    Create a Connect Express account and attach a debit card for payouts.
    In production, tokenize with Stripe.js; in test mode raw test card numbers work.
    """
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")

    digits = debit_card_number.replace(" ", "").replace("-", "")
    account = stripe.Account.create(
        type="express",
        country="US",
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

    stripe.Account.create_external_account(
        account.id,
        external_account={
            "object": "card",
            "number": digits,
            "exp_month": 12,
            "exp_year": 2028,
            "currency": "usd",
        },
    )

    last4 = digits[-4:] if len(digits) >= 4 else ""
    return {
        "stripe_account_id": account.id,
        "stripe_account_status": "active",
        "payout_enabled": True,
        "stripe_debit_card_last4": last4,
    }


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
    if getattr(account, "charges_enabled", False) and getattr(account, "payouts_enabled", False):
        return "active"
    req = getattr(account, "requirements", None)
    if req and getattr(req, "disabled_reason", None):
        return "restricted"
    return "pending"

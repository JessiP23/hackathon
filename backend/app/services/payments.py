"""PaymentIntents with manual capture and Connect destination charges."""
from __future__ import annotations

import os
import secrets
import string

from app.billing import service_fee_rate

try:
    import stripe

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    STRIPE_OK = bool(stripe.api_key)
except ImportError:
    STRIPE_OK = False
    stripe = None  # type: ignore


PLATFORM_FEE_RATE = service_fee_rate()


def generate_qr_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "IS-" + "".join(secrets.choice(alphabet) for _ in range(8))


def create_deal_payment_intent(
    amount_cents: int,
    customer_stripe_customer_id: str,
    vendor_stripe_account_id: str,
    order_id: str,
    vendor_id: str,
    customer_id: str | None,
    trust_level: int = 0,
) -> dict:
    if trust_level >= 3:
        raise ValueError("Customer account is blocked from making reservations.")

    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")

    platform_fee_cents = int(round(amount_cents * PLATFORM_FEE_RATE))
    platform_fee_cents = min(platform_fee_cents, amount_cents - 50) if amount_cents > 50 else 0
    capture_method = "automatic" if trust_level >= 2 else "manual"

    meta = {
        "infrastreet_order_id": order_id,
        "infrastreet_vendor_id": vendor_id,
        "infrastreet_customer_id": customer_id or "",
    }

    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        customer=customer_stripe_customer_id,
        capture_method=capture_method,
        application_fee_amount=platform_fee_cents,
        transfer_data={"destination": vendor_stripe_account_id},
        automatic_payment_methods={"enabled": True},
        metadata=meta,
        description=f"InfraStreet order {order_id}",
    )

    return {
        "client_secret": intent.client_secret,
        "payment_intent_id": intent.id,
        "capture_method": capture_method,
        "platform_fee_cents": platform_fee_cents,
        "net_amount_cents": amount_cents - platform_fee_cents,
    }


def capture_payment_intent(payment_intent_id: str) -> bool:
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")
    intent = stripe.PaymentIntent.capture(payment_intent_id)
    return intent.status == "succeeded"


def cancel_payment_intent(payment_intent_id: str, reason: str = "vendor_cancelled") -> bool:
    if not STRIPE_OK or stripe is None:
        raise RuntimeError("Stripe is not configured")
    cr = (
        "abandoned"
        if reason == "customer_no_show_vendor_not_ready"
        else "requested_by_customer"
    )
    intent = stripe.PaymentIntent.cancel(payment_intent_id, cancellation_reason=cr)
    return intent.status == "canceled"

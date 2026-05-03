"""
Stripe service — Checkout session creation, webhook handling, and refunds.
"""
import os
import json
from datetime import datetime, timedelta, timezone

try:
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_OK = bool(stripe.api_key)
except ImportError:
    STRIPE_OK = False

from app.billing import service_fee_rate

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class StripeService:
    def create_checkout_session(
        self,
        order_id: str,
        vendor_id: str,
        item_name: str,
        quantity: int,
        vendor_price: float,
        points_discount: float = 0.0,
        deal_id: str | None = None,
    ) -> dict:
        """Create a Stripe Checkout session. Returns {checkout_url, session_id}.

        For flash deals pass ``deal_id``; for regular menu orders omit it (cancel returns to vendor page).
        """
        if not STRIPE_OK:
            return {"checkout_url": None, "session_id": None, "error": "Stripe not configured"}

        service_fee = round(vendor_price * service_fee_rate(), 2)
        raw_total = round(vendor_price + service_fee - max(0.0, float(points_discount or 0)), 2)
        customer_total = max(0.5, raw_total)

        if deal_id:
            cancel_url = f"{FRONTEND_URL}/deals?deal={deal_id}"
        else:
            cancel_url = f"{FRONTEND_URL}/vendor/{vendor_id}"

        display_qty = max(1, int(quantity or 1))
        product_label = f"{item_name} x{display_qty}" if display_qty != 1 else item_name

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": product_label[:120],
                        },
                        "unit_amount": int(customer_total * 100),
                    },
                    "quantity": 1,
                },
            ],
            mode="payment",
            success_url=f"{FRONTEND_URL}/orders/{order_id}/confirmed",
            cancel_url=cancel_url,
            expires_at=int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp()),
            metadata={
                "order_id": order_id,
                "vendor_id": vendor_id,
                "deal_id": deal_id or "",
                "service_fee": str(service_fee),
            },
        )
        return {"checkout_url": session.url, "session_id": session.id}

    def verify_webhook(self, payload: bytes, sig_header: str):
        """Verify Stripe webhook signature and return event dict, or None on failure."""
        if not STRIPE_OK or not STRIPE_WEBHOOK_SECRET:
            try:
                return json.loads(payload)
            except Exception:
                return None
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
            return event
        except Exception as e:
            print(f"[Stripe] Webhook verification failed: {e}")
            return None

    def get_payment_receipt_url(self, payment_intent_id: str) -> str | None:
        """Stripe-hosted receipt URL for the charge (live + test; may be null if unavailable)."""
        if not STRIPE_OK or not payment_intent_id:
            return None
        try:
            pi = stripe.PaymentIntent.retrieve(
                payment_intent_id,
                expand=["latest_charge"],
            )
            ch = pi.latest_charge
            if ch is None:
                return None
            if isinstance(ch, str):
                ch_obj = stripe.Charge.retrieve(ch)
            else:
                ch_obj = ch
            url = getattr(ch_obj, "receipt_url", None)
            return str(url) if url else None
        except Exception as e:
            print(f"[Stripe] receipt_url: {e}")
            return None

    def refund_payment_intent(self, payment_intent_id: str) -> dict:
        """Issue a full refund for a payment intent."""
        if not STRIPE_OK:
            return {"refunded": False, "error": "Stripe not configured"}
        try:
            refund = stripe.Refund.create(payment_intent=payment_intent_id)
            return {"refunded": True, "refund_id": refund.id}
        except Exception as e:
            print(f"[Stripe] Refund error: {e}")
            return {"refunded": False, "error": str(e)}


stripe_service = StripeService()

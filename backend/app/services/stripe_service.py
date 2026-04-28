"""
Stripe service — Checkout session creation, webhook handling, and refunds.
"""
import os
import json

try:
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_OK = bool(stripe.api_key)
except ImportError:
    STRIPE_OK = False

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
SERVICE_FEE_RATE = 0.13
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class StripeService:
    def create_checkout_session(
        self,
        order_id: str,
        deal_id: str,
        vendor_id: str,
        item_name: str,
        quantity: int,
        vendor_price: float,
    ) -> dict:
        """Create a Stripe Checkout session. Returns {checkout_url, session_id}."""
        if not STRIPE_OK:
            return {"checkout_url": None, "session_id": None, "error": "Stripe not configured"}

        service_fee = round(vendor_price * SERVICE_FEE_RATE, 2)
        customer_total = round(vendor_price + service_fee, 2)

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"{item_name} x{quantity}",
                        },
                        "unit_amount": int(vendor_price * 100),
                    },
                    "quantity": quantity,
                },
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "Service fee"},
                        "unit_amount": int(service_fee * 100),
                    },
                    "quantity": 1,
                },
            ],
            mode="payment",
            success_url=f"{FRONTEND_URL}/order/{order_id}/confirmed",
            cancel_url=f"{FRONTEND_URL}/deal/{deal_id}",
            metadata={
                "order_id": order_id,
                "vendor_id": vendor_id,
                "deal_id": deal_id,
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

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


def _checkout_session_metadata(sess) -> dict:
    """Avoid dict() on StripeObjects (can raise KeyError / break on nested objects)."""
    try:
        if isinstance(sess, dict):
            raw = sess.get("metadata")
        else:
            raw = getattr(sess, "metadata", None)
        if raw is None:
            return {}
        if isinstance(raw, dict):
            return {str(k): v for k, v in raw.items()}
        for meth in ("to_dict_recursive", "to_dict"):
            fn = getattr(raw, meth, None)
            if callable(fn):
                d = fn()
                if isinstance(d, dict):
                    return {str(k): v for k, v in d.items()}
    except Exception as ex:
        print(f"[Stripe] checkout session metadata: {type(ex).__name__}: {ex}", flush=True)
    return {}


def _checkout_session_status(sess) -> str | None:
    if isinstance(sess, dict):
        return sess.get("status")
    return getattr(sess, "status", None)


def _checkout_sessions_list_scan(*, order_id: str, status: str, max_pages: int = 5):
    """
    stripe-python has no checkout.Session.search; scan recent Session.list pages.
    Fine for test accounts and moderate traffic.
    """
    if not STRIPE_OK:
        return None
    starting_after = None
    for _ in range(max_pages):
        params: dict = {"limit": 100}
        if starting_after:
            params["starting_after"] = starting_after
        page = stripe.checkout.Session.list(**params)
        for s in getattr(page, "data", None) or []:
            meta = _checkout_session_metadata(s)
            if str(meta.get("order_id") or "") != str(order_id):
                continue
            if _checkout_session_status(s) == status:
                return s
        if not getattr(page, "has_more", False):
            break
        rows = getattr(page, "data", None) or []
        if not rows:
            break
        last = rows[-1]
        starting_after = last if isinstance(last, str) else getattr(last, "id", None)
    return None


def checkout_session_payment_intent_id(sess) -> str | None:
    if not sess:
        return None
    pi_raw = (
        sess.get("payment_intent")
        if isinstance(sess, dict)
        else getattr(sess, "payment_intent", None)
    )
    if isinstance(pi_raw, dict):
        i = pi_raw.get("id")
        return str(i) if i else None
    return str(pi_raw) if pi_raw else None


def checkout_session_is_paid(sess) -> bool:
    if not sess:
        return False
    st = sess.get("status") if isinstance(sess, dict) else getattr(sess, "status", None)
    ps = (
        sess.get("payment_status")
        if isinstance(sess, dict)
        else getattr(sess, "payment_status", None)
    )
    return st == "complete" and ps == "paid"


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

    def find_open_checkout_session_for_order(self, order_id: str) -> dict | None:
        """Reuse an existing open Hosted Checkout session if one exists (same metadata order_id)."""
        if not STRIPE_OK:
            return None
        try:
            s = _checkout_sessions_list_scan(order_id=order_id, status="open", max_pages=5)
            if s:
                url = getattr(s, "url", None) if not isinstance(s, dict) else s.get("url")
                sid = getattr(s, "id", None) if not isinstance(s, dict) else s.get("id")
                if url and sid:
                    return {"checkout_url": url, "session_id": sid}
        except Exception as e:
            print(f"[Stripe] find_open_checkout_session_for_order: {e}", flush=True)
        return None

    def find_complete_checkout_session_for_order(self, order_id: str):
        """Completed Hosted Checkout for order_id (metadata), for webhook-missed sync."""
        if not STRIPE_OK:
            return None
        try:
            return _checkout_sessions_list_scan(order_id=order_id, status="complete", max_pages=8)
        except Exception as e:
            print(f"[Stripe] find_complete_checkout_session_for_order: {type(e).__name__}: {e}", flush=True)
            return None

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

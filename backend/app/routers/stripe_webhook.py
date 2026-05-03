"""Stripe payments + Connect webhooks."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse

from app.db import SessionLocal
from app.services.order_service import OrderService
from app.services.stripe_service import stripe_service
from sqlalchemy import text

router = APIRouter()

_RETURN_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"/><title>InfraStreet</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:32rem;line-height:1.5">
<p><strong>Stripe onboarding is complete (or you closed the flow).</strong></p>
<p>Return to the InfraStreet bot in Telegram and send <code>/continue</code> so we can mark your stall as live.</p>
<p>If the bot says Stripe still needs info, open the <strong>new</strong> connect.stripe.com link it sends you and finish every step (business details, bank link, identity, terms).</p>
</body></html>"""

_REFRESH_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"/><title>InfraStreet</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:32rem;line-height:1.5">
<p><strong>This is not your signup page.</strong></p>
<p>Stripe only sends you here if an onboarding <em>session</em> had to be restarted, or if you opened this URL directly from a bookmark.</p>
<p>To finish payouts, always use the long <strong>connect.stripe.com/setup/…</strong> link from the Telegram bot. After you submit that form, Stripe sends you to the &quot;almost done&quot; page — then go back to Telegram and send <code>/continue</code>.</p>
<p>If you are stuck, open Telegram and send <code>/continue</code> so the bot can send a fresh Stripe link.</p>
</body></html>"""


@router.get("/stripe/connect/return", response_class=HTMLResponse)
def stripe_connect_return():
    """
    Stripe Account Link return_url (Express onboarding / update).
    User must send /continue in Telegram so the bot can sync DB when payouts_enabled flips.
    """
    return HTMLResponse(_RETURN_HTML)


@router.get("/stripe/connect/refresh", response_class=HTMLResponse)
def stripe_connect_refresh():
    """Stripe Account Link refresh_url."""
    return HTMLResponse(_REFRESH_HTML)


order_service = OrderService()

STRIPE_CONNECT_SECRET = os.getenv("STRIPE_CONNECT_WEBHOOK_SECRET", "").strip()


def _pi_obj(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if hasattr(raw, "to_dict"):
        return raw.to_dict()
    try:
        return dict(raw)
    except Exception:
        return {}


def _order_id_from_pi(obj: dict) -> str | None:
    meta = obj.get("metadata") or {}
    return meta.get("infrastreet_order_id") or meta.get("order_id")


def _payment_intent_id(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, str):
        return val or None
    if isinstance(val, dict):
        return val.get("id")
    return getattr(val, "id", None)


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    event = stripe_service.verify_webhook(payload, sig)
    if not event:
        raise HTTPException(400, "Invalid Stripe signature")

    if isinstance(event, dict):
        event_type = event.get("type")
        raw_obj = (event.get("data") or {}).get("object")
    else:
        event_type = getattr(event, "type", None)
        raw_obj = event.data.object
    obj = _pi_obj(raw_obj)

    if event_type == "payment_intent.amount_capturable_updated":
        pi_id = obj.get("id")
        order_id = _order_id_from_pi(obj)
        if order_id and int(obj.get("amount_capturable") or 0) > 0:
            if _try_set_pending_after_auth(order_id, pi_id):
                order_service.notify_vendor_new_reservation(order_id)

    elif event_type == "payment_intent.succeeded":
        pi_id = obj.get("id")
        order_id = _order_id_from_pi(obj)
        capture_method = (obj.get("capture_method") or "").lower()
        if order_id:
            if capture_method == "automatic":
                _try_automatic_capture_bookkeeping(order_id, pi_id)
            else:
                order_service.on_payment_succeeded(order_id, pi_id)

    elif event_type == "payment_intent.payment_failed":
        order_id = _order_id_from_pi(obj)
        if order_id:
            order_service.on_payment_failed(order_id)

    elif event_type == "payment_intent.canceled":
        order_id = _order_id_from_pi(obj)
        if order_id:
            order_service.on_payment_failed(order_id)

    elif event_type == "checkout.session.completed":
        metadata = obj.get("metadata", {}) or {}
        order_id = metadata.get("order_id")
        pi_id = _payment_intent_id(obj.get("payment_intent"))
        if order_id and pi_id:
            order_service.on_payment_succeeded(order_id, pi_id)

    elif event_type == "charge.dispute.created":
        ch = _pi_obj(raw_obj)
        pi_ref = ch.get("payment_intent")
        order_id = None
        if pi_ref:
            try:
                import stripe

                stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
                pi = stripe.PaymentIntent.retrieve(pi_ref)
                meta = pi.metadata or {}
                order_id = meta.get("infrastreet_order_id") or meta.get("order_id")
            except Exception as e:
                print(f"[Stripe] dispute PI lookup: {e}", flush=True)
        order_service.flag_order_for_review(order_id, reason="dispute")

    return {"received": True}


def _try_set_pending_after_auth(order_id: str, pi_id: str) -> bool:
    db = SessionLocal()
    try:
        res = db.execute(
            text(
                """
                UPDATE orders
                SET status = 'pending', stripe_payment_intent = COALESCE(stripe_payment_intent, :pi)
                WHERE id = :oid AND status = 'pending_payment'
                """
            ),
            {"oid": order_id, "pi": pi_id},
        )
        db.commit()
        return (res.rowcount or 0) > 0
    finally:
        db.close()


def _try_automatic_capture_bookkeeping(order_id: str, pi_id: str) -> None:
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                UPDATE orders
                SET status = 'pending',
                    stripe_payment_intent = COALESCE(stripe_payment_intent, :pi),
                    stripe_captured_at = COALESCE(stripe_captured_at, NOW())
                WHERE id = :oid AND status = 'pending_payment'
                """
            ),
            {"oid": order_id, "pi": pi_id},
        )
        db.commit()
    finally:
        db.close()
    order_service.notify_vendor_new_reservation(order_id)


@router.post("/webhooks/stripe/connect")
async def stripe_connect_webhook(request: Request):
    if not STRIPE_CONNECT_SECRET:
        raise HTTPException(503, "Connect webhook not configured")

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        import stripe

        event = stripe.Webhook.construct_event(payload, sig, STRIPE_CONNECT_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid Connect webhook signature")

    et = event.get("type") if isinstance(event, dict) else event.type
    data_obj = event.get("data", {}).get("object", {}) if isinstance(event, dict) else _pi_obj(event.data.object)

    if et == "account.updated":
        acct = data_obj if isinstance(data_obj, dict) else _pi_obj(event.data.object)
        vid = (acct.get("metadata") or {}).get("infrastreet_vendor_id")
        if vid:
            payouts_ok = acct.get("payouts_enabled", False)
            status = "active" if payouts_ok else "restricted"
            db = SessionLocal()
            try:
                db.execute(
                    text("UPDATE vendors SET stripe_account_status = :s WHERE id = :id"),
                    {"s": status, "id": vid},
                )
                db.commit()
            finally:
                db.close()

    elif et == "payout.failed":
        print("[Stripe Connect] payout.failed — notify vendor to update card", flush=True)

    return {"received": True}

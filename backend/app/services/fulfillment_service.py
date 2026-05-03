"""Order fulfillment: capture, pickup QR, no-show, vendor cancel (InfraStreet)."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from sqlalchemy import text

from app.db import SessionLocal
from app.services import telegram_notify
from app.services.payments import cancel_payment_intent, capture_payment_intent
from app.services.stripe_connect import release_payout_to_vendor
from app.services.trust_service import update_no_show_strikes, update_trust_score

try:
    import stripe

    import os

    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    STRIPE_OK = bool(stripe.api_key)
except ImportError:
    STRIPE_OK = False
    stripe = None  # type: ignore


def _utcnow():
    return datetime.now(timezone.utc)


def _run_async(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    # Called from running loop (unlikely in our sync routes)
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        fut = pool.submit(asyncio.run, coro)
        return fut.result(timeout=60)


def _load_order_row(order_id: str):
    db = SessionLocal()
    try:
        return db.execute(
            text(
                """
                SELECT o.*, v.id as v_id, v.name as vendor_name, v.phone as vendor_phone,
                       v.stripe_account_id as vendor_stripe_acct,
                       COALESCE(v.payout_enabled, false) as vendor_payout_ok,
                       fd.item_name as deal_item_name, c.id as customer_row_id
                FROM orders o
                JOIN vendors v ON v.id = o.vendor_id
                LEFT JOIN flash_deals fd ON fd.id = o.deal_id
                LEFT JOIN customers c ON c.phone = o.customer_phone
                WHERE o.id = :oid
                """
            ),
            {"oid": order_id},
        ).fetchone()
    finally:
        db.close()


def _transfer_id_from_payment_intent(pi_id: str | None) -> str | None:
    if not pi_id or not STRIPE_OK or stripe is None:
        return None
    try:
        pi = stripe.PaymentIntent.retrieve(pi_id, expand=["latest_charge"])
        ch = pi.latest_charge
        if ch is None:
            return None
        if isinstance(ch, str):
            ch_obj = stripe.Charge.retrieve(ch)
        else:
            ch_obj = ch
        tid = getattr(ch_obj, "transfer", None)
        return str(tid) if tid else None
    except Exception as e:
        print(f"[fulfillment] transfer_id from PI: {e}", flush=True)
        return None


def _ledger_payout(
    vendor_id: str,
    order_id: str,
    transfer_id: str | None,
    gross: float,
    platform_fee: float,
    net: float,
) -> None:
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                INSERT INTO vendor_payouts
                  (vendor_id, order_id, stripe_transfer_id, gross_amount, platform_fee, net_amount, status, transferred_at)
                VALUES (:vid, :oid, :tid, :g, :pf, :n, :st, CASE WHEN :tid IS NOT NULL AND :tid <> '' THEN NOW() ELSE NULL END)
                """
            ),
            {
                "vid": vendor_id,
                "oid": order_id,
                "tid": transfer_id or "",
                "g": gross,
                "pf": platform_fee,
                "n": net,
                "st": "transferred" if transfer_id else "pending",
            },
        )
        db.execute(
            text(
                """
                UPDATE vendors SET total_orders_fulfilled = COALESCE(total_orders_fulfilled, 0) + 1
                WHERE id = :vid
                """
            ),
            {"vid": vendor_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


class FulfillmentService:
    def vendor_confirm_making(self, order_id: str) -> dict:
        """Vendor tapped I'm making it — order moves to confirmed; prompt for mark ready."""
        row = _load_order_row(order_id)
        if not row:
            raise ValueError(f"Order {order_id} not found")
        m = row._mapping
        st = (m.get("status") or "").lower()
        if st != "pending":
            if st == "pending_payment":
                raise ValueError("Customer payment is still processing — try again in a moment.")
            raise ValueError("This order is not awaiting confirmation.")

        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE orders SET status = 'confirmed' WHERE id = :oid"),
                {"oid": order_id},
            )
            db.commit()
        finally:
            db.close()

        _run_async(
            telegram_notify.notify_vendor_ready_prompt(
                {"vendor_phone": m.get("vendor_phone"), "deal_item_name": m.get("deal_item_name")},
                order_id,
            )
        )
        from app.services.order_service import OrderService

        OrderService().update_status(order_id, "confirmed")
        return OrderService().get_order(order_id) or {"orderId": order_id, "status": "confirmed"}

    def vendor_mark_ready(self, order_id: str) -> dict:
        row = _load_order_row(order_id)
        if not row:
            raise ValueError(f"Order {order_id} not found")
        m = row._mapping
        pi_id = m.get("stripe_payment_intent")
        if not pi_id:
            raise RuntimeError("No payment on this order")

        st_ord = (m.get("status") or "").lower()
        captured_already = False
        if STRIPE_OK and stripe is not None:
            try:
                pi = stripe.PaymentIntent.retrieve(pi_id)
                captured_already = pi.status == "succeeded"
            except Exception as e:
                print(f"[fulfillment] PI retrieve: {e}", flush=True)

        if not captured_already:
            if st_ord not in ("confirmed",):
                if st_ord == "pending":
                    raise ValueError('Tap "I\'m making it" first, then mark ready when food is prepared.')
                raise ValueError("This order cannot be marked ready yet.")
            if not capture_payment_intent(pi_id):
                raise RuntimeError("Payment capture failed — do not mark order ready")

        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    UPDATE orders
                    SET status = 'ready',
                        stripe_captured_at = NOW(),
                        stripe_capture_method = COALESCE(stripe_capture_method, 'manual')
                    WHERE id = :oid
                    """
                ),
                {"oid": order_id},
            )
            db.commit()
        finally:
            db.close()

        order_phone = m.get("customer_phone")
        fe = __import__("os").getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
        qr = m.get("pickup_qr_code") or m.get("pickup_code")
        _run_async(
            telegram_notify.notify_customer_order_ready(
                order_phone,
                f"Your order is ready for pickup at {m.get('vendor_name') or 'the vendor'}.\n"
                f"Pickup code: {qr}\n"
                f"{fe}/orders/{order_id}",
            )
        )
        _run_async(
            telegram_notify.notify_vendor_qr_confirm_prompt(m.get("vendor_phone"), str(qr), order_id)
        )
        from app.services.order_service import OrderService

        OrderService().update_status(order_id, "ready")
        return OrderService().get_order(order_id) or {"orderId": order_id, "status": "ready"}

    def confirm_pickup_by_qr(self, order_id: str, qr_code: str) -> dict:
        row = _load_order_row(order_id)
        if not row:
            raise ValueError(f"Order {order_id} not found")
        m = row._mapping
        expected = (m.get("pickup_qr_code") or "").strip()
        if not expected or expected != qr_code.strip():
            raise ValueError("QR code mismatch")

        vendor_stripe = m.get("vendor_stripe_acct")
        gross = float(m.get("total") or 0)
        platform_fee = float(m.get("service_fee") or 0)
        net = max(0.0, gross - platform_fee)
        pi_id = m.get("stripe_payment_intent")

        transfer_id = _transfer_id_from_payment_intent(pi_id)
        if not transfer_id and vendor_stripe and net > 0:
            try:
                transfer_id = release_payout_to_vendor(
                    vendor_stripe,
                    int(round(net * 100)),
                    order_id,
                    m.get("v_id"),
                )
            except Exception as e:
                print(f"[fulfillment] transfer fallback: {e}", flush=True)

        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    UPDATE orders
                    SET status = 'fulfilled',
                        pickup_qr_scanned_at = NOW(),
                        pickup_confirmed_at = NOW(),
                        payout_transfer_id = :tid,
                        payout_released_at = NOW()
                    WHERE id = :oid
                    """
                ),
                {"oid": order_id, "tid": transfer_id or ""},
            )
            db.commit()
        finally:
            db.close()

        _ledger_payout(
            m.get("v_id"),
            order_id,
            transfer_id,
            gross,
            platform_fee,
            net,
        )

        cust_row_id = m.get("customer_row_id")
        if cust_row_id:
            update_trust_score(
                "customer",
                cust_row_id,
                "order_picked_up",
                0.003,
                order_id,
            )
        update_trust_score(
            "vendor",
            m.get("v_id"),
            "order_fulfilled",
            0.002,
            order_id,
        )

        items = m.get("items")
        if not isinstance(items, list):
            items = json.loads(items or "[]")
        item_line = ", ".join(
            f"{i.get('name', 'Item')} × {i.get('quantity', 1)}" for i in items[:3]
        ) or (m.get("deal_item_name") or "Order")
        _run_async(
            telegram_notify.notify_vendor_payout_sent(
                dict(m),
                order_id,
                item_line,
                gross,
                platform_fee,
                net,
            )
        )

        from app.services.order_service import OrderService

        OrderService().update_status(order_id, "fulfilled")
        return OrderService().get_order(order_id) or {"orderId": order_id, "status": "fulfilled"}

    def handle_customer_no_show(self, order_id: str) -> dict:
        row = _load_order_row(order_id)
        if not row:
            raise ValueError(f"Order {order_id} not found")
        m = row._mapping
        if m.get("pickup_qr_scanned_at"):
            return self._order_dict_from_row(m)
        if (m.get("status") or "") != "ready":
            return self._order_dict_from_row(m)

        vendor_stripe = m.get("vendor_stripe_acct")
        gross = float(m.get("total") or 0)
        platform_fee = float(m.get("service_fee") or 0)
        net = max(0.0, gross - platform_fee)
        pi_id = m.get("stripe_payment_intent")

        transfer_id = _transfer_id_from_payment_intent(pi_id)
        if not transfer_id and vendor_stripe and net > 0:
            try:
                transfer_id = release_payout_to_vendor(
                    vendor_stripe,
                    int(round(net * 100)),
                    order_id,
                    m.get("v_id"),
                )
            except Exception as e:
                print(f"[fulfillment] no-show transfer: {e}", flush=True)

        cust_row_id = m.get("customer_row_id")

        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    UPDATE orders
                    SET status = 'no_show',
                        customer_no_show = true,
                        payout_transfer_id = COALESCE(NULLIF(:tid, ''), payout_transfer_id),
                        payout_released_at = COALESCE(payout_released_at, NOW())
                    WHERE id = :oid
                    """
                ),
                {"oid": order_id, "tid": transfer_id or ""},
            )
            db.commit()
        finally:
            db.close()

        if cust_row_id:
            update_trust_score(
                "customer",
                cust_row_id,
                "customer_no_show",
                -0.15,
                order_id,
            )
            update_no_show_strikes(cust_row_id)

        _ledger_payout(
            m.get("v_id"),
            order_id,
            transfer_id,
            gross,
            platform_fee,
            net,
        )

        from app.services.order_service import OrderService

        OrderService().update_status(order_id, "no_show")
        return OrderService().get_order(order_id) or {"orderId": order_id, "status": "no_show"}

    def handle_vendor_cancellation(self, order_id: str) -> dict:
        row = _load_order_row(order_id)
        if not row:
            raise ValueError(f"Order {order_id} not found")
        m = row._mapping
        pi_id = m.get("stripe_payment_intent")
        if pi_id:
            try:
                cancel_payment_intent(pi_id, reason="vendor_cancelled")
            except Exception as e:
                print(f"[fulfillment] cancel PI: {e}", flush=True)

        db = SessionLocal()
        try:
            if m.get("deal_id"):
                items = m.get("items")
                if not isinstance(items, list):
                    items = json.loads(items or "[]")
                qty = sum(int(i.get("quantity", 1)) for i in items)
                db.execute(
                    text(
                        "UPDATE flash_deals SET remaining_quantity = remaining_quantity + :q WHERE id = :did"
                    ),
                    {"q": qty, "did": m.get("deal_id")},
                )
            db.execute(
                text(
                    """
                    UPDATE orders
                    SET status = 'cancelled', vendor_no_show = true
                    WHERE id = :oid
                    """
                ),
                {"oid": order_id},
            )
            db.commit()
        finally:
            db.close()

        update_trust_score(
            "vendor",
            m.get("v_id"),
            "vendor_no_show",
            -0.10,
            order_id,
        )

        _run_async(telegram_notify.notify_customer_order_cancelled(m.get("customer_phone")))

        from app.services.order_service import OrderService

        OrderService().update_status(order_id, "cancelled")
        return OrderService().get_order(order_id) or {"orderId": order_id, "status": "cancelled"}

    def _order_dict_from_row(self, m):
        from app.services.order_service import OrderService

        return OrderService().get_order(m.get("id"))

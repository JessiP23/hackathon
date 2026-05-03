import json
import os
import random
import string
from app.db import SessionLocal
from app.billing import service_fee_rate
from sqlalchemy import text

from app.services import inapp_events
from app.services.customer_service import _normalize_phone


class OrderService:
    # ── Place order against a flash deal (PaymentIntent + Connect) ────
    def place_deal_order(
        self,
        deal_id: str,
        customer_id: str,
        quantity: int,
        customer_phone: str,
        redeem_points: int = 0,
    ) -> dict:
        from app.services.user_service import UserService
        from app.services.payments import STRIPE_OK, create_deal_payment_intent, generate_qr_code
        import stripe

        us = UserService()
        norm_phone = _normalize_phone(customer_phone)
        db = SessionLocal()
        deal = None
        pdata = None
        order_id = None
        pickup_code = ""
        pickup_qr = ""
        customer_total = 0.0
        spent_pts = 0
        discount = 0.0
        trust_level = 0
        try:
            deal = db.execute(
                text("""
                    SELECT fd.*, v.name as vendor_name, v.phone as vendor_phone,
                           v.id as vendor_id,
                           ST_Y(v.location::geometry) as lat, ST_X(v.location::geometry) as lng
                    FROM flash_deals fd
                    JOIN vendors v ON v.id = fd.vendor_id
                    WHERE fd.id = :did AND fd.status = 'active' AND fd.end_at > NOW()
                    FOR UPDATE
                """),
                {"did": deal_id},
            ).fetchone()

            if not deal:
                db.rollback()
                return {"error": "Deal not found or expired"}
            if deal.remaining_quantity < quantity:
                db.rollback()
                return {"error": "Not enough quantity available"}

            crow = None
            try:
                crow = db.execute(
                    text("""
                        SELECT id, COALESCE(trust_level, 0), stripe_customer_id, name
                        FROM customers WHERE phone = :p
                        FOR UPDATE
                    """),
                    {"p": norm_phone},
                ).fetchone()
            except Exception:
                crow = None

            trust_level = int(crow[1] or 0) if crow else 0
            if trust_level >= 3:
                db.rollback()
                return {"error": "Your account is blocked from making reservations."}

            vpay = db.execute(
                text(
                    """
                    SELECT stripe_account_id, COALESCE(payout_enabled, false)
                    FROM vendors WHERE id = :vid
                    """
                ),
                {"vid": deal.vendor_id},
            ).fetchone()
            stripe_acct = vpay[0] if vpay else None
            if not stripe_acct:
                db.rollback()
                return {"error": "This vendor is not set up for payments yet."}

            db.execute(
                text("""
                    UPDATE flash_deals
                    SET remaining_quantity = remaining_quantity - :qty
                    WHERE id = :did AND remaining_quantity >= :qty
                """),
                {"qty": quantity, "did": deal_id},
            )

            vendor_price = float(deal.deal_price or 0) * quantity
            service_fee = round(vendor_price * service_fee_rate(), 2)
            customer_total_pre = round(vendor_price + service_fee, 2)
            max_disc = round(customer_total_pre * 0.5, 2)
            spent_pts, discount = us.try_redeem_with_session(
                db, customer_phone, redeem_points, max_disc
            )
            customer_total = round(max(0.5, customer_total_pre - discount), 2)
            pickup_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            pickup_qr = generate_qr_code()

            result = db.execute(
                text("""
                    INSERT INTO orders (
                        id, vendor_id, customer_phone, deal_id, items, total,
                        service_fee, status, pickup_code, pickup_qr_code, created_at
                    ) VALUES (
                        'o_' || substr(md5(random()::text), 1, 8),
                        :vendor_id, :customer_phone, :deal_id,
                        CAST(:items_json AS jsonb),
                        :total, :service_fee, 'pending_payment', :pickup_code, :pickup_qr, NOW()
                    ) RETURNING id
                """),
                {
                    "vendor_id": deal.vendor_id,
                    "customer_phone": norm_phone,
                    "deal_id": deal_id,
                    "items_json": json.dumps(
                        [{"name": deal.item_name, "quantity": quantity, "price": float(deal.deal_price or 0)}]
                    ),
                    "total": customer_total,
                    "service_fee": service_fee,
                    "pickup_code": pickup_code,
                    "pickup_qr": pickup_qr,
                },
            )
            row = result.fetchone()
            if row is None:
                raise RuntimeError("Failed to create order")

            order_id = row[0]

            if not STRIPE_OK:
                db.rollback()
                return {"error": "Card payments are not configured."}

            stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
            cust_stripe_id = None
            if crow and crow[2]:
                cust_stripe_id = crow[2]
            else:
                c = stripe.Customer.create(
                    phone=norm_phone,
                    name=(crow[3] if crow else None) or None,
                    metadata={"infrastreet_phone": norm_phone},
                )
                cust_stripe_id = c.id
                if crow:
                    db.execute(
                        text(
                            "UPDATE customers SET stripe_customer_id = :s WHERE id = :id"
                        ),
                        {"s": cust_stripe_id, "id": crow[0]},
                    )

            amount_cents = int(round(customer_total * 100))
            try:
                pdata = create_deal_payment_intent(
                    amount_cents,
                    cust_stripe_id,
                    stripe_acct,
                    order_id,
                    deal.vendor_id,
                    crow[0] if crow else None,
                    trust_level,
                )
            except ValueError as e:
                db.rollback()
                return {"error": str(e)}
            except Exception as e:
                db.rollback()
                print(f"[orders] PaymentIntent create failed: {e}", flush=True)
                return {"error": "Could not start payment. Try again."}

            db.execute(
                text(
                    """
                    UPDATE orders
                    SET stripe_payment_intent = :pi,
                        stripe_capture_method = :cm,
                        pickup_qr_code = COALESCE(pickup_qr_code, :qr)
                    WHERE id = :oid
                    """
                ),
                {
                    "pi": pdata["payment_intent_id"],
                    "cm": pdata["capture_method"],
                    "qr": pickup_qr,
                    "oid": order_id,
                },
            )
            if crow:
                db.execute(
                    text(
                        """
                        UPDATE customers
                        SET total_reservations = COALESCE(total_reservations, 0) + 1
                        WHERE id = :id
                        """
                    ),
                    {"id": crow[0]},
                )
            db.commit()

        except Exception as e:
            db.rollback()
            print(f"[orders] place_deal_order: {e}", flush=True)
            raise
        finally:
            db.close()

        publishable = os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()
        return {
            "orderId": order_id,
            "clientSecret": pdata["client_secret"],
            "publishableKey": publishable,
            "pickupCode": pickup_code,
            "pickupQrCode": pickup_qr,
            "total": customer_total,
            "status": "pending_payment",
            "captureMethod": pdata["capture_method"],
            "trustLevel": trust_level,
            "pointsRedeemed": spent_pts,
            "pointsDiscount": discount,
            "vendorId": deal.vendor_id,
            "vendorName": deal.vendor_name,
            "dealId": deal_id,
            "items": [{"name": deal.item_name, "quantity": quantity, "price": float(deal.deal_price or 0)}],
        }

    # ── Stripe webhook: payment succeeded ─────────────────────────────
    def on_payment_succeeded(self, order_id: str, payment_intent_id: str) -> dict:
        db = SessionLocal()
        try:
            res = db.execute(
                text("""
                    UPDATE orders
                    SET status = 'paid', stripe_payment_intent = :pi
                    WHERE id = :oid AND status = 'pending_payment'
                """),
                {"pi": payment_intent_id, "oid": order_id},
            )
            updated = (res.rowcount or 0) > 0
            db.commit()
            if not updated:
                return {"ok": True}
            row = db.execute(
                text("""
                    SELECT o.*, v.phone as vendor_phone, v.name as vendor_name,
                           fd.end_at, fd.item_name as deal_item
                    FROM orders o
                    JOIN vendors v ON v.id = o.vendor_id
                    LEFT JOIN flash_deals fd ON fd.id = o.deal_id
                    WHERE o.id = :oid
                """),
                {"oid": order_id},
            ).fetchone()
        finally:
            db.close()

        if row:
            items = row.items if isinstance(row.items, list) else json.loads(row.items or "[]")
            end_str = row.end_at.strftime("%I:%M%p") if row.end_at else "end of deal"
            deal_item = getattr(row, "deal_item", None) or ""
            if not deal_item and items:
                deal_item = ", ".join(
                    f"{i.get('quantity', 1)}× {i.get('name', 'Item')}" for i in items[:4]
                )
                if len(items) > 4:
                    deal_item += "…"
            if not deal_item:
                deal_item = "Your order"

            is_menu = not row.deal_id
            time_line = f"Recoge antes de {end_str}" if not is_menu else "Listo para recoger en el puesto"

            # Notify customer
            from app.services.notify_service import notify_service
            notify_service.notify_customer_confirmation(
                row.customer_phone,
                f"✅ Orden confirmada #{row.pickup_code}\n"
                f"{deal_item} @ {row.vendor_name}\n"
                f"{time_line}\n"
                f"Código: {row.pickup_code}"
            )
            # Notify vendor
            fe = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
            subtotal = float(row.total or 0) - float(row.service_fee or 0)
            notify_service.notify_vendor_order(
                row.vendor_phone,
                f"Nueva orden #{row.pickup_code}\n"
                f"{deal_item} - ${subtotal:.2f}\n"
                f"Cliente: {row.customer_phone}\n"
                + (f"Deal hasta {end_str}\n" if not is_menu else "")
                + f"Ver: {fe}/orders/{order_id}"
            )

        return {"ok": True}

    # ── Stripe webhook: payment failed ────────────────────────────────
    def on_payment_failed(self, order_id: str) -> dict:
        db = SessionLocal()
        try:
            # Restore quantity
            row = db.execute(
                text("SELECT deal_id, items FROM orders WHERE id = :oid"),
                {"oid": order_id}
            ).fetchone()
            if row and row.deal_id:
                items = row.items if isinstance(row.items, list) else json.loads(row.items or "[]")
                qty = sum(i.get("quantity", 1) for i in items)
                db.execute(
                    text("UPDATE flash_deals SET remaining_quantity = remaining_quantity + :qty WHERE id = :did"),
                    {"qty": qty, "did": row.deal_id}
                )
            db.execute(
                text("UPDATE orders SET status = 'payment_failed' WHERE id = :oid"),
                {"oid": order_id}
            )
            db.commit()
        finally:
            db.close()
        return {"ok": True}

    # ── Menu cart checkout (Stripe, same fee + points model as flash deals) ─
    def create_order(self, payload) -> dict:
        from app.services.user_service import UserService
        from app.services.stripe_service import stripe_service

        us = UserService()
        if hasattr(payload, "vendorId"):
            vendor_id = payload.vendorId
            customer_phone = payload.customerPhone or ""
            redeem_points = int(getattr(payload, "redeemPoints", 0) or 0)
            items = [{"itemId": i.itemId, "quantity": i.quantity} for i in payload.items]
        else:
            vendor_id = payload.get("vendorId")
            customer_phone = payload.get("customerPhone") or ""
            redeem_points = int(payload.get("redeemPoints") or 0)
            items = payload.get("items", [])

        if not customer_phone:
            return {"error": "customerPhone is required for checkout"}

        db = SessionLocal()
        try:
            item_ids = [i["itemId"] for i in items]
            menu_items = db.execute(
                text("SELECT id, item_name, price FROM menus WHERE id = ANY(:ids)"),
                {"ids": item_ids},
            ).fetchall()
            menu_map = {m.id: {"name": m.item_name, "price": float(m.price)} for m in menu_items}

            order_items = []
            vendor_subtotal = 0.0
            for item in items:
                item_id = item["itemId"]
                qty = int(item["quantity"])
                if item_id not in menu_map:
                    continue
                m = menu_map[item_id]
                order_items.append(
                    {"itemId": item_id, "name": m["name"], "price": m["price"], "quantity": qty}
                )
                vendor_subtotal += m["price"] * qty

            if not order_items:
                return {"error": "No valid menu items in cart"}

            vrow = db.execute(
                text("SELECT name FROM vendors WHERE id = :vid LIMIT 1"),
                {"vid": vendor_id},
            ).fetchone()
            vendor_name = vrow[0] if vrow else "Vendor"

            service_fee = round(vendor_subtotal * service_fee_rate(), 2)
            customer_total_pre = round(vendor_subtotal + service_fee, 2)
            max_disc = round(customer_total_pre * 0.5, 2)
            spent_pts, discount = us.try_redeem_with_session(
                db, customer_phone, redeem_points, max_disc
            )
            customer_total = round(max(0.5, customer_total_pre - discount), 2)
            pickup_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

            n = len(order_items)
            if n == 1:
                stripe_label = order_items[0]["name"]
            else:
                stripe_label = f"{order_items[0]['name']} + {n - 1} more ({vendor_name})"

            total_qty = sum(i["quantity"] for i in order_items)

            result = db.execute(
                text("""
                    INSERT INTO orders (
                        id, vendor_id, customer_phone, deal_id, items, total,
                        service_fee, status, pickup_code, created_at
                    ) VALUES (
                        'o_' || substr(md5(random()::text), 1, 8),
                        :vendor_id, :customer_phone, NULL,
                        CAST(:items_json AS jsonb),
                        :total, :service_fee, 'pending_payment', :pickup_code, NOW()
                    ) RETURNING id
                """),
                {
                    "vendor_id": vendor_id,
                    "customer_phone": customer_phone,
                    "items_json": json.dumps(order_items),
                    "total": customer_total,
                    "service_fee": service_fee,
                    "pickup_code": pickup_code,
                },
            )
            row = result.fetchone()
            if row is None:
                raise RuntimeError("Failed to create order")
            order_id = row[0]
            db.commit()
        finally:
            db.close()

        checkout = stripe_service.create_checkout_session(
            order_id=order_id,
            vendor_id=vendor_id,
            item_name=stripe_label[:120],
            quantity=max(1, total_qty),
            vendor_price=vendor_subtotal,
            points_discount=discount,
            deal_id=None,
        )

        return {
            "orderId": order_id,
            "checkoutUrl": checkout.get("checkout_url"),
            "pickupCode": pickup_code,
            "total": customer_total,
            "status": "pending_payment",
            "vendorId": vendor_id,
            "items": order_items,
            "pointsRedeemed": spent_pts,
            "pointsDiscount": discount,
        }

    def get_order(self, order_id: str):
        db = SessionLocal()
        try:
            r = db.execute(
                text("SELECT o.*, v.name as vendor_name FROM orders o LEFT JOIN vendors v ON v.id = o.vendor_id WHERE o.id = :oid"),
                {"oid": order_id}
            ).fetchone()
            if not r:
                return None
            items = r.items if isinstance(r.items, list) else json.loads(r.items) if r.items else []
            sf = float(r.service_fee) if getattr(r, "service_fee", None) is not None else None
            cap = getattr(r, "stripe_captured_at", None)
            out = {
                "orderId": r.id,
                "vendorId": r.vendor_id,
                "vendorName": r.vendor_name,
                "customerPhone": r.customer_phone,
                "dealId": getattr(r, "deal_id", None),
                "items": items,
                "total": float(r.total) if r.total else 0,
                "serviceFee": sf,
                "status": r.status,
                "pickupCode": r.pickup_code,
                "pickupQrCode": getattr(r, "pickup_qr_code", None),
                "stripePaymentIntent": getattr(r, "stripe_payment_intent", None),
                "stripeCaptureMethod": getattr(r, "stripe_capture_method", None),
                "stripeCapturedAt": cap.isoformat() if cap else None,
                "customerNoShow": bool(getattr(r, "customer_no_show", None)),
                "payoutTransferId": getattr(r, "payout_transfer_id", None),
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            return out
        finally:
            db.close()

    def flag_order_for_review(self, order_id: str | None, reason: str) -> None:
        if not order_id:
            return
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                    UPDATE orders
                    SET flagged_for_review = true, review_reason = :r
                    WHERE id = :oid
                    """
                ),
                {"oid": order_id, "r": reason[:500]},
            )
            db.commit()
        finally:
            db.close()

    def notify_vendor_new_reservation(self, order_id: str) -> None:
        import asyncio

        from app.services import telegram_notify

        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
                    SELECT o.items, o.customer_phone, v.phone as vendor_phone,
                           fd.item_name as deal_item
                    FROM orders o
                    JOIN vendors v ON v.id = o.vendor_id
                    LEFT JOIN flash_deals fd ON fd.id = o.deal_id
                    WHERE o.id = :oid
                    """
                ),
                {"oid": order_id},
            ).fetchone()
        finally:
            db.close()
        if not row:
            return
        m = row._mapping
        items = m.get("items")
        if not isinstance(items, list):
            items = json.loads(items or "[]")
        qty = sum(int(i.get("quantity", 1)) for i in items) or 1
        line = ", ".join(i.get("name", "Item") for i in items[:2]) or (m.get("deal_item") or "Order")
        cust_phone = m.get("customer_phone") or ""
        first = "Guest"
        db2 = SessionLocal()
        try:
            u = db2.execute(
                text("SELECT name FROM users WHERE phone = :p LIMIT 1"),
                {"p": cust_phone},
            ).fetchone()
            if u and u[0]:
                first = (u[0] or "Guest").split()[0]
            else:
                c = db2.execute(
                    text("SELECT name FROM customers WHERE phone = :p LIMIT 1"),
                    {"p": cust_phone},
                ).fetchone()
                if c and c[0]:
                    first = (c[0] or "Guest").split()[0]
        finally:
            db2.close()

        async def _send():
            await telegram_notify.notify_vendor_order_received(
                m.get("vendor_phone"),
                line,
                qty,
                order_id,
                first,
            )

        asyncio.run(_send())

    def get_order_receipt_url(self, order_id: str) -> dict | None:
        """Resolve Stripe receipt URL if payment was captured; callers fall back to in-app receipt."""
        db = SessionLocal()
        try:
            row = db.execute(
                text("SELECT stripe_payment_intent FROM orders WHERE id = :oid LIMIT 1"),
                {"oid": order_id},
            ).fetchone()
            if not row:
                return None
            pi = row[0]
        finally:
            db.close()
        if not pi:
            return {"receiptUrl": None}
        from app.services.stripe_service import stripe_service

        url = stripe_service.get_payment_receipt_url(pi)
        return {"receiptUrl": url}

    def get_vendor_orders(self, vendor_id: str):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("SELECT * FROM orders WHERE vendor_id = :vid ORDER BY created_at DESC"),
                {"vid": vendor_id}
            ).fetchall()
            return [{"orderId": r.id, "vendorId": r.vendor_id, "customerPhone": r.customer_phone,
                     "items": r.items if isinstance(r.items, list) else json.loads(r.items) if r.items else [],
                     "total": float(r.total) if r.total else 0, "status": r.status,
                     "pickupCode": r.pickup_code,
                     "createdAt": r.created_at.isoformat() if r.created_at else None} for r in rows]
        finally:
            db.close()

    def get_customer_orders(self, phone: str):
        norm = _normalize_phone(phone)
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""SELECT o.*, v.name as vendor_name FROM orders o
                        LEFT JOIN vendors v ON v.id = o.vendor_id
                        WHERE o.customer_phone IN (:p1, :p2) ORDER BY o.created_at DESC"""),
                {"p1": norm, "p2": phone},
            ).fetchall()
            return {
                "orders": [
                    {
                        "orderId": r.id,
                        "vendorId": r.vendor_id,
                        "vendorName": r.vendor_name,
                        "customerPhone": r.customer_phone,
                        "status": r.status,
                        "total": float(r.total) if r.total else 0,
                        "pickupCode": r.pickup_code,
                        "pickupQrCode": getattr(r, "pickup_qr_code", None),
                        "customerNoShow": bool(getattr(r, "customer_no_show", None)),
                        "stripeCapturedAt": r.stripe_captured_at.isoformat()
                        if getattr(r, "stripe_captured_at", None)
                        else None,
                        "items": r.items
                        if isinstance(r.items, list)
                        else json.loads(r.items)
                        if r.items
                        else [],
                        "createdAt": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()

    def update_status(self, order_id: str, status: str):
        db = SessionLocal()
        phone = None
        try:
            row = db.execute(
                text("SELECT customer_phone FROM orders WHERE id = :oid LIMIT 1"),
                {"oid": order_id},
            ).fetchone()
            phone = row[0] if row else None
            db.execute(text("UPDATE orders SET status = :s WHERE id = :oid"), {"s": status, "oid": order_id})
            db.commit()
        finally:
            db.close()
        if phone:
            inapp_events.try_publish(
                phone,
                {"type": "order", "subType": status, "orderId": order_id},
            )
        return {"orderId": order_id, "status": status}

    def get_recommendations(self, phone: str):
        return {"vendors": []}


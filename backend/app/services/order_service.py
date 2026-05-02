import json
import os
import random
import string
from app.db import SessionLocal
from sqlalchemy import text

from app.services import inapp_events

SERVICE_FEE_RATE = 0.13


class OrderService:
    # ── Place order against a flash deal (with Stripe checkout) ───────
    def place_deal_order(self, deal_id: str, customer_id: str, quantity: int, customer_phone: str) -> dict:
        db = SessionLocal()
        try:
            # Atomic quantity check + hold
            deal = db.execute(
                text("""
                    SELECT fd.*, v.name as vendor_name, v.phone as vendor_phone,
                           ST_Y(v.location::geometry) as lat, ST_X(v.location::geometry) as lng
                    FROM flash_deals fd
                    JOIN vendors v ON v.id = fd.vendor_id
                    WHERE fd.id = :did AND fd.status = 'active' AND fd.end_at > NOW()
                    FOR UPDATE
                """),
                {"did": deal_id}
            ).fetchone()

            if not deal:
                return {"error": "Deal not found or expired"}
            if deal.remaining_quantity < quantity:
                return {"error": "Not enough quantity available"}

            # Decrement quantity
            db.execute(
                text("""
                    UPDATE flash_deals
                    SET remaining_quantity = remaining_quantity - :qty
                    WHERE id = :did AND remaining_quantity >= :qty
                """),
                {"qty": quantity, "did": deal_id}
            )

            vendor_price = float(deal.deal_price or 0) * quantity
            service_fee = round(vendor_price * SERVICE_FEE_RATE, 2)
            customer_total = round(vendor_price + service_fee, 2)
            pickup_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

            result = db.execute(
                text("""
                    INSERT INTO orders (
                        id, vendor_id, customer_phone, deal_id, items, total,
                        service_fee, status, pickup_code, created_at
                    ) VALUES (
                        'o_' || substr(md5(random()::text), 1, 8),
                        :vendor_id, :customer_phone, :deal_id,
                        CAST(:items_json AS jsonb),
                        :total, :service_fee, 'pending_payment', :pickup_code, NOW()
                    ) RETURNING id
                """),
                {
                    "vendor_id": deal.vendor_id,
                    "customer_phone": customer_phone,
                    "deal_id": deal_id,
                    "items_json": json.dumps([{"name": deal.item_name, "quantity": quantity, "price": float(deal.deal_price or 0)}]),
                    "total": customer_total,
                    "service_fee": service_fee,
                    "pickup_code": pickup_code,
                }
            )
            row = result.fetchone()
            if row is None:
                raise RuntimeError("Failed to create order")
            
            order_id = row[0]
            db.commit()
            
        finally:
            db.close()

        # Create Stripe checkout session
        from app.services.stripe_service import stripe_service
        checkout = stripe_service.create_checkout_session(
            order_id=order_id,
            deal_id=deal_id,
            vendor_id=deal.vendor_id,
            item_name=deal.item_name,
            quantity=quantity,
            vendor_price=vendor_price,
        )

        return {
            "orderId": order_id,
            "checkoutUrl": checkout.get("checkout_url"),
            "pickupCode": pickup_code,
            "total": customer_total,
            "status": "pending_payment",
        }

    # ── Stripe webhook: payment succeeded ─────────────────────────────
    def on_payment_succeeded(self, order_id: str, payment_intent_id: str) -> dict:
        db = SessionLocal()
        try:
            db.execute(
                text("""
                    UPDATE orders
                    SET status = 'paid', stripe_payment_intent = :pi
                    WHERE id = :oid AND status = 'pending_payment'
                """),
                {"pi": payment_intent_id, "oid": order_id}
            )
            db.commit()
            # Get order + vendor details for notifications
            row = db.execute(
                text("""
                    SELECT o.*, v.phone as vendor_phone, v.name as vendor_name,
                           fd.end_at, fd.item_name as deal_item
                    FROM orders o
                    JOIN vendors v ON v.id = o.vendor_id
                    LEFT JOIN flash_deals fd ON fd.id = o.deal_id
                    WHERE o.id = :oid
                """),
                {"oid": order_id}
            ).fetchone()
        finally:
            db.close()

        if row:
            items = row.items if isinstance(row.items, list) else json.loads(row.items or "[]")
            qty = sum(i.get("quantity", 1) for i in items)
            end_str = row.end_at.strftime("%I:%M%p") if row.end_at else "end of deal"

            # Notify customer
            from app.services.notify_service import notify_service
            notify_service.notify_customer_confirmation(
                row.customer_phone,
                f"✅ Orden confirmada #{row.pickup_code}\n"
                f"{qty}x {row.deal_item} @ {row.vendor_name}\n"
                f"Recoge antes de {end_str}\n"
                f"Código: {row.pickup_code}"
            )
            # Notify vendor
            fe = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
            notify_service.notify_vendor_order(
                row.vendor_phone,
                f"Nueva orden #{row.pickup_code}\n"
                f"{qty}x {row.deal_item} - ${float(row.total or 0) - float(row.service_fee or 0):.2f}\n"
                f"Cliente: {row.customer_phone}\n"
                f"Pickup antes de {end_str}\n"
                f"Ver: {fe}/orders/{order_id}"
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

    # ── Legacy create_order (menu-based, no deal) ──────────────────────
    def create_order(self, payload) -> dict:
        db = SessionLocal()
        try:
            if hasattr(payload, 'vendorId'):
                vendor_id = payload.vendorId
                customer_phone = payload.customerPhone
                items = [{"itemId": i.itemId, "quantity": i.quantity} for i in payload.items]
            else:
                vendor_id = payload.get("vendorId")
                customer_phone = payload.get("customerPhone")
                items = payload.get("items", [])

            item_ids = [i["itemId"] for i in items]
            menu_items = db.execute(
                text("SELECT id, item_name, price FROM menus WHERE id = ANY(:ids)"),
                {"ids": item_ids}
            ).fetchall()
            menu_map = {m.id: {"name": m.item_name, "price": float(m.price)} for m in menu_items}

            order_items = []
            total = 0
            for item in items:
                item_id = item["itemId"]
                qty = item["quantity"]
                if item_id in menu_map:
                    m = menu_map[item_id]
                    order_items.append({"itemId": item_id, "name": m["name"], "price": m["price"], "quantity": qty})
                    total += m["price"] * qty

            pickup_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            result = db.execute(
                text("""
                    INSERT INTO orders (id, vendor_id, customer_phone, items, total, status, pickup_code, created_at)
                    VALUES ('o_' || substr(md5(random()::text),1,8), :vid, :phone,
                            CAST(:items AS jsonb), :total, 'pending', :code, NOW())
                    RETURNING id
                """),
                {"vid": vendor_id, "phone": customer_phone,
                 "items": json.dumps(order_items), "total": total, "code": pickup_code}
            )
            db.commit()
            row = result.fetchone()
            order_id = row[0] if row else None
            return {"orderId": order_id, "vendorId": vendor_id, "items": order_items,
                    "total": total, "status": "pending", "pickupCode": pickup_code}
        finally:
            db.close()

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
            return {"orderId": r.id, "vendorId": r.vendor_id, "vendorName": r.vendor_name,
                    "customerPhone": r.customer_phone, "items": items,
                    "total": float(r.total) if r.total else 0, "status": r.status,
                    "pickupCode": r.pickup_code,
                    "createdAt": r.created_at.isoformat() if r.created_at else None}
        finally:
            db.close()

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
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""SELECT o.*, v.name as vendor_name FROM orders o
                        LEFT JOIN vendors v ON v.id = o.vendor_id
                        WHERE o.customer_phone = :phone ORDER BY o.created_at DESC"""),
                {"phone": phone}
            ).fetchall()
            return {"orders": [{"orderId": r.id, "vendorId": r.vendor_id, "vendorName": r.vendor_name,
                                 "customerPhone": r.customer_phone, "status": r.status,
                                 "total": float(r.total) if r.total else 0,
                                 "pickupCode": r.pickup_code,
                                 "items": r.items if isinstance(r.items, list) else json.loads(r.items) if r.items else [],
                                 "createdAt": r.created_at.isoformat() if r.created_at else None} for r in rows]}
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


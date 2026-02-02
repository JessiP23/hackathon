import json
import random
import string
from app.db import SessionLocal
from sqlalchemy import text


class OrderService:
    def create_order(self, payload):
        db = SessionLocal()
        try:
            vendor_id = payload.get("vendorId")
            customer_phone = payload.get("customerPhone")
            items = payload.get("items", [])

            # Get menu items to calculate total
            item_ids = [i["itemId"] for i in items]
            menu_items = db.execute(
                text("SELECT id, item_name, price FROM menus WHERE id = ANY(:ids)"),
                {"ids": item_ids}
            ).fetchall()

            menu_map = {m.id: {"name": m.item_name, "price": float(m.price)} for m in menu_items}

            order_items = []
            total = 0
            for item in items:
                if item["itemId"] in menu_map:
                    m = menu_map[item["itemId"]]
                    order_items.append({
                        "itemId": item["itemId"],
                        "name": m["name"],
                        "price": m["price"],
                        "quantity": item["quantity"]
                    })
                    total += m["price"] * item["quantity"]

            pickup_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

            result = db.execute(
                text("""
                    INSERT INTO orders (id, vendor_id, customer_phone, items, total, status, pickup_code, created_at)
                    VALUES (
                        'o_' || substr(md5(random()::text), 1, 8),
                        :vendor_id,
                        :customer_phone,
                        :items::jsonb,
                        :total,
                        'pending',
                        :pickup_code,
                        NOW()
                    )
                    RETURNING id
                """),
                {
                    "vendor_id": vendor_id,
                    "customer_phone": customer_phone,
                    "items": json.dumps(order_items),
                    "total": total,
                    "pickup_code": pickup_code
                }
            )
            db.commit()
            order_id = result.fetchone()[0]

            return {
                "orderId": order_id,
                "vendorId": vendor_id,
                "items": order_items,
                "total": total,
                "status": "pending",
                "pickupCode": pickup_code
            }
        finally:
            db.close()

    def get_order(self, order_id: str):
        db = SessionLocal()
        try:
            r = db.execute(
                text("""
                    SELECT o.*, v.name as vendor_name 
                    FROM orders o 
                    LEFT JOIN vendors v ON v.id = o.vendor_id
                    WHERE o.id = :oid
                """),
                {"oid": order_id}
            ).fetchone()

            if not r:
                return None

            items = r.items if isinstance(r.items, list) else json.loads(r.items) if r.items else []

            return {
                "orderId": r.id,
                "vendorId": r.vendor_id,
                "vendorName": r.vendor_name,
                "customerPhone": r.customer_phone,
                "items": items,
                "total": float(r.total) if r.total else 0,
                "status": r.status,
                "pickupCode": r.pickup_code,
                "createdAt": r.created_at.isoformat() if r.created_at else None
            }
        finally:
            db.close()

    def get_vendor_orders(self, vendor_id: str):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT * FROM orders 
                    WHERE vendor_id = :vid 
                    ORDER BY created_at DESC
                """),
                {"vid": vendor_id}
            ).fetchall()

            return [
                {
                    "orderId": r.id,
                    "vendorId": r.vendor_id,
                    "customerPhone": r.customer_phone,
                    "items": r.items if isinstance(r.items, list) else json.loads(r.items) if r.items else [],
                    "total": float(r.total) if r.total else 0,
                    "status": r.status,
                    "pickupCode": r.pickup_code,
                    "createdAt": r.created_at.isoformat() if r.created_at else None
                }
                for r in rows
            ]
        finally:
            db.close()

    def get_customer_orders(self, phone: str):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT o.*, v.name as vendor_name 
                    FROM orders o 
                    LEFT JOIN vendors v ON v.id = o.vendor_id
                    WHERE o.customer_phone = :phone 
                    ORDER BY o.created_at DESC
                """),
                {"phone": phone}
            ).fetchall()

            return {
                "orders": [
                    {
                        "orderId": r.id,
                        "vendorId": r.vendor_id,
                        "vendorName": r.vendor_name,
                        "customerPhone": r.customer_phone,
                        "items": r.items if isinstance(r.items, list) else json.loads(r.items) if r.items else [],
                        "total": float(r.total) if r.total else 0,
                        "status": r.status,
                        "pickupCode": r.pickup_code,
                        "createdAt": r.created_at.isoformat() if r.created_at else None
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()

    def update_status(self, order_id: str, status: str):
        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE orders SET status = :status WHERE id = :oid"),
                {"status": status, "oid": order_id}
            )
            db.commit()
            return {"orderId": order_id, "status": status}
        finally:
            db.close()

    def get_recommendations(self, phone: str):
        """Get personalized recommendations based on order history"""
        db = SessionLocal()
        try:
            # Get items from past orders
            past_orders = db.execute(
                text("""
                    SELECT items FROM orders 
                    WHERE customer_phone = :phone
                    ORDER BY created_at DESC
                    LIMIT 10
                """),
                {"phone": phone}
            ).fetchall()

            # Extract item names from past orders
            past_item_names = []
            for order in past_orders:
                items = order.items if isinstance(order.items, list) else json.loads(order.items) if order.items else []
                for item in items:
                    if isinstance(item, dict) and "name" in item:
                        past_item_names.append(item["name"].lower())

            if not past_item_names:
                # No history, return popular vendors
                vendors = db.execute(
                    text("""
                        SELECT v.id, v.name, v.business_hours
                        FROM vendors v
                        WHERE EXISTS (SELECT 1 FROM menus m WHERE m.vendor_id = v.id)
                        LIMIT 5
                    """)
                ).fetchall()

                return {
                    "vendors": [
                        {
                            "vendorId": v.id,
                            "name": v.name,
                            "businessHours": v.business_hours,
                            "matchingItems": []
                        }
                        for v in vendors
                    ]
                }

            # Find vendors with similar items
            vendors = db.execute(
                text("""
                    SELECT DISTINCT v.id, v.name, v.business_hours
                    FROM vendors v
                    JOIN menus m ON m.vendor_id = v.id
                    WHERE v.id NOT IN (
                        SELECT DISTINCT vendor_id FROM orders WHERE customer_phone = :phone
                    )
                    LIMIT 20
                """),
                {"phone": phone}
            ).fetchall()

            results = []
            for v in vendors:
                menu_items = db.execute(
                    text("SELECT item_name, price FROM menus WHERE vendor_id = :vid"),
                    {"vid": v.id}
                ).fetchall()

                matching = []
                score = 0
                for item in menu_items:
                    item_lower = item.item_name.lower()
                    for past in past_item_names:
                        # Check for word overlap
                        past_words = set(past.split())
                        item_words = set(item_lower.split())
                        if past_words & item_words:
                            matching.append({"name": item.item_name, "price": float(item.price)})
                            score += 1
                            break

                if matching:
                    results.append({
                        "vendorId": v.id,
                        "name": v.name,
                        "businessHours": v.business_hours,
                        "matchingItems": matching[:3],
                        "score": score
                    })

            # Sort by score
            results.sort(key=lambda x: -x["score"])

            # Remove score from output
            for r in results:
                del r["score"]

            return {"vendors": results[:5]}
        finally:
            db.close()
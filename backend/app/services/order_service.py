import uuid
import json
import random
import string
from app.db import SessionLocal
from sqlalchemy import text


class OrderService:
    def place_order(self, payload):
        db = SessionLocal()
        try:
            order_id = f"o_{uuid.uuid4().hex[:8]}"
            pickup_code = ''.join(random.choices(string.digits, k=4))
            
            total = 0
            items_data = []
            
            for item in payload.items:
                menu_item = db.execute(
                    text("SELECT item_name, price FROM menus WHERE id = :id"),
                    {"id": item.itemId}
                ).fetchone()
                
                if menu_item:
                    item_total = float(menu_item.price) * item.quantity
                    total += item_total
                    items_data.append({
                        "itemId": item.itemId,
                        "name": menu_item.item_name,
                        "price": float(menu_item.price),
                        "quantity": item.quantity
                    })

            items_json = json.dumps(items_data)
            
            db.execute(
                text("""
                    INSERT INTO orders (id, vendor_id, customer_phone, items, total, status, pickup_code)
                    VALUES (:id, :vid, :phone, :items, :total, :status, :code)
                """),
                {
                    "id": order_id,
                    "vid": payload.vendorId,
                    "phone": payload.customerPhone or "guest",
                    "items": items_json,
                    "total": round(total, 2),
                    "status": "pending",
                    "code": pickup_code
                }
            )
            db.commit()

            return {
                "orderId": order_id,
                "pickupCode": pickup_code,
                "status": "pending",
                "total": round(total, 2),
                "items": items_data
            }
        finally:
            db.close()

    def get_order(self, order_id: str):
        db = SessionLocal()
        try:
            row = db.execute(
                text("""
                    SELECT o.id, o.vendor_id, o.customer_phone, o.items, o.total, 
                           o.status, o.pickup_code, o.created_at, v.name as vendor_name
                    FROM orders o
                    JOIN vendors v ON v.id = o.vendor_id
                    WHERE o.id = :id
                """),
                {"id": order_id}
            ).fetchone()

            if not row:
                return None

            return {
                "orderId": row.id,
                "vendorId": row.vendor_id,
                "vendorName": row.vendor_name,
                "customerPhone": row.customer_phone,
                "items": json.loads(row.items) if row.items else [],
                "total": float(row.total or 0),
                "status": row.status,
                "pickupCode": row.pickup_code,
                "createdAt": row.created_at.isoformat() if row.created_at else None
            }
        finally:
            db.close()

    def get_vendor_orders(self, vendor_id: str):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT id, customer_phone, items, total, status, pickup_code, created_at
                    FROM orders WHERE vendor_id = :vid
                    ORDER BY created_at DESC LIMIT 50
                """),
                {"vid": vendor_id}
            ).fetchall()

            return [
                {
                    "orderId": r.id,
                    "customerPhone": r.customer_phone,
                    "items": json.loads(r.items) if r.items else [],
                    "total": float(r.total or 0),
                    "status": r.status,
                    "pickupCode": r.pickup_code,
                    "createdAt": r.created_at.isoformat() if r.created_at else None
                }
                for r in rows
            ]
        finally:
            db.close()

    def update_status(self, order_id: str, status: str):
        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE orders SET status = :status WHERE id = :id"),
                {"id": order_id, "status": status}
            )
            db.commit()
            return {"orderId": order_id, "status": status}
        finally:
            db.close()

    def get_customer_orders(self, phone: str):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT o.id, o.vendor_id, o.items, o.total, o.status, 
                           o.pickup_code, o.created_at, v.name as vendor_name
                    FROM orders o
                    JOIN vendors v ON v.id = o.vendor_id
                    WHERE o.customer_phone = :phone
                    ORDER BY o.created_at DESC LIMIT 20
                """),
                {"phone": phone}
            ).fetchall()

            return [
                {
                    "orderId": r.id,
                    "vendorId": r.vendor_id,
                    "vendorName": r.vendor_name,
                    "items": json.loads(r.items) if r.items else [],
                    "total": float(r.total or 0),
                    "status": r.status,
                    "pickupCode": r.pickup_code,
                    "createdAt": r.created_at.isoformat() if r.created_at else None
                }
                for r in rows
            ]
        finally:
            db.close()
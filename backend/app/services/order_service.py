import uuid
import json
from app.db import SessionLocal
from sqlalchemy import text
from app.services.notify_service import NotifyService


class OrderService:
    def __init__(self):
        self.notifier = NotifyService()

    def place_order(self, payload):
        db = SessionLocal()
        try:
            order_id = f"o_{uuid.uuid4().hex[:8]}"
            
            # Calculate total from items
            total = 0.0
            items_with_prices = []
            
            for item in payload.items:
                # Get item price from menu
                menu_item = db.execute(
                    text("SELECT item_name, price FROM menus WHERE id = :id"),
                    {"id": item.itemId}
                ).fetchone()
                
                price = float(menu_item.price) if menu_item else (item.price or 0)
                item_total = price * item.quantity
                total += item_total
                
                items_with_prices.append({
                    "itemId": item.itemId,
                    "name": menu_item.item_name if menu_item else item.name,
                    "quantity": item.quantity,
                    "price": price,
                    "subtotal": item_total
                })
            
            # Build location point if provided
            location_sql = "NULL"
            params = {
                "id": order_id,
                "vendor_id": payload.vendorId,
                "customer_phone": payload.customerPhone,
                "items": json.dumps(items_with_prices),
                "total": total,
                "status": "pending"
            }
            
            if payload.lat and payload.lng:
                location_sql = "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography"
                params["lat"] = payload.lat
                params["lng"] = payload.lng
            
            db.execute(
                text(f"""
                    INSERT INTO orders (id, vendor_id, customer_phone, items, total, status, location)
                    VALUES (:id, :vendor_id, :customer_phone, :items::jsonb, :total, :status, {location_sql})
                """),
                params
            )

            # Get vendor phone for notification
            vendor = db.execute(
                text("SELECT name, phone FROM vendors WHERE id = :id"),
                {"id": payload.vendorId}
            ).fetchone()
            
            db.commit()
            
            # Notify vendor
            if vendor:
                order_summary = ", ".join([f"{i['name']} x{i['quantity']}" for i in items_with_prices])
                self.notifier.notify_vendor_order(
                    vendor_phone=vendor.phone,
                    message=f"New order #{order_id[-6:]}: {order_summary}. Total: ${total:.2f}"
                )
            
            return {
                "orderId": order_id,
                "status": "sent_to_vendor",
                "total": total,
                "items": items_with_prices
            }
        finally:
            db.close()

    def get_order(self, order_id: str):
        db = SessionLocal()
        try:
            row = db.execute(
                text("""
                    SELECT id, vendor_id, customer_phone, items, total, status, created_at
                    FROM orders WHERE id = :id
                """),
                {"id": order_id}
            ).fetchone()
            
            if not row:
                return None
            
            return {
                "orderId": row.id,
                "vendorId": row.vendor_id,
                "customerPhone": row.customer_phone,
                "items": row.items,
                "total": float(row.total) if row.total else 0,
                "status": row.status,
                "createdAt": row.created_at.isoformat() if row.created_at else None
            }
        finally:
            db.close()
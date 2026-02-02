import uuid
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
            db.execute(
                text(
                    """
                  INSERT INTO orders (id, vendor_id, customer_phone, status)
                  VALUES (:id, :vendor_id, :customer_phone, :status)
                """
                ),
                {
                    "id": order_id,
                    "vendor_id": payload.vendorId,
                    "customer_phone": payload.customerPhone,
                    "status": "sent_to_vendor",
                },
            )

            vendor = db.execute(
                text("SELECT phone FROM vendors WHERE id = :id"),
                {"id": payload.vendorId},
            ).fetchone()
            vendor_phone = vendor.phone if vendor else "UNKNOWN"
            db.commit()
        finally:
            db.close()

        self.notifier.notify_vendor_order(
            vendor_phone=vendor_phone,
            message=f"New order {order_id}: {payload.items}",
        )

        return {"orderId": order_id, "status": "sent_to_vendor"}

    def get_order(self, order_id):
        return {"order_id": order_id, "status": "preparing"}
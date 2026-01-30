from app.services.notify_service import NotifyService

class OrderService:
    def __init__(self):
        self.notifier = NotifyService()

    def place_order(self, payload):
        order_id = "o_456"

        self.notifier.notify_vendor_order(
            vendor_phone="VENDOR_PHONE_LOOKUP",
            message=f"New order {order_id}: {payload.items}"
        )

        return {
            "orderId": order_id, 
            "status": "sent_to_vendor"
        }
    
    def get_order(self, order_id):
        return {
            "order_id": order_id,
            "status": "preparing"
        }
from fastapi import APIRouter, HTTPException
from app.schemas.order import OrderCreate, OrderStatusUpdate
from app.services.order_service import OrderService

router = APIRouter()
service = OrderService()

@router.post("")
def place_order(payload: OrderCreate):
    return service.place_order(payload)

@router.get("/{order_id}")
def get_order(order_id: str):
    order = service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/vendor/{vendor_id}")
def get_vendor_orders(vendor_id: str):
    return service.get_vendor_orders(vendor_id)


@router.get("/customer/{phone}")
def get_customer_orders(phone: str):
    return service.get_customer_orders(phone)

@router.patch("/{order_id}/status")
def update_order_status(order_id: str, payload: OrderStatusUpdate):
    return service.update_status(order_id, payload.status)
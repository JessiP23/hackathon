from fastapi import APIRouter, HTTPException
from app.schemas.order import OrderCreate
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
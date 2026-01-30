from fastapi import APIRouter
from app.schemas.order import OrderCreate
from app.services.order_service import OrderService

router = APIRouter()
service = OrderService()

@router.post('')
def place_order(payload: OrderCreate):
    return service.place_order(payload)

@router.get('/{order_id}')
def get_order(order_id: str):
    return service.get_order(order_id)
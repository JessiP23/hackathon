from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.schemas.deal import DealCreate
from app.services.deal_service import DealService
from app.services.order_service import OrderService

router = APIRouter()
service = DealService()
order_svc = OrderService()


class DealOrderRequest(BaseModel):
    customerId: str = ""
    customerPhone: str
    quantity: int = 1
    redeemPoints: int = 0


@router.post("")
def create_deal(payload: DealCreate):
    return service.create_deal(payload)


@router.get("")
def get_deals(
    lat: float = Query(...),
    lng: float = Query(...),
):
    return service.find_nearby(lat, lng)


@router.get("/nearby")
def get_nearby_deals(
    lat: float = Query(...),
    lng: float = Query(...),
):
    return service.find_nearby(lat, lng)


@router.post("/{deal_id}/order")
def place_deal_order(deal_id: str, payload: DealOrderRequest):
    return order_svc.place_deal_order(
        deal_id=deal_id,
        customer_id=payload.customerId,
        quantity=payload.quantity,
        customer_phone=payload.customerPhone,
        redeem_points=max(0, int(payload.redeemPoints or 0)),
    )

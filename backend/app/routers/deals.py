from fastapi import APIRouter, Query
from app.schemas.deal import DealCreate
from app.services.deal_service import DealService

router = APIRouter()
service = DealService()

@router.post("")
def create_deal(payload: DealCreate):
    return service.create_deal(payload)

@router.get("")
def get_deals(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude")
):
    return service.find_nearby(lat, lng)

@router.get("/nearby")
def get_nearby_deals(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude")
):
    return service.find_nearby(lat, lng)
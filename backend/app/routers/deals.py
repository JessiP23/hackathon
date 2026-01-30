from fastapi import APIRouter
from app.schemas.deal import DealCreate
from app.services.deal_service import DealService

router = APIRouter()
service = DealService()

@router.post('')
def create_deal(payload: DealCreate):
    return service.create_deal(payload)

@router.get('/nearby')
def get_nearby_deals(lat: float, lon: float):
    return service.find_nearby(lat, lon)
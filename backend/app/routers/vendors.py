from fastapi import APIRouter
from app.schemas.vendor import VendorCreate, MenuUpload
from app.services.vendor_service import VendorService

router = APIRouter()
service = VendorService()

@router.post("")
def create_vendor(payload: VendorCreate):
    return service.create_vendor(payload)

@router.post("/menu")
def upload_menu(payload: MenuUpload):
    return service.upload_menu(payload)

@router.get("/nearby")
def get_nearby_vendors(query: str, lat: float, lon: float):
    return service.search_nearby(query, lat, lon)
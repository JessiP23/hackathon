from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from app.schemas.vendor import VendorCreate
from app.services.vendor_service import VendorService

router = APIRouter()
service = VendorService()

class AddItemRequest(BaseModel):
    item_name: str
    price: float
    description: str = ''

@router.post("")
def create_vendor(payload: VendorCreate):
    return service.create_vendor(payload)

@router.get("/nearby")
def get_nearby_vendors(
    query: str = Query("", description="Search term"),
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude")
):
    return service.search_nearby(query, lat, lng)

@router.get("/{vendor_id}")
def get_vendor(vendor_id: str):
    vendor = service.get_vendor(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.post("/{vendor_id}/menu")
async def upload_menu(vendor_id: str, file: UploadFile = File(...)):
    return await service.upload_menu(vendor_id, file)

@router.post("/{vendor_id}/menu/item")
def add_menu_item(
    vendor_id: str,
    payload: AddItemRequest
):
    return service.add_menu_item(vendor_id, payload.item_name, payload.price, payload.description)
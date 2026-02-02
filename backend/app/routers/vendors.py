from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.vendor import VendorCreate
from app.services.vendor_service import VendorService

router = APIRouter()
service = VendorService()

@router.post("")
def create_vendor(payload: VendorCreate):
    return service.create_vendor(payload)

@router.get("/{vendor_id}")
def get_vendor(vendor_id: str):
    vendor = service.get_vendor(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.post("/{vendor_id}/menu")
def upload_menu(vendor_id: str, file: UploadFile = File(...)):
    return service.upload_menu(vendor_id, file)

@router.get("/nearby")
def get_nearby_vendors(query: str = "", lat: float = 0.0, lng: float = 0.0):
    return service.search_nearby(query, lat, lng)
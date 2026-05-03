from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from app.schemas.vendor import VendorCreate
from app.services.vendor_service import VendorService
from app.services.deal_service import DealService

router = APIRouter()
service = VendorService()
deal_svc = DealService()


class AddItemRequest(BaseModel):
    itemName: str
    price: float
    description: str = ""


@router.post("")
def create_vendor(payload: VendorCreate):
    return service.create_vendor(payload)


@router.get("/nearby")
def nearby(query: str = "", lat: float = Query(...), lng: float = Query(...)):
    return service.search_nearby(query, lat, lng)


@router.get("/{vendor_id}")
def get_vendor(vendor_id: str):
    v = service.get_vendor(vendor_id)
    if not v:
        raise HTTPException(404, "Not found")
    return v


@router.get("/{vendor_id}/deals")
def vendor_active_deals(vendor_id: str):
    """Live flash deals for this stall (menu price is separate)."""
    return deal_svc.get_active_deals_for_vendor(vendor_id)


@router.post("/{vendor_id}/menu")
async def upload_menu(vendor_id: str, file: UploadFile = File(...)):
    return await service.upload_menu(vendor_id, file)


@router.post("/{vendor_id}/menu/item")
def add_item(vendor_id: str, payload: AddItemRequest):
    return service.add_menu_item(vendor_id, payload.itemName, payload.price, payload.description)

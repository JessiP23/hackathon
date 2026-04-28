from pydantic import BaseModel
from typing import Optional

class VendorCreate(BaseModel):
    name: str
    phone: str
    lat: float
    lng: float
    businessHours: Optional[str] = None

class MenuUpload(BaseModel):
    vendorId: str
    name: str
    phone: str
    distance_m: Optional[int] = None    
    menu: Optional[list] = None
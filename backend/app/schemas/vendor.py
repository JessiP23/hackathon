from pydantic import BaseModel

class VendorCreate(BaseModel):
    name: str
    phone: str
    lat: float
    lng: float
    businessHours: str | None = None

class MenuUpload(BaseModel):
    vendorId: str
    name: str
    phone: str
    distance_m: int | None = None
    menu: list | None = None
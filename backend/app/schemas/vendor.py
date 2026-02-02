from pydantic import BaseModel

class VendorCreate(BaseModel):
    name: str
    phone: str
    lat: float
    lng: float

class MenuUpload(BaseModel):
    vendorId: str
    menuImage: str
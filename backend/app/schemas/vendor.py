from pydantic import BaseModel

class VendorCreate(BaseModel):
    name: str
    phone: str
    lat: float
    lon: float

class MenuUpload(BaseModel):
    vendorId: str
    menuImage: str
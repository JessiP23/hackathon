from pydantic import BaseModel

class DealCreate(BaseModel):
    vendorId: str
    itemName: str
    originalPrice: float | None = None
    expiresAt: str
    dealPrice: float

class DealResponse(BaseModel):
    dealId: str
    item: str
    price: float
    originalPrice: float | None = None
    vendorId: str
    vendorName: str
    distance_m: int
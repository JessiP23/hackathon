from pydantic import BaseModel
from typing import Optional

class DealCreate(BaseModel):
    vendorId: str
    itemName: str
    originalPrice: Optional[float] = None
    expiresAt: str
    dealPrice: float

class DealResponse(BaseModel):
    dealId: str
    item: str
    price: float
    originalPrice: Optional[float] = None
    vendorId: str
    vendorName: str
    distance_m: int
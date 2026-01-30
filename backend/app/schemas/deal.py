from pydantic import BaseModel

class DealCreate(BaseModel):
    vendorId: str
    itemName: str
    dealPrice: float
    expiresAt: str
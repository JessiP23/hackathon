from pydantic import BaseModel
from typing import List


class OrderItem(BaseModel):
    itemId: str
    quantity: int


class Location(BaseModel):
    lat: float
    lng: float


class OrderCreate(BaseModel):
    vendorId: str
    items: List[OrderItem]
    location: Location | None = None
    customerPhone: str | None = None
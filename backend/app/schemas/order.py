from pydantic import BaseModel
from typing import List

class OrderItem(BaseModel):
    itemId: str
    name: str | None = None
    quantity: int
    price: float | None = None

class OrderCreate(BaseModel):
    vendorId: str
    items: List[OrderItem]
    lat: float | None = None
    lng: float | None = None
    customerPhone: str | None = None

class OrderResponse(BaseModel):
    orderId: str
    status: str
    total: float | None = None
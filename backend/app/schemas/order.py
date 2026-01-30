from pydantic import BaseModel
from typing import List

class OrderItem(BaseModel):
    name: str
    quantity: int
    price: float | None = None

class OrderCreate(BaseModel):
    vendorId: str
    items: List[OrderItem]
    customerPhone: str
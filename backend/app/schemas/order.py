from pydantic import BaseModel
from typing import List, Optional

class OrderItem(BaseModel):
    itemId: str
    name: str | None = None
    quantity: int
    price: float | None = None

class OrderItemCreate(BaseModel):
    itemId: str
    quantity: int

class OrderCreate(BaseModel):
    vendorId: str
    customerPhone: Optional[str] = None
    items: List[OrderItemCreate]

class OrderResponse(BaseModel):
    orderId: str
    status: str
    total: float | None = None

class OrderStatusUpdate(BaseModel):
    status: str
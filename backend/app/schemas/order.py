from pydantic import BaseModel
from typing import List, Optional

class OrderItem(BaseModel):
    itemId: str
    name: Optional[str] = None
    quantity: int
    price: Optional[float] = None

class OrderItemCreate(BaseModel):
    itemId: str
    quantity: int

class OrderCreate(BaseModel):
    vendorId: str
    customerPhone: Optional[str] = None
    items: List[OrderItemCreate]
    redeemPoints: int = 0

class OrderResponse(BaseModel):
    orderId: str
    status: str
    total: Optional[float] = None

class OrderStatusUpdate(BaseModel):
    status: str
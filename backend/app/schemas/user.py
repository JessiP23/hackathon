from pydantic import BaseModel
from typing import Literal

class UserCreate(BaseModel):
    phone: str
    role: Literal['customer', 'vendor']
    name: str | None = None

class UserResponse(BaseModel):
    userId: str
    phone: str
    role: str
    name: str | None = None
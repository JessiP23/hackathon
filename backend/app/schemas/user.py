from pydantic import BaseModel
from typing import Literal, Optional

class UserCreate(BaseModel):
    phone: str
    role: Literal['customer', 'vendor']
    name: Optional[str] = None
    # Referrer user id (u_…) or referral_code from ?ref=
    referredBy: Optional[str] = None

class UserResponse(BaseModel):
    userId: str
    phone: str
    role: str
    name: Optional[str] = None
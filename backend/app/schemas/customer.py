from pydantic import BaseModel, Field


class NotifyOptInRequest(BaseModel):
    lat: float
    lng: float
    radius: int = Field(default=10, ge=1, le=50)
    phone: str = Field(..., min_length=8, max_length=32)

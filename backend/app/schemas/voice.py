from pydantic import BaseModel
from typing import Optional

class VoiceRequest(BaseModel):
    transcript: str
    lat: float
    lng: float

class VoiceResponse(BaseModel):
    intent: str
    message: str
    results: Optional[list] = None
    deals: Optional[list] = None
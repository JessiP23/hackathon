from pydantic import BaseModel

class VoiceRequest(BaseModel):
    transcript: str
    lat: float
    lng: float

class VoiceResponse(BaseModel):
    intent: str
    message: str
    results: list | None = None
    deals: list | None = None
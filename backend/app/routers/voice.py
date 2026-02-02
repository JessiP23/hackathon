from fastapi import APIRouter
from app.schemas.voice import VoiceRequest
from app.services.voice_service import VoiceService

router = APIRouter()
service = VoiceService()

@router.post("/voice")
def handle_voice(payload: VoiceRequest):
    return service.process_voice_query(
        transcript=payload.transcript,
        lat=payload.lat,
        lng=payload.lng
    )
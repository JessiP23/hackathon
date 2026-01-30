from fastapi import APIRouter
from app.services.voice_service import VoiceService

router = APIRouter()
service = VoiceService()

@router.post("/voice")
def handle_voice(payload: dict):
    transcript = payload["transcript"]
    lat = payload["lat"]
    lon = payload["lon"]

    return service.process_voice_query(transcript, lat, lon)
import os
import requests

API_KEY = 'sk_8793099b615ebdd6228072ac1ba6564b80ff8bc6271d38c2'
BASE_URL = "https://api.elevenlabs.io/v1"

def text_to_speech(text: str, voice: str = "alloy") -> bytes:
    headers = {"xi-api-key": API_KEY, "Content-Type": "application/json"}
    payload = {"text": text, "voice": voice, "format": "mp3"}
    response = requests.post(f"{BASE_URL}/text-to-speech", json=payload, headers=headers)
    response.raise_for_status()
    return response.content

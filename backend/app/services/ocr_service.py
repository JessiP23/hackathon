import re
import os
import json
import base64
from io import BytesIO

try:
    from PIL import Image
    PIL_OK = True
except ImportError:
    PIL_OK = False

try:
    from groq import Groq
    GROQ_OK = True
except ImportError:
    GROQ_OK = False

GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

_OCR_PROMPT = (
    "Extract all menu items from this image. Return ONLY a JSON object with "
    "key 'items'. Each item: {\"name\": string, \"price\": number|null, "
    "\"description\": string|null, \"category\": string|null}. "
    "Handle Spanish and English text equally. "
    "If prices are in pesos (MXN), keep as-is. "
    "If a price is unclear or missing, set price: null. "
    "Do not fabricate items not visible in the image. "
    "Categories: food, drink, dessert, combo, other."
)


class OCRService:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not (GROQ_OK and api_key):
            raise RuntimeError("Groq client not configured")
        self._client: Groq = Groq(api_key=api_key)

    def extract_items(self, image_bytes: bytes):
        if self._client:
            return self._groq_extract(image_bytes)
        return []

    def _groq_extract(self, image_bytes: bytes, attempt: int = 0):
        
        try:
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            resp = self._client.chat.completions.create(
                model=GROQ_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": _OCR_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                            },
                        ],
                    }
                ],
                max_tokens=1024,
            )
            raw = resp.choices[0].message.content or ""
            # Strip markdown fences
            raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
            data = json.loads(raw)
            items = data.get("items", [])
            print(f"Groq OCR: extracted {len(items)} items")
            return [self._normalise(i) for i in items]
        except Exception as e:
            print(f"Groq OCR error (attempt {attempt}): {e}")
            if attempt < 2:
                return self._groq_extract(image_bytes, attempt + 1)
            return []

    def _normalise(self, item: dict) -> dict:
        return {
            "name": str(item.get("name") or "").strip(),
            "price": float(item["price"]) if item.get("price") is not None else None,
            "description": item.get("description"),
            "category": item.get("category"),
        }
import re
import os
import json
import base64
import tempfile
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

_paddle_engine = None


def _paddle_ocr_engine():
    global _paddle_engine
    if _paddle_engine is False:
        return None
    if _paddle_engine is not None:
        return _paddle_engine
    try:
        from paddleocr import PaddleOCR

        lang = os.getenv("PADDLE_OCR_LANG", "es")
        _paddle_engine = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        return _paddle_engine
    except Exception as e:
        print(f"[OCR] PaddleOCR unavailable: {e}")
        _paddle_engine = False
        return None


class OCRService:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY", "")
        self._client = Groq(api_key=api_key) if GROQ_OK and api_key else None

    def extract_items(self, image_bytes: bytes):
        use_paddle = os.getenv("USE_PADDLE_OCR", "1").strip().lower() in ("1", "true", "yes")
        items = []
        if use_paddle:
            items = self._paddle_extract(image_bytes)
            if len(items) >= 2:
                return items
        if self._client:
            groq_items = self._groq_extract(image_bytes)
            if groq_items:
                return groq_items
        return items

    def _paddle_extract(self, image_bytes: bytes):
        ocr = _paddle_ocr_engine()
        if not ocr:
            return []

        try:
            if PIL_OK:
                img = Image.open(BytesIO(image_bytes)).convert("RGB")
                tmp_suffix = ".jpg"
                fd = tempfile.NamedTemporaryFile(suffix=tmp_suffix, delete=False)
                try:
                    img.save(fd.name, format="JPEG", quality=92)
                    path = fd.name
                finally:
                    fd.close()
            else:
                fd = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                try:
                    fd.write(image_bytes)
                    path = fd.name
                finally:
                    fd.close()

            try:
                result = ocr.ocr(path, cls=True)
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass

            return self._paddle_lines_to_items(result)
        except Exception as e:
            print(f"Paddle OCR error: {e}")
            return []

    def _paddle_lines_to_items(self, result):
        if not result or not result[0]:
            return []

        rows = []
        for line in result[0]:
            box = line[0]
            text = line[1][0]
            conf = float(line[1][1])
            y = float(box[0][1])
            rows.append((y, text.strip(), conf))

        rows.sort(key=lambda x: x[0])
        price_at_end = re.compile(
            r"^(.+?)[\s\-–—:]+(?:\$|USD|MXN|€)?\s*(\d+(?:[.,]\d{1,2})?)\s*$",
            re.IGNORECASE,
        )
        lone_price = re.compile(r"^(?:\$|USD|MXN|€)?\s*(\d+(?:[.,]\d{1,2})?)\s*$", re.IGNORECASE)

        items = []
        pending_name = None

        for _, text, conf in rows:
            if conf < 0.35:
                continue
            m = price_at_end.match(text)
            if m:
                name = m.group(1).strip().strip("·•-")
                raw_p = m.group(2).replace(",", ".")
                try:
                    price = float(raw_p)
                except ValueError:
                    price = None
                if name:
                    items.append(self._normalise({"name": name, "price": price}))
                continue
            m2 = lone_price.match(text)
            if m2 and pending_name:
                raw_p = m2.group(1).replace(",", ".")
                try:
                    price = float(raw_p)
                except ValueError:
                    price = None
                items.append(self._normalise({"name": pending_name, "price": price}))
                pending_name = None
                continue

            if not lone_price.match(text):
                pending_name = text.strip()

        # Dedupe empty names
        return [i for i in items if i.get("name")]

    def _groq_extract(self, image_bytes: bytes, attempt: int = 0):
        if not self._client:
            return []

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

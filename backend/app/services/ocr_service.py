import re
import uuid
from io import BytesIO
from PIL import Image

try:
    import pytesseract
    TESSERACT_OK = True
except ImportError:
    TESSERACT_OK = False

class OCRService:
    def extract_items(self, image_bytes: bytes) -> list[dict]:
        if not TESSERACT_OK:
            return []

        try:
            img = Image.open(BytesIO(image_bytes)).convert("L")
            text = pytesseract.image_to_string(img, config="--psm 6")
            
            return self._parse(text)
        except Exception as e:
            print(f"OCR error: {e}")
            return []

    def _parse(self, text: str) -> list[dict]:
        items = []
        
        for line in text.split("\n"):
            line = line.strip()
            if len(line) < 4:
                continue

            match = re.search(r"\$?(\d{1,3}\.?\d{0,2})\s*$", line)
            if not match:
                continue

            try:
                price = float(match.group(1))
            except ValueError:
                continue

            if price <= 0 or price > 200:
                continue

            name = line[:match.start()].strip()
            name = re.sub(r"[._\-…]+$", "", name).strip()

            if len(name) < 2:
                continue

            items.append({
                "id": f"m_{uuid.uuid4().hex[:8]}",
                "name": name,
                "price": round(price, 2),
                "description": ""
            })

        return items

ocr = OCRService()
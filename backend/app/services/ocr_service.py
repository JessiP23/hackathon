import re
import uuid
from io import BytesIO
from PIL import Image

try:
    import pytesseract
    TESSERACT_OK = True
    print("✓ Tesseract is available")
except ImportError:
    TESSERACT_OK = False
    print("✗ Tesseract not installed")


class OCRService:
    def extract_items(self, image_bytes: bytes) -> list[dict]:
        if not TESSERACT_OK:
            return []

        try:
            img = Image.open(BytesIO(image_bytes))
            if img.mode != "L":
                img = img.convert("L")

            text = pytesseract.image_to_string(img, config="--psm 6")
            print(f"OCR Raw:\n{text}\n")

            items = self._parse(text)
            print(f"OCR: Extracted {len(items)} items")
            return items

        except Exception as e:
            print(f"OCR Error: {e}")
            return []

    def _parse(self, text: str) -> list[dict]:
        items = []
        lines = [l.strip() for l in text.split("\n") if l.strip()]

        # Skip words for placeholder/junk lines
        skip_words = ["insert", "description", "placeholder", "logo", "your", "menu", "profile"]

        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Skip junk lines
            if any(w in line.lower() for w in skip_words):
                # But check if this line has a price - pair with previous item
                price_match = re.search(r"\$(\d+(?:\.\d{2})?)", line)
                if price_match and items:
                    # Update last item's price if it was 0
                    if items[-1]["price"] == 0:
                        items[-1]["price"] = float(price_match.group(1))
                i += 1
                continue

            # Skip very short or junk lines
            if len(line) < 3 or line.replace(" ", "").isdigit():
                i += 1
                continue

            # Clean line of OCR artifacts
            clean = re.sub(r"^[°•·\-=£$sSi:\[\]|]+\s*", "", line).strip()
            if len(clean) < 3:
                i += 1
                continue

            # Check if price is in this line
            price = 0
            name = clean
            price_match = re.search(r"\$?(\d+(?:\.\d{2})?)\s*$", clean)
            if price_match:
                price = float(price_match.group(1))
                name = clean[:price_match.start()].strip()

            # If no price, check next line for price
            if price == 0 and i + 1 < len(lines):
                next_line = lines[i + 1]
                price_match = re.search(r"\$(\d+(?:\.\d{2})?)", next_line)
                if price_match:
                    price = float(price_match.group(1))

            # Clean up name
            name = re.sub(r"[._\-…]+$", "", name).strip()

            # Add if valid
            if name and len(name) >= 3 and price > 0 and price < 500:
                items.append({
                    "id": f"m_{uuid.uuid4().hex[:8]}",
                    "name": name,
                    "price": round(price, 2),
                    "description": ""
                })

            i += 1

        return items


ocr = OCRService()
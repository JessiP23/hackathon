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
    print("✗ Tesseract not installed - run: pip install pytesseract")


class OCRService:
    """Simple menu OCR using Tesseract"""

    def extract_items(self, image_bytes: bytes) -> list[dict]:
        """Extract menu items from image bytes"""
        if not TESSERACT_OK:
            print("OCR: Tesseract not available")
            return []

        try:
            # Load image
            img = Image.open(BytesIO(image_bytes))
            print(f"OCR: Image loaded - {img.size[0]}x{img.size[1]} {img.mode}")

            # Convert to grayscale for better OCR
            if img.mode != "L":
                img = img.convert("L")

            # Run OCR
            text = pytesseract.image_to_string(img, config="--psm 6")
            
            print(f"OCR: Raw text extracted:\n{'='*40}\n{text}\n{'='*40}")

            # Parse the text
            items = self._parse(text)
            
            print(f"OCR: Extracted {len(items)} items: {items}")
            
            return items

        except Exception as e:
            print(f"OCR Error: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _parse(self, text: str) -> list[dict]:
        """Parse text into menu items with prices"""
        items = []
        lines = text.split("\n")
        
        # Skip common placeholder/template text
        skip_phrases = [
            "insert", "description", "placeholder", "your menu", 
            "add item", "edit", "delete", "example"
        ]

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            
            if len(line) < 2:
                continue

            # Skip placeholder text
            if any(phrase in line.lower() for phrase in skip_phrases):
                print(f"OCR: Skipping placeholder line: {line}")
                continue

            # Try to find price in current line or next line
            price = None
            name = line
            
            # Pattern 1: Price at end of line ($5.99 or 5.99)
            price_match = re.search(r"\$?\s*(\d{1,3}(?:\.\d{2})?)\s*$", line)
            if price_match:
                price = float(price_match.group(1))
                name = line[:price_match.start()].strip()
            
            # Pattern 2: Price on next line
            elif i < len(lines):
                next_line = lines[i].strip()
                price_match = re.search(r"^\$?\s*(\d{1,3}(?:\.\d{2})?)\s*$", next_line)
                if price_match:
                    price = float(price_match.group(1))
                    i += 1  # Skip the price line

            # Clean up name
            name = re.sub(r"[._\-…•·]+$", "", name).strip()
            name = re.sub(r"^[._\-…•·]+", "", name).strip()

            # Validate
            if not name or len(name) < 2:
                continue
            if not price or price <= 0 or price > 500:
                continue
            # Skip if name is just numbers or single character repeated
            if name.replace(" ", "").isdigit():
                continue

            items.append({
                "id": f"m_{uuid.uuid4().hex[:8]}",
                "name": name,
                "price": round(price, 2),
                "description": ""
            })

        return items


# Singleton
ocr = OCRService()
"""
Deal Parser Agent — uses Groq llama-3.3-70b-versatile to parse vendor
text messages into structured flash deal objects.
"""
import os
import json
import re
from datetime import datetime, timezone, timedelta

try:
    from groq import Groq
    GROQ_OK = True
except ImportError:
    GROQ_OK = False

GROQ_MODEL = "llama-3.3-70b-versatile"

_DEAL_PARSE_PROMPT = """Parse this vendor message into a flash deal. Extract all available fields.
Return ONLY JSON (no markdown, no explanation):
{{
  "item_name": string,
  "original_price": number|null,
  "deal_price": number|null,
  "discount_pct": number|null,
  "quantity": integer|null,
  "start_time": ISO_string|null,
  "end_time": ISO_string|null,
  "radius_miles": float,
  "currency": "USD"|"MXN"
}}

Rules:
- '2x1' means discount_pct = 50
- '50%' means discount_pct = 50
- 'mitad de precio' means discount_pct = 50
- 'half price' means discount_pct = 50
- If only end time given, start_time = null (means now)
- Times like '5pm' should be parsed relative to today's date in the vendor's timezone
- Quantities like '20 tacos' means quantity = 20
- If no quantity mentioned, set quantity = null
- Default radius_miles = 10
- Default currency = "USD"
- If message contains '$' or dollar sign, currency = "USD"
- If message contains 'pesos' or 'MXN', currency = "MXN"

Vendor message: {message}
Current datetime (ISO): {now}
Vendor timezone: {tz}
"""


class DealParserService:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        self._client = Groq(api_key=api_key) if GROQ_OK and api_key else None

    def parse(self, message: str, vendor_tz: str = "UTC") -> dict:
        """Parse a vendor message into a structured deal dict. Returns partial dict on failure."""
        now = datetime.now(timezone.utc).isoformat()
        if not self._client:
            return self._fallback_parse(message)

        prompt = _DEAL_PARSE_PROMPT.format(message=message, now=now, tz=vendor_tz)
        try:
            resp = self._client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=512,
                temperature=0.1,
            )
            raw = resp.choices[0].message.content or ""
            raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
            data = json.loads(raw)
            # Ensure defaults
            data.setdefault("radius_miles", 10.0)
            data.setdefault("currency", "USD")
            return data
        except Exception as e:
            print(f"DealParser error: {e}")
            return self._fallback_parse(message)

    def _fallback_parse(self, message: str) -> dict:
        lower = message.lower()
        now = datetime.now(timezone.utc)
        discount = None
        if "2x1" in lower or "2-por-1" in lower or "mitad" in lower or "half price" in lower:
            discount = 50
        pct = re.search(r"(\d{1,2})\s*%", lower)
        if pct:
            discount = float(pct.group(1))

        nums = [float(n) for n in re.findall(r"\$?\b(\d+(?:\.\d+)?)\b", lower)]
        quantity = None
        qty_match = re.search(r"(\d+)\s*(?:porciones|servings|orders|piezas|pcs)", lower)
        if qty_match:
            quantity = int(qty_match.group(1))
        elif nums and re.search(r"\b(tacos?|quesadillas?|tamales?|tortas?)\b", lower):
            quantity = int(nums[-1]) if len(nums) > 1 and nums[-1] <= 200 else None

        deal_price = None
        if discount is None and nums:
            price_candidates = [n for n in nums if n != quantity]
            if price_candidates:
                deal_price = price_candidates[-1]

        end_time = None
        time_match = re.search(r"(?:hasta|til|until|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", lower)
        if not time_match:
            time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", lower)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2) or 0)
            meridian = time_match.group(3)
            if meridian == "pm" and hour < 12:
                hour += 12
            if meridian == "am" and hour == 12:
                hour = 0
            end_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if end_dt <= now:
                end_dt += timedelta(days=1)
            end_time = end_dt.isoformat()

        words = re.sub(r"\b(flash|deal|oferta|promo|descuento|hasta|til|until|am|pm|porciones|servings|orders)\b", " ", lower)
        words = re.sub(r"\d+(?:\.\d+)?|[$%:-]", " ", words)
        item = " ".join(w for w in words.split() if len(w) > 1).strip() or None

        return {
            "item_name": item,
            "end_time": end_time,
            "quantity": quantity,
            "deal_price": deal_price,
            "discount_pct": discount,
            "original_price": None,
            "start_time": now.isoformat() if end_time else None,
            "radius_miles": 10.0,
            "currency": "MXN" if "mxn" in lower or "pesos" in lower else "USD",
        }

    def first_missing_field(self, deal: dict):
        """Returns the first missing required field (or None if complete)."""
        if not deal.get("item_name"):
            return "item_name"
        if not deal.get("end_time"):
            return "end_time"
        if deal.get("quantity") is None:
            return "quantity"
        if deal.get("deal_price") is None and deal.get("discount_pct") is None:
            return "price"
        return None

    def clarification_question(self, missing_field: str, lang: str = "es") -> str:
        questions = {
            "item_name": {
                "es": "¿Qué artículo quieres poner en oferta?",
                "en": "What item do you want to put on deal?"
            },
            "end_time": {
                "es": "¿Hasta qué hora dura el deal?",
                "en": "Until what time does the deal last?"
            },
            "quantity": {
                "es": "¿Cuántas porciones tienes disponibles?",
                "en": "How many portions do you have available?"
            },
            "price": {
                "es": "¿Cuál es el precio del deal?",
                "en": "What is the deal price?"
            },
        }
        bucket = questions.get(missing_field, {})
        return bucket.get(lang, bucket.get("en", ""))


deal_parser = DealParserService()

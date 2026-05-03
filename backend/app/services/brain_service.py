"""Brain pricing + Groq summaries for InfraStreet vendor bot."""
from __future__ import annotations

import json
import os
import re

try:
    from groq import Groq

    GROQ_OK = True
except ImportError:
    GROQ_OK = False

GROQ_MODEL = "llama-3.3-70b-versatile"


async def reverse_geocode_neighborhood(lat: float, lng: float) -> str:
    """Human-readable area label via OSM Nominatim (same stack as forward geocode)."""
    try:
        import httpx

        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": 1,
                },
                headers={"User-Agent": "InfraStreet/1.0 (vendor-bot)"},
            )
            data = resp.json()
            addr = data.get("address") or {}
            for key in ("neighbourhood", "suburb", "quarter", "city_district", "district", "borough", "village", "town", "city"):
                v = addr.get(key)
                if v:
                    return str(v)
            name = data.get("display_name") or ""
            return name.split(",")[0].strip() if name else "your area"
    except Exception:
        return "your area"


def compute_brain_deal_price(menu_price: float, price_floor: float | None, urgency: float) -> float:
    """Map vendor brain_urgency_threshold (0.45 aggressive .. 0.70 conservative) to a deal price >= floor."""
    mp = float(menu_price)
    floor = float(price_floor) if price_floor is not None else max(0.01, round(mp * 0.5, 2))
    u = float(urgency or 0.55)
    u = max(0.45, min(0.70, u))
    span = 0.70 - 0.45
    t = (0.70 - u) / span if span else 0.5
    discount = 0.15 + t * 0.20
    raw = mp * (1.0 - discount)
    return max(floor, round(raw, 2))


def groq_brain_why_sentence(factors: dict) -> str:
    """Single plain-English sentence (<15 words), no jargon."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not GROQ_OK or not api_key:
        return "Slow sales today — pushing a discount to clear inventory."

    payload = json.dumps(factors, default=str)
    try:
        groq = Groq(api_key=api_key)
        resp = groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Urgency data (JSON): {payload}\n"
                        "Write ONE short reason a food stall should discount now. "
                        "Max 15 words. Plain English only, no jargon, no quotes."
                    ),
                }
            ],
            max_tokens=60,
            temperature=0.3,
        )
        raw = (resp.choices[0].message.content or "").strip()
        raw = re.sub(r'^["\']|["\']$', "", raw)
        if raw:
            return raw[:200]
    except Exception as e:
        print(f"[Brain] groq_why error: {e}", flush=True)
    return "Slow sales right now — a quick deal should help move plates."

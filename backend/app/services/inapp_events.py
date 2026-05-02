"""
In-app real-time notifications via Redis pub/sub.

- Producers: notify_service (deals), order flows — call try_publish(phone, payload).
- Consumer: GET /customers/inapp/stream?phone= (SSE) — one channel per normalized phone.

Requires REDIS_URL (same as agent / rate limits). Without Redis, publishes are no-ops and
the stream returns a single system event then closes.
"""
from __future__ import annotations

import json
import os
from typing import Any

REDIS_URL = os.getenv("REDIS_URL", "").strip()


def _channel(phone: str) -> str:
    from app.services.customer_service import _normalize_phone

    n = _normalize_phone(phone or "")
    return f"inapp:{n}" if n else "inapp:invalid"


def try_publish(phone: str, payload: dict[str, Any]) -> bool:
    """Fire-and-forget fan-out to any open browser tab for this customer phone."""
    if not REDIS_URL or not phone:
        return False
    try:
        import redis

        r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        r.publish(_channel(phone), json.dumps(payload, default=str))
        r.close()
        return True
    except Exception as e:
        print(f"[inapp] publish error: {e}", flush=True)
        return False

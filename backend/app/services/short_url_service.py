"""6-char deal short codes in Redis → full flash_deal id (v3.2)."""
from __future__ import annotations

import os
import secrets
import string

try:
    import redis

    REDIS_OK = True
except ImportError:
    REDIS_OK = False

_ALPHABET = string.ascii_letters + string.digits
_TTL_SECONDS = int(os.getenv("SHORT_LINK_TTL_SECONDS", str(90 * 86400)))
_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


def _redis():
    if not REDIS_OK:
        return None
    try:
        r = redis.from_url(_REDIS_URL, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


def allocate_for_deal(deal_id: str) -> str:
    """Return existing code for deal_id or create a new 6-char code."""
    r = _redis()
    if not r:
        tail = deal_id.replace("fd_", "")[-6:] if deal_id else "XXXXXX"
        return tail if len(tail) == 6 else (deal_id or "deal")[-6:].ljust(6, "0")[:6]

    existing = r.get(f"deal:shortid:{deal_id}")
    if existing:
        return existing

    for _ in range(24):
        code = "".join(secrets.choice(_ALPHABET) for _ in range(6))
        key = f"deal:short:{code}"
        if r.set(key, deal_id, nx=True, ex=_TTL_SECONDS):
            r.setex(f"deal:shortid:{deal_id}", _TTL_SECONDS, code)
            return code

    return deal_id[-6:] if len(deal_id) >= 6 else secrets.token_hex(3)


def resolve_token(token: str) -> str | None:
    """Map short code or pass through full deal id."""
    t = (token or "").strip()
    if not t:
        return None
    if t.startswith("fd_"):
        return t
    r = _redis()
    if not r:
        return None
    deal_id = r.get(f"deal:short:{t}")
    return deal_id if deal_id else None

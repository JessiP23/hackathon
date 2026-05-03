import json
import os

import redis.asyncio as aioredis
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.customer import NotifyOptInRequest
from app.services.customer_service import CustomerService, _normalize_phone

router = APIRouter()
_service = CustomerService()


@router.post("/notify_opt_in")
def notify_opt_in(payload: NotifyOptInRequest):
    """§5E empty state — create/update customer, enable alerts, SMS OTP when Twilio configured."""
    return _service.notify_opt_in(payload.lat, payload.lng, payload.radius, payload.phone)


@router.get("/inapp/stream")
async def inapp_stream(phone: str = Query(..., min_length=5)):
    """SSE: real-time in-app notifications for this customer (Redis pub/sub). Phone must match onboarded normalization."""
    norm = _normalize_phone(phone)
    if not norm:
        raise HTTPException(status_code=400, detail="invalid phone")

    url = os.getenv("REDIS_URL", "").strip()
    if url and "://" not in url:
        url = f"redis://{url}"
    ch = f"inapp:{norm}"

    async def event_gen():
        if not url:
            yield f"data: {json.dumps({'type': 'system', 'detail': 'redis_unset'})}\n\n"
            return
        try:
            client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        except ValueError:
            yield f"data: {json.dumps({'type': 'system', 'detail': 'redis_unset'})}\n\n"
            return
        pubsub = client.pubsub()
        await pubsub.subscribe(ch)
        try:
            yield f"data: {json.dumps({'type': 'system', 'detail': 'connected'})}\n\n"
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=25.0)
                if msg and msg.get("type") == "message" and msg.get("data"):
                    yield f"data: {msg['data']}\n\n"
                else:
                    yield ": ping\n\n"
        finally:
            try:
                await pubsub.unsubscribe(ch)
            except Exception:
                pass
            await pubsub.aclose()
            await client.aclose()

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

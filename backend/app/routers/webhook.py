"""
Inbound WhatsApp/SMS webhook router.
Receives messages from the Meta Cloud API (WhatsApp) or Textbelt/Twilio (SMS)
and routes them to the InfraStreet agent.
"""
from fastapi import APIRouter, Request, HTTPException
from app.services.agent_service import agent_service

router = APIRouter()


# ── WhatsApp Cloud API webhook ─────────────────────────────────────────
@router.get("/webhook/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta webhook verification challenge."""
    import os
    params = dict(request.query_params)
    if params.get("hub.verify_token") == os.getenv("WHATSAPP_VERIFY_TOKEN", "infrastreet"):
        return int(params.get("hub.challenge", "0"))
    raise HTTPException(403, "Forbidden")


@router.post("/webhook/whatsapp")
async def whatsapp_inbound(request: Request):
    """Receive WhatsApp messages from Meta Cloud API."""
    try:
        body = await request.json()
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        for msg in messages:
            phone = msg.get("from", "")
            msg_type = msg.get("type", "text")
            text_body = ""
            media_url = None

            if msg_type == "text":
                text_body = msg.get("text", {}).get("body", "")
            elif msg_type in ("image", "video"):
                media = msg.get(msg_type, {})
                media_id = media.get("id")
                if media_id:
                    media_url = await _resolve_whatsapp_media(media_id)
                text_body = media.get("caption", "")
            elif msg_type == "audio":
                # Ignore audio for now
                continue

            if phone:
                reply = await agent_service.handle_vendor_message(phone, text_body, media_url)
                from app.services.notify_service import notify_service
                await notify_service.send_message(phone, reply, "whatsapp")

    except Exception as e:
        print(f"[Webhook/WhatsApp] Error: {e}")
    return {"status": "ok"}


async def _resolve_whatsapp_media(media_id: str) -> str:
    import os, httpx
    token = os.getenv("WHATSAPP_TOKEN", "")
    if not token:
        return ''
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"https://graph.facebook.com/v19.0/{media_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            url = r.json().get("url")
            return url
    except Exception:
        return ''


# ── SMS webhook (Textbelt / generic) ──────────────────────────────────
@router.post("/webhook/sms")
async def sms_inbound(request: Request):
    """Receive inbound SMS. Compatible with Textbelt reply webhook format."""
    try:
        form = await request.form()
        phone = str(form.get("fromNumber") or form.get("From") or "")
        text_body = str(form.get("text") or form.get("Body") or "")
        if phone and text_body:
            reply = await agent_service.handle_vendor_message(phone, text_body)
            from app.services.notify_service import notify_service
            await notify_service.send_message(phone, reply, "sms")
    except Exception as e:
        print(f"[Webhook/SMS] Error: {e}")
    return {"status": "ok"}

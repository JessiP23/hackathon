"""Telegram Bot webhook — vendors DM the bot (InfraStreet AI Agent v3.1)."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request

from app.services.agent_service import agent_service
from app.services import telegram_client

router = APIRouter()

WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()


def _tg_phone(chat_id: int) -> str:
    return f"tg:{chat_id}"


def _inline_for_step(step: str | None) -> dict | None:
    if step == "awaiting_deal_confirm":
        return {
            "inline_keyboard": [
                [{"text": "SI", "callback_data": "deal_yes"}, {"text": "NO", "callback_data": "deal_no"}],
            ]
        }
    if step == "awaiting_menu_confirm":
        return {
            "inline_keyboard": [
                [{"text": "SI", "callback_data": "menu_yes"}, {"text": "Editar", "callback_data": "menu_no"}],
            ]
        }
    return None


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    if WEBHOOK_SECRET:
        if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    update = await request.json()

    if "callback_query" in update:
        cq = update["callback_query"]
        cq_id = cq["id"]
        chat_id = cq["message"]["chat"]["id"]
        data = (cq.get("data") or "").strip()
        phone = _tg_phone(chat_id)

        await telegram_client.answer_callback_query(cq_id)

        if data == "deal_yes":
            body = "SI"
        elif data == "deal_no":
            body = "no"
        elif data == "menu_yes":
            body = "SI"
        elif data == "menu_no":
            body = "editar"
        else:
            body = data

        reply = await agent_service.handle_vendor_message(phone, body)
        markup = _inline_for_step((agent_service._get_state(phone) or {}).get("step"))
        await telegram_client.send_message(chat_id, reply, reply_markup=markup)
        return {"ok": True}

    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return {"ok": True}

    chat = msg["chat"]
    if chat.get("type") != "private":
        return {"ok": True}

    chat_id = chat["id"]
    phone = _tg_phone(chat_id)
    frm = msg.get("from") or {}
    lang_hint = frm.get("language_code")

    text_body = (msg.get("text") or "").strip()
    if msg.get("location"):
        loc = msg["location"]
        reply = await agent_service.handle_vendor_location(
            phone, float(loc["latitude"]), float(loc["longitude"]), telegram_language_code=lang_hint
        )
        await telegram_client.send_message(chat_id, reply)
        return {"ok": True}

    image_bytes: bytes | None = None
    if msg.get("photo"):
        photos = msg["photo"]
        best = max(photos, key=lambda p: p.get("width", 0) * p.get("height", 0))
        fid = best.get("file_id")
        if fid:
            try:
                image_bytes = await telegram_client.download_file_bytes(fid)
            except Exception as e:
                await telegram_client.send_message(chat_id, f"No pude bajar la foto ({e}). Intenta otra vez.")
                return {"ok": True}

    reply = await agent_service.handle_vendor_message(
        phone,
        text_body,
        media_url=None,
        image_bytes=image_bytes,
        telegram_language_code=lang_hint,
    )
    markup = _inline_for_step((agent_service._get_state(phone) or {}).get("step"))
    await telegram_client.send_message(chat_id, reply, reply_markup=markup)
    return {"ok": True}

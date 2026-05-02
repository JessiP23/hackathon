"""Telegram Bot webhook — vendors DM the bot (InfraStreet AI Agent v3.2)."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request

from app.services.agent_service import agent_service
from app.services import telegram_client

router = APIRouter()

WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "").strip()


def _tg_phone(chat_id: int) -> str:
    return f"tg:{chat_id}"


def _callback_chat_id(cq: dict) -> int | None:
    """Telegram sometimes omits message on edge cases; DM fallback is from.id == private chat id."""
    msg = cq.get("message")
    if isinstance(msg, dict):
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid is not None:
            return int(cid)
    fr = cq.get("from") or {}
    cid = fr.get("id")
    if cid is not None:
        return int(cid)
    return None


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
        chat_id = _callback_chat_id(cq)
        data = (cq.get("data") or "").strip()

        if chat_id is None:
            await telegram_client.answer_callback_query(cq_id, text="Could not resolve chat.")
            return {"ok": True}

        phone = _tg_phone(chat_id)
        await telegram_client.answer_callback_query(cq_id)

        if data.startswith("cancel_"):
            deal_id = data[len("cancel_") :]
            vendor = agent_service._get_vendor_by_phone(phone)
            if vendor:
                from app.services.deal_service import DealService

                DealService().cancel_deal(deal_id, vendor["id"])
                await telegram_client.send_message(
                    chat_id,
                    "Listo. Deal cancelado; reembolsos en proceso si habia ordenes pagadas.",
                )
            else:
                await telegram_client.send_message(chat_id, "No encontramos tu tienda registrada.")
            return {"ok": True}

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

        try:
            reply = await agent_service.handle_vendor_message(phone, body)
            markup = _inline_for_step((agent_service._get_state(phone) or {}).get("step"))
            sm = await telegram_client.send_message(chat_id, reply, reply_markup=markup)
            if not sm.get("ok"):
                err = sm.get("description") or sm.get("text") or str(sm)
                print(f"[telegram] sendMessage failed: {err}", flush=True)
                await telegram_client.send_message(
                    chat_id,
                    f"Could not deliver the reply. ({err}) Try typing YES or Editar as text.",
                )
        except Exception as e:
            import traceback

            print(f"[telegram] callback error: {e}\n{traceback.format_exc()}", flush=True)
            await telegram_client.send_message(
                chat_id,
                f"Something went wrong. Type YES to confirm the menu or Editar to fix: {e}",
            )
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
        if agent_service._get_vendor_by_phone(phone):
            await telegram_client.send_message(chat_id, "Leyendo tu menu... 📸")
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

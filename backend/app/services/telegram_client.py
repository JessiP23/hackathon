"""Minimal Telegram Bot API client (async httpx)."""
from __future__ import annotations

import os
from typing import Any

import httpx

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
BASE = f"https://api.telegram.org/bot{TOKEN}" if TOKEN else ""


async def send_message(
    chat_id: int,
    text: str,
    reply_markup: dict[str, Any] | None = None,
    parse_mode: str | None = None,
) -> dict[str, Any]:
    if not TOKEN:
        print(f"[Telegram disabled] chat={chat_id}: {text[:200]}")
        return {"ok": False, "skipped": True}
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text[:4090]}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode:
        payload["parse_mode"] = parse_mode
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(f"{BASE}/sendMessage", json=payload)
        try:
            return r.json()
        except Exception:
            return {"ok": False, "status_code": r.status_code, "text": r.text[:500]}


async def answer_callback_query(callback_query_id: str, text: str | None = None) -> None:
    if not TOKEN:
        return
    payload: dict[str, Any] = {"callback_query_id": callback_query_id}
    if text is not None:
        payload["text"] = text[:200]
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(f"{BASE}/answerCallbackQuery", json=payload)


async def download_file_bytes(file_id: str) -> bytes:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN not set")
    async with httpx.AsyncClient(timeout=30.0) as client:
        gr = await client.get(f"{BASE}/getFile", params={"file_id": file_id})
        gr.raise_for_status()
        info = gr.json()
        if not info.get("ok") or not info.get("result"):
            raise RuntimeError(f"getFile failed: {info}")
        path = info["result"]["file_path"]
        fr = await client.get(f"https://api.telegram.org/file/bot{TOKEN}/{path}")
        fr.raise_for_status()
        return fr.content

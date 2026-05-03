"""
Strict one-question-per-message Telegram vendor bot FSM (InfraStreet).
State in Redis key state:{phone}; 30-minute TTL; timestamp guard.
"""
from __future__ import annotations

import json
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    import redis

    REDIS_OK = True
except ImportError:
    REDIS_OK = False

from sqlalchemy import text

from app.db import SessionLocal
from app.services.brain_service import compute_brain_deal_price, reverse_geocode_neighborhood
from app.services.ocr_service import OCRService

STATE_TTL_SEC = 30 * 60
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

ONBOARD_NAME = "ONBOARD_NAME"
ONBOARD_LOCATION = "ONBOARD_LOCATION"
ONBOARD_MENU_PHOTO = "ONBOARD_MENU_PHOTO"
ONBOARD_MENU_CONFIRM = "ONBOARD_MENU_CONFIRM"
ONBOARD_BRAIN_OPT_IN = "ONBOARD_BRAIN_OPT_IN"
ONBOARD_BRAIN_PRICE_FLOOR = "ONBOARD_BRAIN_PRICE_FLOOR"

DEAL_ITEM = "DEAL_ITEM"
DEAL_QUANTITY = "DEAL_QUANTITY"
DEAL_PRICE = "DEAL_PRICE"
DEAL_CONFIRM = "DEAL_CONFIRM"

PRICE_ITEM = "PRICE_ITEM"
PRICE_FLOOR_NEW = "PRICE_FLOOR_NEW"
PRICE_FLOOR_CONFIRM = "PRICE_FLOOR_CONFIRM"

BRAIN_ENABLE_FLOORS = "BRAIN_ENABLE_FLOORS"

_r: Any = None
_mem_store: dict[str, str] = {}


def _connect_redis():
    global _r
    if not REDIS_OK:
        _r = None
        return
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        _r = r
    except Exception:
        _r = None


_connect_redis()
if not _r:
    print("[VendorFSM] Redis unavailable — in-memory KV (single process only).", flush=True)


def _kv_get(key: str) -> str | None:
    if _r:
        return _r.get(key)
    return _mem_store.get(key)


def _kv_setex(key: str, ttl: int, val: str) -> None:
    if _r:
        _r.setex(key, ttl, val)
    else:
        _mem_store[key] = val


def _kv_del(key: str) -> None:
    if _r:
        _r.delete(key)
    else:
        _mem_store.pop(key, None)


def _now() -> float:
    return time.time()


def get_state(phone: str) -> dict[str, Any] | None:
    raw = _kv_get(f"state:{phone}")
    if not raw:
        return None
    try:
        st = json.loads(raw)
    except Exception:
        return None
    ts = float(st.get("ts") or 0)
    if _now() - ts > STATE_TTL_SEC:
        _kv_del(f"state:{phone}")
        return None
    return st


def _set_state(phone: str, step: str, data: dict[str, Any] | None = None) -> None:
    payload = {"step": step, "ts": _now(), "data": data or {}}
    _kv_setex(f"state:{phone}", STATE_TTL_SEC, json.dumps(payload))


def _merge_data(phone: str, step: str, **kwargs) -> None:
    st = get_state(phone) or {}
    d = dict(st.get("data") or {})
    d.update(kwargs)
    _set_state(phone, step, d)


def clear_state(phone: str) -> None:
    _kv_del(f"state:{phone}")


def _clear_pending_deal(vendor_id: str) -> None:
    _kv_del(f"pending_deal:{vendor_id}")


def _get_pending_deal(vendor_id: str) -> dict | None:
    raw = _kv_get(f"pending_deal:{vendor_id}")
    return json.loads(raw) if raw else None


def _set_pending_deal(vendor_id: str, deal: dict) -> None:
    _kv_setex(f"pending_deal:{vendor_id}", STATE_TTL_SEC, json.dumps(deal))


def _get_vendor_row(phone: str) -> dict | None:
    """Load vendor; tolerate missing Brain columns until migration is applied."""
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                SELECT id, name, phone, status, menu_image_url,
                       COALESCE(neighborhood, '') AS neighborhood,
                       COALESCE(brain_enabled, false) AS brain_enabled,
                       COALESCE(brain_urgency_threshold, 0.55) AS brain_urgency_threshold,
                       ST_Y(location::geometry) AS lat,
                       ST_X(location::geometry) AS lng
                FROM vendors
                WHERE phone = :p
                """
            ),
            {"p": phone},
        ).fetchone()
        return dict(row._mapping) if row else None
    except Exception as e:
        print(f"[VendorFSM] vendor query (run patch_vendor_telegram_brain_fsm.sql): {e}", flush=True)
        db.rollback()
        try:
            row = db.execute(
                text(
                    """
                    SELECT id, name, phone, status, menu_image_url,
                           ST_Y(location::geometry) AS lat,
                           ST_X(location::geometry) AS lng
                    FROM vendors
                    WHERE phone = :p
                    """
                ),
                {"p": phone},
            ).fetchone()
        except Exception as e2:
            print(f"[VendorFSM] vendor fallback query: {e2}", flush=True)
            db.rollback()
            return None
        if not row:
            return None
        m = dict(row._mapping)
        m["neighborhood"] = ""
        m["brain_enabled"] = False
        m["brain_urgency_threshold"] = 0.55
        return m
    finally:
        db.close()


def _list_menus(vendor_id: str) -> list[dict]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT id, item_name, price, price_floor
                FROM menus
                WHERE vendor_id = :v AND COALESCE(is_available, true) = true
                ORDER BY created_at ASC, item_name ASC
                """
            ),
            {"v": vendor_id},
        ).fetchall()
        out = []
        for r in rows:
            m = dict(r._mapping)
            pf = m.get("price_floor")
            out.append(
                {
                    "id": m["id"],
                    "item_name": m["item_name"],
                    "price": float(m["price"]) if m.get("price") is not None else 0.0,
                    "price_floor": float(pf) if pf is not None else None,
                }
            )
        return out
    except Exception as e:
        print(f"[VendorFSM] menus: {e}", flush=True)
        return []
    finally:
        db.close()


def _upload_menu_image(vendor_id: str, image_bytes: bytes, fallback_url: str) -> str:
    try:
        import boto3

        key_id = os.getenv("B2_KEY_ID")
        app_key = os.getenv("B2_APP_KEY")
        bucket = os.getenv("B2_BUCKET", "infrastreet-bucket")
        endpoint = os.getenv("B2_ENDPOINT", "https://s3.us-east-005.backblazeb2.com")
        if not endpoint.startswith("http"):
            endpoint = f"https://{endpoint}"
        if not key_id or not app_key:
            return fallback_url
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        key = f"vendors/{vendor_id}/menu_{ts}.jpg"
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=app_key,
        )
        s3.put_object(Bucket=bucket, Key=key, Body=image_bytes, ContentType="image/jpeg", ACL="public-read")
        host = endpoint.replace("https://", "")
        return f"https://{bucket}.{host}/{key}"
    except Exception as e:
        print(f"[VendorFSM] B2: {e}", flush=True)
        return fallback_url


def _parse_yes_no(text: str) -> bool | None:
    t = (text or "").strip().lower()
    if t in ("yes", "y", "si", "sí", "ok", "yeah", "yep"):
        return True
    if t in ("no", "n", "nope", "editar"):
        return False
    return None


def _parse_positive_int(text: str) -> int | None:
    t = (text or "").strip()
    if not t.isdigit():
        return None
    return int(t)


def _parse_decimal(text: str) -> float | None:
    t = re.sub(r"[^\d.]", "", (text or "").strip())
    if not t:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _interrupt_message() -> str:
    return (
        "Looks like we got interrupted.\n\n"
        "Send /deal to start a deal or /brain to check the Brain."
    )


def _help_text() -> str:
    return (
        "InfraStreet vendor commands:\n"
        "/deal — launch a flash deal\n"
        "/brain — Brain status; /brain on | off | aggressive | conservative | normal\n"
        "/price — update an item's price floor\n"
        "/stopdeal — stop your active deal\n"
        "/status — today's summary\n"
        "/cancel — cancel the current step\n"
        "/help — this message"
    )


async def _maybe_interrupt_idle(phone: str, vendor: dict | None, text_body: str) -> str | None:
    if not vendor or vendor.get("status") == "active" or get_state(phone):
        return None
    t = text_body.strip()
    if not t or t.startswith("/"):
        return None
    return _interrupt_message()


def _insert_menus_from_items(vendor_id: str, items: list[dict], menu_image_url: str | None) -> None:
    db = SessionLocal()
    try:
        for item in items:
            mid = f"m_{uuid.uuid4().hex[:8]}"
            db.execute(
                text(
                    """
                    INSERT INTO menus (id, vendor_id, item_name, description, price, is_available)
                    VALUES (:id, :vid, :name, :desc, :price, true)
                    """
                ),
                {
                    "id": mid,
                    "vid": vendor_id,
                    "name": item["name"],
                    "desc": item.get("description") or "",
                    "price": item.get("price") if item.get("price") is not None else 0,
                },
            )
        if menu_image_url:
            db.execute(
                text("UPDATE vendors SET menu_image_url = :url WHERE id = :vid"),
                {"url": menu_image_url, "vid": vendor_id},
            )
        db.commit()
    finally:
        db.close()


def _onboard_welcome_name(phone: str) -> str:
    _set_state(phone, ONBOARD_NAME, {})
    return (
        "👋 Welcome to InfraStreet.\n\n"
        "I'll get your stall set up in a few steps.\n\n"
        "First — what's the name of your stall or business?"
    )


async def _onboard_reply_name(phone: str, text_body: str) -> str:
    name = (text_body or "").strip()
    if len(name) < 2:
        return "That's too short. What do you call your stall?"
    if len(name) > 60:
        return "Keep it short — under 60 characters works best."
    _merge_data(phone, ONBOARD_LOCATION, stall_name=name)
    return (
        f"Got it — {name} 📍\n\n"
        "Now share your stall's location.\n\n"
        "Tap the 📎 clip icon → Location → Send Your Current Location."
    )


async def _onboard_create_vendor(phone: str, stall_name: str, lat: float, lng: float) -> str:
    neighborhood = await reverse_geocode_neighborhood(lat, lng)
    vid = f"v_{uuid.uuid4().hex[:8]}"
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                INSERT INTO vendors (id, name, phone, location, neighborhood, status)
                VALUES (:id, :name, :phone,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :hood, 'awaiting_menu')
                ON CONFLICT (phone) DO UPDATE SET
                    name = EXCLUDED.name,
                    location = EXCLUDED.location,
                    neighborhood = EXCLUDED.neighborhood
                """
            ),
            {"id": vid, "name": stall_name, "phone": phone, "lat": lat, "lng": lng, "hood": neighborhood},
        )
        db.commit()
        row = db.execute(text("SELECT id FROM vendors WHERE phone = :p"), {"p": phone}).fetchone()
        if row:
            vid = row[0]
    finally:
        db.close()

    _set_state(
        phone,
        ONBOARD_MENU_PHOTO,
        {"stall_name": stall_name, "neighborhood": neighborhood, "vendor_id": vid},
    )
    return (
        f"📍 {neighborhood} — perfect.\n\n"
        "Now send a photo of your menu or a price list.\n\n"
        "A photo of your chalkboard, printed menu, or handwritten list all work."
    )


async def handle_vendor_location(
    phone: str,
    lat: float,
    lng: float,
    telegram_language_code: str | None = None,
) -> str:
    vendor = _get_vendor_row(phone)
    if vendor and vendor.get("status") == "active":
        return "You're set up. Send /deal to launch a deal or /brain for the Brain."

    st = get_state(phone)
    step = (st or {}).get("step")

    if step == ONBOARD_LOCATION:
        data = (st or {}).get("data") or {}
        stall = (data.get("stall_name") or "").strip()
        if not stall:
            return _onboard_welcome_name(phone)
        return await _onboard_create_vendor(phone, stall, lat, lng)

    if not vendor:
        st = get_state(phone) or {}
        if st.get("step") != ONBOARD_LOCATION:
            return (
                "Tap /start first — then text your stall name. After that I'll ask for your location pin."
            )
        return (
            "I need a location pin, not text. Tap the 📎 clip → Location."
        )

    return "Send /deal or /brain — I didn't ask for a location right now."


async def _handle_onboard_menu_photo(
    phone: str, vendor_id: str, image_bytes: bytes, fallback_url: str,
) -> str:
    stored_url = _upload_menu_image(vendor_id, image_bytes, fallback_url)
    ocr = OCRService()
    items = ocr.extract_items(image_bytes)
    if len(items) < 1:
        return "I couldn't read that well. Send a clearer photo of your menu or price list."

    st = get_state(phone) or {}
    data = dict(st.get("data") or {})
    data["menu_image_url"] = stored_url
    data["vendor_id"] = vendor_id
    lines = []
    for i, it in enumerate(items, 1):
        pr = it.get("price")
        if pr is not None:
            lines.append(f"{i}. {it['name']} — ${pr:g}")
        else:
            lines.append(f"{i}. {it['name']}")
    block = "\n".join(lines)
    _set_state(phone, ONBOARD_MENU_CONFIRM, {**data, "pending_items": items})
    return (
        f"Here's what I read from your menu:\n\n{block}\n\n"
        "Does that look right?\n\n"
        "Reply YES to confirm, or NO to re-send the photo."
    )


def _onboard_brain_opt_in_prompt() -> str:
    return (
        "✅ Menu saved.\n\n"
        "One last thing — do you want the Brain?\n\n"
        "The Brain watches your sales and automatically launches deals when you have items left over that might not sell. You don't have to do anything.\n\n"
        "Reply YES to turn it on, or NO to manage deals yourself."
    )


async def _onboard_after_menu_confirm(phone: str, yn: bool) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    items = data.get("pending_items") or []
    vendor_id = data.get("vendor_id")
    menu_url = data.get("menu_image_url")

    if not yn:
        keep = {k: v for k, v in data.items() if k not in ("pending_items",)}
        _set_state(phone, ONBOARD_MENU_PHOTO, keep)
        return "No problem — send the photo again and I'll re-read it."

    if not vendor_id or not items:
        clear_state(phone)
        return _interrupt_message()

    _insert_menus_from_items(vendor_id, items, menu_url)
    _set_state(phone, ONBOARD_BRAIN_OPT_IN, {"vendor_id": vendor_id})
    return _onboard_brain_opt_in_prompt()


def _brain_floor_prompt(item_name: str, first_message: bool) -> str:
    if first_message:
        return (
            "Great — the Brain is on.\n\n"
            "For each item, I need a price floor — the lowest price you'd ever sell at.\n\n"
            f"What's the lowest price for {item_name}?\n\n"
            "Reply with just the number. Example: 8"
        )
    return (
        f"What's the lowest price for {item_name}?\n\n"
        "Reply with just the number. Example: 8"
    )


async def _onboard_brain_opt_in(phone: str, yn: bool) -> str:
    st = get_state(phone) or {}
    vid = (st.get("data") or {}).get("vendor_id")
    if not vid:
        clear_state(phone)
        return _interrupt_message()

    db = SessionLocal()
    try:
        if yn:
            db.execute(
                text(
                    """
                    UPDATE vendors
                    SET brain_enabled = true, brain_urgency_threshold = 0.55
                    WHERE id = :vid
                    """
                ),
                {"vid": vid},
            )
        else:
            db.execute(
                text("UPDATE vendors SET brain_enabled = false WHERE id = :vid"),
                {"vid": vid},
            )
        db.commit()
    finally:
        db.close()

    if not yn:
        return await _finalize_onboarding(phone, vid, brain_on=False)

    menus = _list_menus(vid)
    if not menus:
        return await _finalize_onboarding(phone, vid, brain_on=True)

    d = {"vendor_id": vid, "brain_floor_items": menus, "brain_floor_idx": 0}
    _set_state(phone, ONBOARD_BRAIN_PRICE_FLOOR, d)
    return _brain_floor_prompt(menus[0]["item_name"], first_message=True)


async def _onboard_brain_floor_reply(phone: str, text_body: str) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    items = data.get("brain_floor_items") or []
    idx = int(data.get("brain_floor_idx") or 0)
    vid = data.get("vendor_id")
    if not vid or idx >= len(items):
        if vid:
            return await _finalize_onboarding(phone, vid, brain_on=True)
        return _interrupt_message()

    row = items[idx]
    menu_price = float(row.get("price") or 0)
    val = _parse_decimal(text_body)
    if val is None:
        return "Just the number — for example: 8"
    if val <= 0:
        return "Enter a price above zero."
    if menu_price > 0 and val > menu_price:
        return (
            f"That's higher than your menu price of ${menu_price:g}. "
            f"Enter a number lower than ${menu_price:g}."
        )

    db = SessionLocal()
    try:
        db.execute(
            text("UPDATE menus SET price_floor = :f WHERE id = :mid AND vendor_id = :v"),
            {"f": val, "mid": row["id"], "v": vid},
        )
        db.commit()
    finally:
        db.close()

    next_idx = idx + 1
    if next_idx >= len(items):
        return await _finalize_onboarding(phone, vid, brain_on=True)

    nxt = items[next_idx]
    _set_state(
        phone,
        ONBOARD_BRAIN_PRICE_FLOOR,
        {"vendor_id": vid, "brain_floor_items": items, "brain_floor_idx": next_idx},
    )
    return _brain_floor_prompt(nxt["item_name"], first_message=False)


async def _finalize_onboarding(phone: str, vendor_id: str, brain_on: bool) -> str:
    neighborhood = ""
    db = SessionLocal()
    try:
        db.execute(text("UPDATE vendors SET status = 'active' WHERE id = :vid"), {"vid": vendor_id})
        db.commit()
        row = db.execute(
            text("SELECT neighborhood FROM vendors WHERE id = :vid"),
            {"vid": vendor_id},
        ).fetchone()
        if row and row[0]:
            neighborhood = row[0]
    finally:
        db.close()

    menus = _list_menus(vendor_id)
    n = len(menus)
    clear_state(phone)

    try:
        from app.services.notify_service import notify_service

        vrow = _get_vendor_row(phone)
        if vrow:
            await notify_service.fan_out_new_vendor(
                vendor_id=vendor_id,
                vendor_name=vrow.get("name") or "Vendor",
                lat=float(vrow.get("lat") or 0),
                lng=float(vrow.get("lng") or 0),
                neighborhood=neighborhood or None,
            )
    except Exception as e:
        print(f"[VendorFSM] fan_out_new_vendor: {e}", flush=True)

    hood = neighborhood or "your area"
    if brain_on:
        return (
            "🎉 You're live on InfraStreet.\n\n"
            "🧠 Brain: ON\n"
            f"📍 {hood}\n"
            f"🍽 {n} items on your menu\n\n"
            "The Brain will handle your deals automatically.\n"
            "When it fires a deal, I'll send you a message so you know.\n\n"
            "To launch a deal manually anytime, send: /deal\n"
            "To check your Brain: /brain"
        )
    return (
        "🎉 You're live on InfraStreet.\n\n"
        f"📍 {hood}\n"
        f"🍽 {n} items on your menu\n\n"
        "To launch a flash deal, send: /deal\n"
        "To turn on the Brain later, send: /brain on"
    )


def _deal_item_prompt(vendor_id: str) -> str | None:
    menus = _list_menus(vendor_id)
    if not menus:
        return None
    lines = [f"{i}. {m['item_name']}" for i, m in enumerate(menus, 1)]
    return (
        "Which item do you want to put on deal?\n\n"
        + "\n".join(lines)
        + "\n\nReply with the number."
    )


def _default_end_time_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat()


async def _deal_start(phone: str, vendor: dict) -> str:
    vid = vendor["id"]
    msg = _deal_item_prompt(vid)
    if not msg:
        return "Add menu items first (send a menu photo or use the app)."
    menus = _list_menus(vid)
    _set_state(phone, DEAL_ITEM, {"vendor_id": vid, "deal_menus": menus})
    return msg


async def _deal_reply_item(phone: str, text_body: str, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    menus = data.get("deal_menus") or _list_menus(vendor["id"])
    n = len(menus)
    num = _parse_positive_int(text_body)
    if num is None or num < 1 or num > n:
        return f"Reply with a number from 1 to {n}."
    choice = menus[num - 1]
    _set_state(
        phone,
        DEAL_QUANTITY,
        {
            "vendor_id": vendor["id"],
            "deal_menus": menus,
            "deal_item": choice,
        },
    )
    return (
        f"How many {choice['item_name']} do you have available right now?\n\n"
        "Reply with just the number. Example: 15"
    )


async def _deal_reply_quantity(phone: str, text_body: str, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    item = data.get("deal_item")
    if not item:
        clear_state(phone)
        return _interrupt_message()
    qty = _parse_positive_int(text_body)
    if qty is None:
        return "Just the number — for example: 15"
    if qty < 1:
        return "Enter at least 1."
    if qty > 200:
        return "That seems high — double-check and reply again."

    merged = {**data, "deal_quantity": qty}
    if vendor.get("brain_enabled"):
        _set_state(phone, DEAL_CONFIRM, merged)
        floor = item.get("price_floor")
        fl = f"${floor:g}" if floor is not None else "not set"
        return (
            "Ready to launch:\n\n"
            f"🍽 {item['item_name']}\n"
            f"📦 {qty} available\n"
            f"💰 Brain will set the best price (floor: {fl})\n\n"
            "Reply YES to go live, or NO to cancel."
        )

    _set_state(phone, DEAL_PRICE, merged)
    mp = float(item.get("price") or 0)
    return (
        "What price for this deal?\n\n"
        f"Your menu price is ${mp:g}.\n\n"
        "Reply with just the number. Example: 9"
    )


async def _deal_reply_price(phone: str, text_body: str, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    item = data.get("deal_item")
    qty = data.get("deal_quantity")
    if not item or qty is None:
        clear_state(phone)
        return _interrupt_message()

    menu_price = float(item.get("price") or 0)
    floor = item.get("price_floor")
    val = _parse_decimal(text_body)
    if val is None:
        return "Just the number — for example: 9"
    if val <= 0:
        return "Enter a price above zero."
    if menu_price > 0 and val >= menu_price:
        return f"The deal price should be lower than your menu price of ${menu_price:g}."
    if floor is not None and val < floor:
        return f"That's below your floor of ${floor:g}. Enter ${floor:g} or higher."

    _set_state(
        phone,
        DEAL_CONFIRM,
        {**data, "deal_price": val},
    )
    return (
        "Ready to launch:\n\n"
        f"🍽 {item['item_name']}\n"
        f"📦 {qty} available\n"
        f"💰 ${val:g}\n\n"
        "Reply YES to go live, or NO to cancel."
    )


async def _deal_confirm(phone: str, yn: bool, vendor: dict) -> str:
    if not yn:
        clear_state(phone)
        _clear_pending_deal(vendor["id"])
        return "Cancelled. Send /deal whenever you're ready."

    st = get_state(phone) or {}
    data = st.get("data") or {}
    item = data.get("deal_item")
    qty = data.get("deal_quantity")
    deal_price_manual = data.get("deal_price")
    if not item or qty is None:
        clear_state(phone)
        return _interrupt_message()

    menu_price = float(item.get("price") or 0)
    floor = item.get("price_floor")
    urgency = float(vendor.get("brain_urgency_threshold") or 0.55)

    if vendor.get("brain_enabled"):
        deal_price = compute_brain_deal_price(menu_price, floor, urgency)
    else:
        deal_price = float(deal_price_manual or 0)

    from app.services.deal_service import DealService

    result = DealService().create_flash_deal(
        {
            "vendor_id": vendor["id"],
            "item_name": item["item_name"],
            "original_price": menu_price,
            "deal_price": deal_price,
            "discount_pct": None,
            "quantity": int(qty),
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": _default_end_time_iso(),
            "radius_miles": 10,
            "media_url": vendor.get("menu_image_url"),
            "vendor_name": vendor.get("name") or "",
            "lat": float(vendor.get("lat") or 0),
            "lng": float(vendor.get("lng") or 0),
            "pickup_area": vendor.get("neighborhood"),
            "deal_origin": "vendor",
        }
    )

    clear_state(phone)
    _clear_pending_deal(vendor["id"])
    item_name = item["item_name"]

    if vendor.get("brain_enabled"):
        fl = floor
        fls = f"${fl:g}" if fl is not None else "your floor"
        return (
            "🚀 Deal is live.\n\n"
            f"{item_name} · ${deal_price:g} · {qty} available\n"
            f"(Brain set ${deal_price:g} based on {fls} and current demand)\n\n"
            "Customers near you can see it now.\n\n"
            "To stop the deal early: /stopdeal"
        )

    return (
        "🚀 Deal is live.\n\n"
        f"{item_name} · ${deal_price:g} · {qty} available\n\n"
        "Customers near you can see it now.\n\n"
        "To stop the deal early: /stopdeal"
    )


async def _brain_command(phone: str, vendor: dict, parts: list[str]) -> str:
    vid = vendor["id"]
    sub = (parts[1] if len(parts) > 1 else "").lower()

    if sub in ("on",):
        menus = _list_menus(vid)
        missing = [m for m in menus if m.get("price_floor") is None]
        if not missing:
            db = SessionLocal()
            try:
                db.execute(
                    text(
                        "UPDATE vendors SET brain_enabled = true, brain_urgency_threshold = 0.55 WHERE id = :v"
                    ),
                    {"v": vid},
                )
                db.commit()
            finally:
                db.close()
            return (
                "🧠 Brain is ON.\n\n"
                "I'll watch your sales and launch deals automatically when needed.\n"
                "You'll get a message each time I act.\n\n"
                "To turn it off: /brain off"
            )
        _set_state(
            phone,
            BRAIN_ENABLE_FLOORS,
            {"vendor_id": vid, "brain_floor_items": missing, "brain_floor_idx": 0},
        )
        return (
            "Turning on the Brain — I need one number per item first.\n\n"
            + _brain_floor_prompt(missing[0]["item_name"], first_message=False)
        )

    if sub in ("off",):
        db = SessionLocal()
        try:
            db.execute(text("UPDATE vendors SET brain_enabled = false WHERE id = :v"), {"v": vid})
            db.commit()
        finally:
            db.close()
        return (
            "🧠 Brain: OFF\n\n"
            "You're managing deals manually.\n\n"
            "To turn on: /brain on"
        )

    if sub == "aggressive":
        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE vendors SET brain_urgency_threshold = 0.45 WHERE id = :v"),
                {"v": vid},
            )
            db.commit()
        finally:
            db.close()
        return (
            "Set to aggressive.\n\n"
            "The Brain will fire deals sooner and offer steeper discounts to move inventory faster.\n\n"
            "To go back to normal: /brain normal"
        )

    if sub == "conservative":
        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE vendors SET brain_urgency_threshold = 0.70 WHERE id = :v"),
                {"v": vid},
            )
            db.commit()
        finally:
            db.close()
        return (
            "Set to conservative.\n\n"
            "The Brain will only fire deals when inventory risk is high. Smaller discounts.\n\n"
            "To go back to normal: /brain normal"
        )

    if sub == "normal":
        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE vendors SET brain_urgency_threshold = 0.55 WHERE id = :v"),
                {"v": vid},
            )
            db.commit()
        finally:
            db.close()
        return (
            "Back to normal — balanced between frequency and discount depth."
        )

    # status-only /brain
    db = SessionLocal()
    try:
        on = bool(vendor.get("brain_enabled"))
        if not on:
            return (
                "🧠 Brain: OFF\n\n"
                "You're managing deals manually.\n\n"
                "To turn on: /brain on"
            )
        nf = db.execute(
            text(
                """
                SELECT COUNT(*) FROM flash_deals
                WHERE vendor_id = :v AND deal_origin = 'brain'
                  AND created_at::date = (NOW() AT TIME ZONE 'UTC')::date
                """
            ),
            {"v": vid},
        ).fetchone()
        fired = int(nf[0] or 0) if nf else 0
        rev_row = db.execute(
            text(
                """
                SELECT COALESCE(SUM(o.total), 0)
                FROM orders o
                JOIN flash_deals fd ON fd.id = o.deal_id
                WHERE fd.vendor_id = :v AND fd.deal_origin = 'brain'
                  AND fd.created_at::date = (NOW() AT TIME ZONE 'UTC')::date
                  AND o.status IN ('paid', 'fulfilled')
                """
            ),
            {"v": vid},
        ).fetchone()
        rev = float(rev_row[0] or 0) if rev_row else 0.0
    except Exception:
        fired, rev = 0, 0.0
    finally:
        db.close()

    last = _kv_get(f"brain_last:{vid}")
    last_line = "Last action: none yet"
    if last:
        try:
            j = json.loads(last)
            ago = int(_now() - float(j.get("ts", 0)))
            mins = max(0, ago // 60)
            last_line = f"Last action: {j.get('desc', '')} · {mins} min ago"
        except Exception:
            pass

    return (
        "🧠 Brain: ON\n\n"
        "Today:\n"
        f"— Deals fired: {fired}\n"
        "— Units saved: 0\n"
        f"— Revenue from Brain deals: ${rev:.2f}\n\n"
        f"{last_line}\n\n"
        "To turn off: /brain off\n"
        "To adjust aggressiveness: /brain aggressive or /brain conservative"
    )


async def _brain_enable_floor_reply(phone: str, text_body: str, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    items = data.get("brain_floor_items") or []
    idx = int(data.get("brain_floor_idx") or 0)
    vid = data.get("vendor_id") or vendor["id"]
    if idx >= len(items):
        db = SessionLocal()
        try:
            db.execute(
                text(
                    "UPDATE vendors SET brain_enabled = true, brain_urgency_threshold = 0.55 WHERE id = :v"
                ),
                {"v": vid},
            )
            db.commit()
        finally:
            db.close()
        clear_state(phone)
        return (
            "🧠 Brain is ON.\n\n"
            "I'll watch your sales and launch deals automatically when needed.\n"
            "You'll get a message each time I act.\n\n"
            "To turn it off: /brain off"
        )

    row = items[idx]
    menu_price = float(row.get("price") or 0)
    val = _parse_decimal(text_body)
    if val is None:
        return "Just the number — for example: 8"
    if val <= 0:
        return "Enter a price above zero."
    if menu_price > 0 and val > menu_price:
        return (
            f"That's higher than your menu price of ${menu_price:g}. "
            f"Enter a number lower than ${menu_price:g}."
        )

    db = SessionLocal()
    try:
        db.execute(
            text("UPDATE menus SET price_floor = :f WHERE id = :mid AND vendor_id = :v"),
            {"f": val, "mid": row["id"], "v": vid},
        )
        db.commit()
    finally:
        db.close()

    next_idx = idx + 1
    if next_idx >= len(items):
        db2 = SessionLocal()
        try:
            db2.execute(
                text(
                    "UPDATE vendors SET brain_enabled = true, brain_urgency_threshold = 0.55 WHERE id = :v"
                ),
                {"v": vid},
            )
            db2.commit()
        finally:
            db2.close()
        clear_state(phone)
        return (
            "🧠 Brain is ON.\n\n"
            "I'll watch your sales and launch deals automatically when needed.\n"
            "You'll get a message each time I act.\n\n"
            "To turn it off: /brain off"
        )

    nxt = items[next_idx]
    _set_state(
        phone,
        BRAIN_ENABLE_FLOORS,
        {"vendor_id": vid, "brain_floor_items": items, "brain_floor_idx": next_idx},
    )
    return _brain_floor_prompt(nxt["item_name"], first_message=False)


def record_brain_last_action(vendor_id: str, description: str) -> None:
    _kv_setex(
        f"brain_last:{vendor_id}",
        86400 * 7,
        json.dumps({"ts": _now(), "desc": description}),
    )


async def _price_start(phone: str, vendor: dict) -> str:
    menus = _list_menus(vendor["id"])
    if not menus:
        return "Add menu items first."
    lines = [f"{i}. {m['item_name']}" for i, m in enumerate(menus, 1)]
    _set_state(phone, PRICE_ITEM, {"vendor_id": vendor["id"], "price_menus": menus})
    return (
        "Which item do you want to update the price floor for?\n\n"
        + "\n".join(lines)
        + "\n\nReply with the number."
    )


async def _price_reply_item(phone: str, text_body: str, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    menus = data.get("price_menus") or _list_menus(vendor["id"])
    n = len(menus)
    num = _parse_positive_int(text_body)
    if num is None or num < 1 or num > n:
        return f"Reply with a number from 1 to {n}."
    row = menus[num - 1]
    cur = row.get("price_floor")
    cur_s = f"${cur:g}" if cur is not None else "not set"
    _set_state(
        phone,
        PRICE_FLOOR_NEW,
        {"vendor_id": vendor["id"], "price_menus": menus, "price_edit_row": row},
    )
    return (
        f"Current floor for {row['item_name']}: {cur_s}\n\n"
        "What's the new minimum price?\n\n"
        "Reply with just the number."
    )


async def _price_reply_floor(phone: str, text_body: str, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    row = data.get("price_edit_row")
    if not row:
        clear_state(phone)
        return _interrupt_message()
    menu_price = float(row.get("price") or 0)
    val = _parse_decimal(text_body)
    if val is None:
        return "Just the number — for example: 8"
    if val <= 0:
        return "Enter a price above zero."
    if menu_price > 0 and val >= menu_price:
        return f"Enter a number below your menu price of ${menu_price:g}."
    _set_state(
        phone,
        PRICE_FLOOR_CONFIRM,
        {**data, "price_new_floor": val},
    )
    return (
        f"Update {row['item_name']} floor to ${val:g}?\n\n"
        "Reply YES to save, or NO to cancel."
    )


async def _price_confirm(phone: str, yn: bool, vendor: dict) -> str:
    st = get_state(phone) or {}
    data = st.get("data") or {}
    row = data.get("price_edit_row")
    val = data.get("price_new_floor")
    if not row or val is None:
        clear_state(phone)
        return _interrupt_message()
    if not yn:
        clear_state(phone)
        return "Cancelled. No changes made."
    db = SessionLocal()
    try:
        db.execute(
            text("UPDATE menus SET price_floor = :f WHERE id = :mid AND vendor_id = :v"),
            {"f": val, "mid": row["id"], "v": vendor["id"]},
        )
        db.commit()
    finally:
        db.close()
    clear_state(phone)
    return (
        f"✅ Floor updated. Brain will use ${val:g} as the minimum for {row['item_name']}."
    )


async def _today_status(phone: str, vendor: dict) -> str:
    vid = vendor["id"]
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                SELECT
                  (SELECT COUNT(*) FROM flash_deals WHERE vendor_id = :v
                     AND created_at::date = (NOW() AT TIME ZONE 'UTC')::date) AS deals,
                  (SELECT COALESCE(SUM(o.total), 0) FROM orders o
                     WHERE o.vendor_id = :v AND o.status IN ('paid','fulfilled')
                     AND o.created_at::date = (NOW() AT TIME ZONE 'UTC')::date) AS rev
                """
            ),
            {"v": vid},
        ).fetchone()
        d = int(row[0] or 0) if row else 0
        r = float(row[1] or 0) if row else 0.0
    except Exception:
        d, r = 0, 0.0
    finally:
        db.close()
    return (
        "Today on InfraStreet:\n\n"
        f"— Deals you ran: {d}\n"
        f"— Revenue (fulfilled/paid orders): ${r:.2f}\n\n"
        "Launch something: /deal"
    )


async def handle_vendor_message(
    phone: str,
    text_body: str,
    media_url: str | None = None,
    image_bytes: bytes | None = None,
    telegram_language_code: str | None = None,
) -> str:
    _ = telegram_language_code
    vendor = _get_vendor_row(phone)
    low = (text_body or "").strip().lower()

    if not vendor and image_bytes and not (text_body or "").strip():
        return "Text me your stall name first — tap /start if you need the welcome message."

    if low in ("/help", "help"):
        return _help_text()

    if low in ("/cancel", "cancel"):
        if vendor:
            _clear_pending_deal(vendor["id"])
        clear_state(phone)
        return "Cancelled. Send /deal to start a deal, /brain to check the Brain."

    if vendor and low.startswith("/stopdeal"):
        from app.services.deal_service import DealService

        n = DealService().cancel_vendor_active_deals(vendor["id"])
        return f"Stopped active deal(s). Refunds processed where needed ({n})."

    if vendor and low.startswith("/status"):
        return await _today_status(phone, vendor)

    if vendor and low.startswith("/brain"):
        tokens = [t.lstrip("/") for t in text_body.strip().split()]
        return await _brain_command(phone, vendor, tokens)

    if vendor and vendor.get("status") == "active" and low.startswith("/price"):
        clear_state(phone)
        return await _price_start(phone, vendor)

    if vendor and vendor.get("status") == "active" and (
        low.startswith("/deal") or low in ("/flash", "flash")
    ):
        clear_state(phone)
        return await _deal_start(phone, vendor)

    if not vendor:
        if low in ("/start",) or not text_body.strip():
            return _onboard_welcome_name(phone)
        intr = await _maybe_interrupt_idle(phone, vendor, text_body)
        if intr:
            return intr
        st = get_state(phone) or {}
        step = st.get("step")
        if step == ONBOARD_NAME:
            return await _onboard_reply_name(phone, text_body)
        if step == ONBOARD_LOCATION:
            return "I need a location pin, not text. Tap the 📎 clip → Location."
        if step == ONBOARD_MENU_PHOTO and text_body.strip():
            return "Send a photo — I'll read it for you."
        if step == ONBOARD_MENU_CONFIRM:
            yn = _parse_yes_no(text_body)
            if yn is None:
                return "Reply YES if the list looks right, or NO to try again."
            return await _onboard_after_menu_confirm(phone, yn)
        if step == ONBOARD_BRAIN_OPT_IN:
            yn = _parse_yes_no(text_body)
            if yn is None:
                return "Reply YES to enable the Brain, or NO to skip it for now."
            return await _onboard_brain_opt_in(phone, yn)
        if step == ONBOARD_BRAIN_PRICE_FLOOR:
            return await _onboard_brain_floor_reply(phone, text_body)
        return _onboard_welcome_name(phone)

    intr = await _maybe_interrupt_idle(phone, vendor, text_body)
    if intr:
        return intr

    st = get_state(phone) or {}
    step = st.get("step")

    if vendor.get("status") != "active":
        if step == ONBOARD_MENU_PHOTO:
            if text_body.strip() and not image_bytes:
                return "Send a photo — I'll read it for you."
            if image_bytes and vendor.get("id"):
                return await _handle_onboard_menu_photo(
                    phone, vendor["id"], image_bytes, media_url or "telegram:image",
                )
            if media_url and not image_bytes:
                try:
                    import httpx

                    async with httpx.AsyncClient(timeout=20.0) as client:
                        resp = await client.get(
                            media_url,
                            auth=(
                                os.getenv("TWILIO_ACCOUNT_SID", ""),
                                os.getenv("TWILIO_AUTH_TOKEN", ""),
                            ),
                        )
                        ib = resp.content
                    return await _handle_onboard_menu_photo(
                        phone, vendor["id"], ib, media_url,
                    )
                except Exception:
                    return "Couldn't load the image. Try again."
        if step == ONBOARD_MENU_CONFIRM:
            yn = _parse_yes_no(text_body)
            if yn is None:
                return "Reply YES if the list looks right, or NO to try again."
            return await _onboard_after_menu_confirm(phone, yn)
        if step == ONBOARD_BRAIN_OPT_IN:
            yn = _parse_yes_no(text_body)
            if yn is None:
                return "Reply YES to enable the Brain, or NO to skip it for now."
            return await _onboard_brain_opt_in(phone, yn)
        if step == ONBOARD_BRAIN_PRICE_FLOOR:
            return await _onboard_brain_floor_reply(phone, text_body)

    if vendor.get("status") == "active" and (image_bytes or media_url):
        if step not in (ONBOARD_MENU_PHOTO,):
            return (
                "I'm only reading menu photos during signup.\n\n"
                "Send /deal to run a deal, or /help."
            )

    if step == BRAIN_ENABLE_FLOORS:
        return await _brain_enable_floor_reply(phone, text_body, vendor)

    if step == DEAL_ITEM:
        if not text_body.strip():
            dm = (st.get("data") or {}).get("deal_menus") or _list_menus(vendor["id"])
            return f"Reply with a number from 1 to {len(dm)}."
        return await _deal_reply_item(phone, text_body, vendor)

    if step == DEAL_QUANTITY:
        return await _deal_reply_quantity(phone, text_body, vendor)

    if step == DEAL_PRICE:
        return await _deal_reply_price(phone, text_body, vendor)

    if step == DEAL_CONFIRM:
        yn = _parse_yes_no(text_body)
        if yn is None:
            return "Reply YES to launch or NO to cancel."
        return await _deal_confirm(phone, yn, vendor)

    if step == PRICE_ITEM:
        return await _price_reply_item(phone, text_body, vendor)

    if step == PRICE_FLOOR_NEW:
        return await _price_reply_floor(phone, text_body, vendor)

    if step == PRICE_FLOOR_CONFIRM:
        yn = _parse_yes_no(text_body)
        if yn is None:
            return "Reply YES to save, or NO to cancel."
        return await _price_confirm(phone, yn, vendor)

    if low in ("/start",):
        return (
            "You're on InfraStreet. Send /deal for a flash deal, /brain for the Brain, /help for commands."
        )

    return (
        "Send /deal to launch a deal, /brain for the Brain, /price to edit a floor, or /help."
    )

"""
APScheduler jobs (v3.3):
1. Every 5 min — expire / activate deals
2. Every 30 min — auto flash (reliability >= 50%), Cancel → cancel_{dealId}
3. Every hour — Monday ~9:00 vendor local time weekly stats (Redis dedupe)
"""
import os
from datetime import datetime, timezone

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    APScheduler_OK = True
except ImportError:
    APScheduler_OK = False

from app.db import SessionLocal
from sqlalchemy import text

GROQ_MODEL = "llama-3.3-70b-versatile"


def create_scheduler():
    if not APScheduler_OK:
        print("[Scheduler] APScheduler not installed — skipping")
        return None

    scheduler = AsyncIOScheduler(timezone=timezone.utc)

    scheduler.add_job(expire_deals, IntervalTrigger(minutes=5), id="expire_deals", replace_existing=True)

    scheduler.add_job(auto_flash_engine, IntervalTrigger(minutes=30), id="auto_flash", replace_existing=True)

    scheduler.add_job(weekly_stats_hourly, IntervalTrigger(hours=1), id="weekly_stats_tz", replace_existing=True)

    return scheduler


def expire_deals():
    try:
        from app.services.deal_service import DealService

        DealService().expire_old_deals()
    except Exception as e:
        import traceback

        print(f"[Scheduler] expire_deals failed: {e}\n{traceback.format_exc()}", flush=True)


async def auto_flash_engine():
    try:
        await _auto_flash_engine_inner()
    except Exception as e:
        import traceback

        print(f"[Scheduler] auto_flash_engine failed: {e}\n{traceback.format_exc()}", flush=True)


async def _auto_flash_engine_inner():
    db = SessionLocal()
    try:
        slow_vendors = db.execute(
            text("""
                SELECT v.id, v.name, v.phone,
                       ST_Y(v.location::geometry) as lat,
                       ST_X(v.location::geometry) as lng
                FROM vendors v
                WHERE COALESCE(v.reliability_score, 100) >= 50
                  AND (
                    SELECT COUNT(*) FROM orders o
                    WHERE o.vendor_id = v.id
                      AND o.created_at > NOW() - INTERVAL '2 hours'
                ) < 2
                  AND (
                    SELECT COUNT(*) FROM flash_deals fd
                    WHERE fd.vendor_id = v.id
                      AND fd.status IN ('active','scheduled')
                  ) = 0
                LIMIT 50
            """)
        ).fetchall()
    finally:
        db.close()

    for vendor in slow_vendors:
        await _create_auto_deal(vendor)


async def _create_auto_deal(vendor):
    import json
    import re
    from datetime import timedelta

    db = SessionLocal()
    try:
        menu = db.execute(
            text("SELECT item_name, price FROM menus WHERE vendor_id = :vid AND is_available = true LIMIT 20"),
            {"vid": vendor.id},
        ).fetchall()
    finally:
        db.close()

    if not menu:
        return

    menu_str = ", ".join([f"{m.item_name} (${m.price})" for m in menu])

    try:
        from groq import Groq

        groq = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
        resp = groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f'Vendor "{vendor.name}" sells: {menu_str}. '
                        "It's a slow period. Pick 1 item for a flash deal. "
                        'Return ONLY JSON: {"item": "...", "discount_pct": 30, "quantity": 15, "reason": "..."}'
                    ),
                }
            ],
            max_tokens=150,
            temperature=0.7,
        )
        raw = resp.choices[0].message.content or "{}"
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
        suggestion = json.loads(raw)
    except Exception as e:
        print(f"[AutoDeal] Groq error for {vendor.id}: {e}")
        suggestion = {"item": menu[0].item_name, "discount_pct": 30, "quantity": 15}

    now = datetime.now(timezone.utc)
    end_time = (now + timedelta(minutes=45)).isoformat()

    db2 = SessionLocal()
    try:
        price_row = db2.execute(
            text("SELECT price FROM menus WHERE vendor_id = :vid AND item_name ILIKE :name LIMIT 1"),
            {"vid": vendor.id, "name": f"%{suggestion['item']}%"},
        ).fetchone()
        original_price = float(price_row.price) if price_row else None
    finally:
        db2.close()

    deal_price = (
        round(original_price * (1 - suggestion["discount_pct"] / 100), 2) if original_price else None
    )

    from app.services.deal_service import DealService

    result = DealService().create_flash_deal(
        {
            "vendor_id": vendor.id,
            "item_name": suggestion["item"],
            "original_price": original_price,
            "deal_price": deal_price,
            "discount_pct": suggestion["discount_pct"],
            "quantity": suggestion.get("quantity", 15),
            "end_time": end_time,
            "radius_miles": 10,
            "lat": float(vendor.lat or 0),
            "lng": float(vendor.lng or 0),
            "vendor_name": getattr(vendor, "name", "") or "",
        }
    )
    deal_id = result.get("dealId") if isinstance(result, dict) else None

    from app.services.notify_service import notify_service

    disc = suggestion["discount_pct"]
    msg = f"InfraStreet creo deal: {disc}% {suggestion['item']} x45min. Clientes notificados."
    markup = None
    if deal_id:
        markup = {"inline_keyboard": [[{"text": "Cancel", "callback_data": f"cancel_{deal_id}"}]]}
    await notify_service.send_message(vendor.phone, msg, "vendor", reply_markup=markup)


async def weekly_stats_hourly():
    """Fire once per ISO week per vendor when local Monday hour == 9."""
    try:
        await _weekly_stats_hourly_inner()
    except Exception as e:
        import traceback

        print(
            f"[Scheduler] weekly_stats_hourly failed: {e}\n{traceback.format_exc()}",
            flush=True,
        )


async def _weekly_stats_hourly_inner():
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        ZoneInfo = None

    from app.services.deal_service import DealService
    from app.services.notify_service import notify_service

    r = None
    try:
        import redis

        r = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
        r.ping()
    except Exception:
        pass

    db = SessionLocal()
    try:
        vendors = db.execute(
            text(
                "SELECT id, name, phone, COALESCE(timezone, 'UTC') AS tz FROM vendors WHERE status = 'active'"
            )
        ).fetchall()
    finally:
        db.close()

    svc = DealService()
    utc_now = datetime.now(timezone.utc)

    for row in vendors:
        m = row._mapping
        tzname = m.get("tz") or "UTC"
        vid = m.get("id")
        phone = m.get("phone")
        if ZoneInfo:
            try:
                tz = ZoneInfo(str(tzname))
            except Exception:
                tz = ZoneInfo("UTC")
            local = utc_now.astimezone(tz)
        else:
            local = utc_now

        if local.weekday() != 0:
            continue
        if local.hour != 9:
            continue

        iso = local.isocalendar()
        week_key = f"{iso[0]}-W{iso[1]:02d}"
        dedupe = f"weekly_stats:{vid}:{week_key}"
        if r:
            try:
                if not r.set(dedupe, "1", nx=True, ex=8 * 86400):
                    continue
            except Exception:
                pass

        stats = svc.get_vendor_stats(vid, days=7)
        msg = (
            f"Tu semana InfraStreet:\n"
            f"${stats['total_revenue']:.2f} · {stats['total_orders']} ordenes · "
            f"{stats['reliability_score']:.0f}% rating\n"
            f"Top: {stats['top_item'] or 'N/A'}\n"
            f"Nuevo deal: FLASH 5pm {stats['top_item'] or 'tu mejor plato'} 30%"
        )
        await notify_service.send_message(phone, msg, "vendor")

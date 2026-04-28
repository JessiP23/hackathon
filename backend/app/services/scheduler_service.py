"""
APScheduler jobs:
1. Every 30 minutes — Auto Flash Deal engine (slow period detection)
2. Every 30 minutes — expire stale deals / activate scheduled ones
3. Every Monday 9am UTC — weekly vendor stats messages
"""
import os
from datetime import datetime, timezone

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger
    APScheduler_OK = True
except ImportError:
    APScheduler_OK = False

from app.db import SessionLocal
from sqlalchemy import text

GROQ_MODEL = "llama-3.3-70b-versatile"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def create_scheduler():
    if not APScheduler_OK:
        print("[Scheduler] APScheduler not installed — skipping")
        return None

    scheduler = AsyncIOScheduler()

    # Expire/activate deals every 5 min
    scheduler.add_job(expire_deals, IntervalTrigger(minutes=5), id="expire_deals", replace_existing=True)

    # Auto flash deal engine every 30 min
    scheduler.add_job(auto_flash_engine, IntervalTrigger(minutes=30), id="auto_flash", replace_existing=True)

    # Weekly stats every Monday at 9am UTC
    scheduler.add_job(send_weekly_stats, CronTrigger(day_of_week="mon", hour=9, minute=0),
                      id="weekly_stats", replace_existing=True)

    return scheduler


# ── Job: expire + activate deals ─────────────────────────────────────
def expire_deals():
    from app.services.deal_service import DealService
    DealService().expire_old_deals()


# ── Job: auto flash deal engine ───────────────────────────────────────
async def auto_flash_engine():
    """For vendors with < 2 orders in last 2 hours, auto-create a deal."""
    db = SessionLocal()
    try:
        slow_vendors = db.execute(
            text("""
                SELECT v.id, v.name, v.phone,
                       ST_Y(v.location::geometry) as lat,
                       ST_X(v.location::geometry) as lng
                FROM vendors v
                WHERE (
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
    """Pick best menu item and auto-create a 45-min deal."""
    import os, json, re
    from datetime import timedelta

    db = SessionLocal()
    try:
        menu = db.execute(
            text("SELECT item_name, price FROM menus WHERE vendor_id = :vid AND is_available = true LIMIT 20"),
            {"vid": vendor.id}
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
            messages=[{
                "role": "user",
                "content": (
                    f'Vendor "{vendor.name}" sells: {menu_str}. '
                    'It\'s a slow period. Pick 1 item for a flash deal. '
                    'Return ONLY JSON: {"item": "...", "discount_pct": 30, "quantity": 15, "reason": "..."}'
                )
            }],
            max_tokens=150,
            temperature=0.7,
        )
        raw = resp.choices[0].message.content or "{}"
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
        suggestion = json.loads(raw)
    except Exception as e:
        print(f"[AutoDeal] Groq error for {vendor.id}: {e}")
        # Fallback: pick first item, 30% off
        suggestion = {"item": menu[0].item_name, "discount_pct": 30, "quantity": 15}

    now = datetime.now(timezone.utc)
    end_time = (now + timedelta(minutes=45)).isoformat()

    # Find original price
    db2 = SessionLocal()
    try:
        price_row = db2.execute(
            text("SELECT price FROM menus WHERE vendor_id = :vid AND item_name ILIKE :name LIMIT 1"),
            {"vid": vendor.id, "name": f"%{suggestion['item']}%"}
        ).fetchone()
        original_price = float(price_row.price) if price_row else None
    finally:
        db2.close()

    deal_price = round(original_price * (1 - suggestion["discount_pct"] / 100), 2) if original_price else None

    from app.services.deal_service import DealService
    DealService().create_flash_deal({
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
    })

    # Notify vendor
    from app.services.notify_service import notify_service
    disc = suggestion["discount_pct"]
    msg = (
        f"🤖 Creamos un deal para ti:\n"
        f"{disc}% off {suggestion['item']} por 45 min.\n"
        f"Ya notificamos a clientes cercanos.\n"
        f"Responde STOP para cancelar."
    )
    await notify_service.send_message(vendor.phone, msg, "sms")


# ── Job: weekly stats ─────────────────────────────────────────────────
async def send_weekly_stats():
    from app.services.deal_service import DealService
    from app.services.notify_service import notify_service

    db = SessionLocal()
    try:
        vendors = db.execute(text("SELECT id, name, phone FROM vendors")).fetchall()
    finally:
        db.close()

    svc = DealService()
    for v in vendors:
        stats = svc.get_vendor_stats(v.id, days=7)
        msg = (
            f"📊 Tu semana en InfraStreet:\n"
            f"💰 ${stats['total_revenue']:.2f} en ventas\n"
            f"🛒 {stats['total_orders']} órdenes completadas\n"
            f"⭐ Calificación: {stats['reliability_score']:.0f}%\n"
            f"🔥 Deal más popular: {stats['top_item'] or 'N/A'}\n\n"
            f"Para lanzar un deal: FLASH [hora] [artículo] [descuento]"
        )
        await notify_service.send_message(v.phone, msg, "sms")

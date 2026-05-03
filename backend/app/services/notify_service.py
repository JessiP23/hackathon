"""Twilio + Telegram notifications for vendors and customers (v3.3)."""
import os
import asyncio
from app.db import SessionLocal
from sqlalchemy import text
from twilio.rest import Client

from app.services.short_url_service import allocate_for_deal
from app.services import inapp_events

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://infrastreet.app")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_DEFAULT_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
TWILIO_VENDOR_SID = TWILIO_DEFAULT_SID
TWILIO_CUSTOMER_SID = TWILIO_DEFAULT_SID

MAX_PER_DEAL = 500
MAX_PER_DAY_PER_CUSTOMER = 3


def _short_link_base() -> str:
    return (
        os.getenv("SHORT_LINK_BASE", "").strip()
        or os.getenv("PUBLIC_BASE_URL", "").strip()
        or FRONTEND_URL
    ).rstrip("/")


class NotifyService:
    def __init__(self):
        self._client = (
            Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
            else None
        )

    async def send_message(
        self,
        phone: str,
        message: str,
        channel: str = "customer",
        reply_markup: dict | None = None,
    ) -> dict:
        if phone.startswith("tg:") and channel == "vendor":
            return await self._send_telegram_chat(phone, message, reply_markup=reply_markup)
        service_sid = TWILIO_VENDOR_SID if channel == "vendor" else TWILIO_CUSTOMER_SID
        return await self._send_twilio(phone, message, service_sid)

    async def _send_telegram_chat(
        self, phone: str, message: str, reply_markup: dict | None = None
    ) -> dict:
        from app.services import telegram_client

        try:
            chat_id = int(phone[3:]) if phone.startswith("tg:") else int(phone)
        except ValueError:
            return {"sent": False, "error": "invalid tg phone"}
        try:
            res = await telegram_client.send_message(chat_id, message[:4090], reply_markup=reply_markup)
            ok = bool(res.get("ok"))
            return {"sent": ok, "telegram": res}
        except Exception as e:
            return {"sent": False, "error": str(e)}

    async def _send_telegram_customer(self, telegram_id: int, message: str) -> dict:
        from app.services import telegram_client

        try:
            res = await telegram_client.send_message(telegram_id, message[:4090], reply_markup=None)
            ok = bool(res.get("ok"))
            return {"sent": ok, "telegram": res}
        except Exception as e:
            return {"sent": False, "error": str(e)}

    async def fan_out_deal(self, deal: dict):
        """Fan-out deal notification to nearby eligible customers."""
        lat = deal["lat"]
        lng = deal["lng"]
        radius_meters = deal.get("radius_miles", 10) * 1609.34
        deal_id = deal["deal_id"]
        vendor_id = deal["vendor_id"]
        short_code = allocate_for_deal(deal_id)
        deal_out = {**deal, "short_code": short_code}

        db = SessionLocal()
        try:
            customers = db.execute(
                text("""
                    SELECT c.id, c.phone, c.telegram_id, c.notification_channel,
                           ROUND((ST_Distance(c.location::geography,
                                  ST_MakePoint(:lng, :lat)::geography) / 1609.34)::numeric, 1) AS dist_miles
                    FROM customers c
                    WHERE c.notifications_enabled = true
                      AND c.location IS NOT NULL
                      AND ST_DWithin(c.location::geography,
                                    ST_MakePoint(:lng, :lat)::geography,
                                    :radius_meters)
                      AND (SELECT COUNT(*) FROM notifications nl
                           WHERE nl.customer_id = c.id
                             AND nl.sent_at > NOW() - INTERVAL '1 day') < :max_day
                      AND (SELECT COUNT(*) FROM notifications nl2
                           WHERE nl2.customer_id = c.id
                             AND nl2.vendor_id = :vendor_id
                             AND nl2.sent_at > NOW() - INTERVAL '30 minutes') = 0
                    ORDER BY dist_miles ASC
                    LIMIT :cap
                """),
                {
                    "lat": lat,
                    "lng": lng,
                    "radius_meters": radius_meters,
                    "max_day": MAX_PER_DAY_PER_CUSTOMER,
                    "vendor_id": vendor_id,
                    "cap": MAX_PER_DEAL,
                },
            ).fetchall()
        finally:
            db.close()

        sent = 0
        for c in customers:
            dist = float(getattr(c, "dist_miles", 0))
            msg = self._compose_deal_message(deal_out, dist)
            ch = (getattr(c, "notification_channel", None) or "sms").lower()
            tg_id = getattr(c, "telegram_id", None)

            log_ch = "sms"
            if ch == "telegram":
                if tg_id:
                    r = await self._send_telegram_customer(int(tg_id), msg)
                    log_ch = "telegram" if r.get("sent") else "sms"
                    if not r.get("sent"):
                        await self._send_twilio(c.phone, msg, TWILIO_CUSTOMER_SID)
                else:
                    await self._send_twilio(c.phone, msg, TWILIO_CUSTOMER_SID)
            elif ch == "both" and tg_id:
                await self._send_telegram_customer(int(tg_id), msg)
                await self._send_twilio(c.phone, msg, TWILIO_CUSTOMER_SID)
                log_ch = "both"
            else:
                await self._send_twilio(c.phone, msg, TWILIO_CUSTOMER_SID)

            inapp_events.try_publish(
                c.phone,
                {
                    "type": "new_deal",
                    "dealId": deal_id,
                    "itemName": deal.get("item_name") or deal_out.get("item_name"),
                    "vendorName": deal.get("vendor_name") or deal_out.get("vendor_name"),
                    "dealPrice": deal.get("deal_price"),
                    "discountPct": deal.get("discount_pct"),
                    "distMiles": dist,
                    "shortUrl": f"{_short_link_base()}/d/{short_code}",
                    "body": msg[:480],
                },
            )

            self._log_notification(c.id, deal_id, vendor_id, log_ch)
            sent += 1
            if sent % 30 == 0:
                await asyncio.sleep(1.0)

        print(f"[Notify] Sent {sent} notifications for deal {deal_id}")
        return {"sent": sent}

    def notify_vendor_order(self, vendor_phone: str, message: str):
        print(f"[Vendor notify] {vendor_phone}: {message[:120]}")
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(self.send_message(vendor_phone, message, "vendor"))
        return {"sent": True, "phone": vendor_phone}

    def notify_customer_confirmation(self, customer_phone: str, message: str):
        print(f"[Customer SMS] {customer_phone}: {message[:120]}")
        inapp_events.try_publish(
            customer_phone,
            {"type": "order", "subType": "alert", "body": message[:800]},
        )
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(self.send_message(customer_phone, message, "customer"))
        return {"sent": True, "phone": customer_phone}

    async def _send_twilio(self, phone: str, message: str, service_sid: str, retry: int = 0) -> dict:
        if not self._client or not service_sid:
            print(f"[Twilio disabled] {phone}: {message[:200]}")
            return {"sent": False, "skipped": True, "error": "Twilio not configured"}
        try:
            msg = await asyncio.to_thread(
                self._client.messages.create,
                body=message[:1000],
                messaging_service_sid=service_sid,
                to=phone,
            )
            return {"sent": True, "message_id": msg.sid}
        except Exception as e:
            if retry < 2:
                await asyncio.sleep([5, 15, 45][retry])
                return await self._send_twilio(phone, message, service_sid, retry + 1)
            return {"sent": False, "error": str(e)}

    def _compose_deal_message(self, deal: dict, dist: float) -> str:
        item = deal.get("item_name", "")
        price = deal.get("deal_price") or deal.get("price", "")
        pct = deal.get("discount_pct")
        vendor = deal.get("vendor_name", "")
        end_t = deal.get("end_time", "")
        qty = deal.get("quantity", "?")
        short_code = deal.get("short_code") or deal["deal_id"]
        short_url = f"{_short_link_base()}/d/{short_code}"
        disc = f"{int(pct)}% off" if pct else f"${price}"
        dist_mi = float(dist)
        walk_mins = max(1, int(dist_mi * 18 + 0.5))
        walk = f"{walk_mins}min walk"
        return (
            f"InfraStreet: {item} {disc} @ {vendor}, {walk}. ${price}. {qty} left til {end_t}. {short_url}"
        )[:480]

    def _log_notification(self, customer_id, deal_id, vendor_id, channel):
        db = SessionLocal()
        try:
            db.execute(
                text("""
                    INSERT INTO notifications (customer_id, deal_id, vendor_id, channel, sent_at)
                    VALUES (:cid, :did, :vid, :ch, NOW())
                    ON CONFLICT DO NOTHING
                """),
                {"cid": customer_id, "did": deal_id, "vid": vendor_id, "ch": channel},
            )
            db.commit()
        except Exception as e:
            print(f"[Notify] log error: {e}")
        finally:
            db.close()


notify_service = NotifyService()

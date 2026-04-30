"""Twilio notification service for vendor and customer SMS/WhatsApp."""
import os
import asyncio
from app.db import SessionLocal
from sqlalchemy import text
from twilio.rest import Client

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://infrastreet.app")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
# Easiest MVP: set TWILIO_MESSAGING_SERVICE_SID only (one MG + one phone number).
TWILIO_DEFAULT_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
TWILIO_VENDOR_SID = TWILIO_DEFAULT_SID
TWILIO_CUSTOMER_SID = TWILIO_DEFAULT_SID

MAX_PER_DEAL = 500
MAX_PER_DAY_PER_CUSTOMER = 3


class NotifyService:
    def __init__(self):
        self._client = (
            Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
            else None
        )

    async def send_message(self, phone: str, message: str, channel: str = "customer") -> dict:
        service_sid = TWILIO_VENDOR_SID if channel == "vendor" else TWILIO_CUSTOMER_SID
        return await self._send_twilio(phone, message, service_sid)

    async def fan_out_deal(self, deal: dict):
        """Fan-out deal notification to nearby eligible customers."""
        lat = deal["lat"]
        lng = deal["lng"]
        radius_meters = deal.get("radius_miles", 10) * 1609.34
        deal_id = deal["deal_id"]
        vendor_id = deal["vendor_id"]

        db = SessionLocal()
        try:
            customers = db.execute(
                text("""
                    SELECT c.id, c.phone, c.notification_channel,
                           ROUND((ST_Distance(c.location::geography,
                                  ST_MakePoint(:lng, :lat)::geography) / 1609.34)::numeric, 1) AS dist_miles
                    FROM customers c
                    WHERE c.notifications_enabled = true
                      AND ST_DWithin(c.location::geography,
                                    ST_MakePoint(:lng, :lat)::geography,
                                    :radius_meters)
                      AND (SELECT COUNT(*) FROM notification_logs nl
                           WHERE nl.customer_id = c.id
                             AND nl.sent_at > NOW() - INTERVAL '1 day') < :max_day
                      AND (SELECT COUNT(*) FROM notification_logs nl2
                           WHERE nl2.customer_id = c.id
                             AND nl2.vendor_id = :vendor_id
                             AND nl2.sent_at > NOW() - INTERVAL '30 minutes') = 0
                    ORDER BY dist_miles ASC
                    LIMIT :cap
                """),
                {"lat": lat, "lng": lng, "radius_meters": radius_meters,
                 "max_day": MAX_PER_DAY_PER_CUSTOMER, "vendor_id": vendor_id,
                 "cap": MAX_PER_DEAL}
            ).fetchall()
        finally:
            db.close()

        sent = 0
        for c in customers:
            dist = float(getattr(c, "dist_miles", 0))
            msg = self._compose_deal_message(deal, dist)
            await self.send_message(c.phone, msg, "customer")
            self._log_notification(c.id, deal_id, vendor_id, "sms")
            sent += 1
            if sent % 30 == 0:
                await asyncio.sleep(1.0)

        print(f"[Notify] Sent {sent} notifications for deal {deal_id}")
        return {"sent": sent}

    def notify_vendor_order(self, vendor_phone: str, message: str):
        print(f"[Vendor SMS] {vendor_phone}: {message}")
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(self.send_message(vendor_phone, message, "vendor"))
        return {"sent": True, "phone": vendor_phone}

    def notify_customer_confirmation(self, customer_phone: str, message: str):
        print(f"[Customer SMS] {customer_phone}: {message}")
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(self.send_message(customer_phone, message, "customer"))
        return {"sent": True, "phone": customer_phone}

    async def _send_twilio(self, phone: str, message: str, service_sid: str, retry: int = 0) -> dict:
        if not self._client or not service_sid:
            print(f"[Twilio disabled] {phone}: {message}")
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
        deal_id = deal["deal_id"]
        short_url = f"{FRONTEND_URL}/d/{deal_id}"
        disc = f"{int(pct)}% off" if pct else f"${price}"
        return f"InfraStreet: {item} {disc} @ {vendor}, {dist}mi. ${price}. {qty} left til {end_t}. {short_url}"[:160]

    def _log_notification(self, customer_id, deal_id, vendor_id, channel):
        db = SessionLocal()
        try:
            db.execute(
                text("""
                    INSERT INTO notification_logs (customer_id, deal_id, vendor_id, channel, sent_at)
                    VALUES (:cid, :did, :vid, :ch, NOW())
                    ON CONFLICT DO NOTHING
                """),
                {"cid": customer_id, "did": deal_id, "vid": vendor_id, "ch": channel}
            )
            db.commit()
        except Exception as e:
            print(f"[Notify] log error: {e}")
        finally:
            db.close()


notify_service = NotifyService()
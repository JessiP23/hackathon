"""
Notification service — sends WhatsApp/SMS to nearby customers when a flash deal activates.
Uses PostGIS ST_DWithin and Textbelt for SMS. WhatsApp via Meta Cloud API.
"""
import os
import asyncio
import httpx
from app.db import SessionLocal
from sqlalchemy import text

TEXTBELT_KEY = os.getenv("TEXTBELT_KEY", "textbelt")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")
BACKEND_URL = os.getenv("BACKEND_PUBLIC_URL", "https://infrastreet.app")

MAX_PER_DEAL = 500
MAX_PER_DAY_PER_CUSTOMER = 3


class NotifyService:
    async def send_message(self, phone: str, message: str, channel: str = "sms") -> dict:
        if channel == "whatsapp" and WHATSAPP_TOKEN:
            return await self._send_whatsapp(phone, message)
        return await self._send_sms(phone, message)

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
            channel = getattr(c, "notification_channel", "sms") or "sms"
            dist = float(getattr(c, "dist_miles", 0))
            msg = self._compose_deal_message(deal, dist, channel)
            await self.send_message(c.phone, msg, channel)
            self._log_notification(c.id, deal_id, vendor_id, channel)
            sent += 1
            if sent % 30 == 0:
                await asyncio.sleep(1.0)

        print(f"[Notify] Sent {sent} notifications for deal {deal_id}")
        return {"sent": sent}

    def notify_vendor_order(self, vendor_phone: str, message: str):
        print(f"[📱 Vendor] {vendor_phone}: {message}")
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(self.send_message(vendor_phone, message, "sms"))
        return {"sent": True, "phone": vendor_phone}

    def notify_customer_confirmation(self, customer_phone: str, message: str):
        print(f"[📱 Customer] {customer_phone}: {message}")
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(self.send_message(customer_phone, message, "sms"))
        return {"sent": True, "phone": customer_phone}

    async def _send_sms(self, phone: str, message: str, retry: int = 0) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://textbelt.com/text",
                    data={"phone": phone, "message": message[:160], "key": TEXTBELT_KEY},
                )
                data = resp.json()
                if data.get("success"):
                    return {"sent": True, "message_id": data.get("textId", "")}
                if retry < 2:
                    await asyncio.sleep(5 * (2 ** retry))
                    return await self._send_sms(phone, message, retry + 1)
                return {"sent": False, "error": str(data)}
        except Exception as e:
            if retry < 2:
                await asyncio.sleep(5 * (2 ** retry))
                return await self._send_sms(phone, message, retry + 1)
            return {"sent": False, "error": str(e)}

    async def _send_whatsapp(self, phone: str, message: str, retry: int = 0) -> dict:
        if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
            return await self._send_sms(phone, message)
        try:
            url = f"https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}/messages"
            headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}", "Content-Type": "application/json"}
            payload = {"messaging_product": "whatsapp", "to": phone,
                       "type": "text", "text": {"body": message[:1000]}}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    return {"sent": True, "message_id": resp.json().get("messages", [{}])[0].get("id", "")}
                if retry < 2:
                    await asyncio.sleep(5 * (2 ** retry))
                    return await self._send_whatsapp(phone, message, retry + 1)
                return await self._send_sms(phone, message)
        except Exception as e:
            if retry < 2:
                await asyncio.sleep(5 * (2 ** retry))
                return await self._send_whatsapp(phone, message, retry + 1)
            return await self._send_sms(phone, message)

    def _compose_deal_message(self, deal: dict, dist: float, channel: str) -> str:
        item = deal.get("item_name", "")
        price = deal.get("deal_price") or deal.get("price", "")
        orig = deal.get("original_price")
        pct = deal.get("discount_pct")
        vendor = deal.get("vendor_name", "")
        end_t = deal.get("end_time", "")
        qty = deal.get("quantity", "?")
        deal_id = deal["deal_id"]
        short_url = f"{BACKEND_URL}/d/{deal_id}"

        if channel == "sms":
            disc = f"{int(pct)}%" if pct else f"${price}"
            return f"🔥 {item} {disc} off @ {vendor}, {dist}mi. ${price}. {qty} left til {end_t}. {short_url}"[:160]

        savings = f"\n💰 Solo ${price} (antes ${orig})" if orig else (f"\n💰 {int(pct)}% de descuento" if pct else "")
        return (
            f"🔥 Deal cerca de ti!\n{item} — {f'{int(pct)}% off' if pct else f'${price}'}\n"
            f"📍 {vendor} · {dist} millas\n⏰ Hasta las {end_t} · {qty} disponibles"
            f"{savings}\n👉 {short_url}"
        )[:1000]

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
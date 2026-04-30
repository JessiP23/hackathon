"""Customer notify opt-in + OTP SMS (v3.3 §9)."""
from __future__ import annotations

import os
import random
import re

from sqlalchemy import text

from app.db import SessionLocal

OTP_TTL = int(os.getenv("NOTIFY_OTP_TTL_SECONDS", "600"))


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return ""
    if phone.strip().startswith("+") or len(digits) > 10:
        return "+" + digits.lstrip("+")
    if len(digits) == 10:
        return "+1" + digits
    return "+" + digits


def _redis():
    try:
        import redis

        r = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"), decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


class CustomerService:
    def notify_opt_in(self, lat: float, lng: float, radius: int, phone: str) -> dict:
        norm = _normalize_phone(phone)
        if not norm or len(norm) < 10:
            return {"success": False, "error": "invalid_phone"}

        otp = f"{random.randint(0, 999999):06d}"
        r = _redis()
        if r:
            r.setex(f"notify_otp:{norm}", OTP_TTL, otp)

        db = SessionLocal()
        try:
            db.execute(
                text("""
                    INSERT INTO customers (phone, location, radius_miles, notifications_enabled, notification_channel)
                    VALUES (
                        :phone,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :radius, true, 'sms'
                    )
                    ON CONFLICT (phone) DO UPDATE SET
                        location = EXCLUDED.location,
                        radius_miles = EXCLUDED.radius_miles,
                        notifications_enabled = true
                """),
                {"phone": norm, "lat": lat, "lng": lng, "radius": radius},
            )
            db.commit()
        finally:
            db.close()

        sms_sent = False
        twilio_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "").strip()
        twilio_account = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        if twilio_sid and twilio_account and twilio_token:
            try:
                from twilio.rest import Client

                client = Client(twilio_account, twilio_token)
                body = f"InfraStreet code: {otp}. Alerts on for deals near you. Reply STOP to opt out."
                client.messages.create(
                    body=body[:1000],
                    messaging_service_sid=twilio_sid,
                    to=norm,
                )
                sms_sent = True
            except Exception as e:
                print(f"[notify_opt_in] SMS error: {e}")

        return {"success": True, "otpSent": sms_sent}

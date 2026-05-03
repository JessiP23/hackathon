from __future__ import annotations

"""
Vendor bot entrypoints — Telegram (tg:chat_id) and Twilio SMS/MMS.
Conversation state lives in vendor_telegram_fsm (Redis / memory).
"""

from app.services import vendor_telegram_fsm as fsm


class AgentService:
    """Thin facade over the strict one-question FSM."""

    async def handle_vendor_message(
        self,
        phone: str,
        text_body: str,
        media_url: str | None = None,
        image_bytes: bytes | None = None,
        telegram_language_code: str | None = None,
    ) -> str:
        return await fsm.handle_vendor_message(
            phone,
            text_body,
            media_url=media_url,
            image_bytes=image_bytes,
            telegram_language_code=telegram_language_code,
        )

    async def handle_vendor_location(
        self,
        phone: str,
        lat: float,
        lng: float,
        telegram_language_code: str | None = None,
    ) -> str:
        return await fsm.handle_vendor_location(
            phone, lat, lng, telegram_language_code=telegram_language_code
        )

    def _get_state(self, phone: str):
        return fsm.get_state(phone)

    # Legacy helpers used by tooling / imports
    def _get_vendor_by_phone(self, phone: str):
        return fsm._get_vendor_row(phone)

    def _get_vendor_by_id(self, vendor_id: str):
        from app.db import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
                    SELECT id, name, phone,
                           ST_Y(location::geometry) AS lat,
                           ST_X(location::geometry) AS lng
                    FROM vendors
                    WHERE id = :id
                    """
                ),
                {"id": vendor_id},
            ).fetchone()
            return dict(row._mapping) if row else None
        finally:
            db.close()


agent_service = AgentService()

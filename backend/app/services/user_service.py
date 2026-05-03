import os
import secrets
import uuid
from app.db import SessionLocal
from sqlalchemy import text
from app.services.customer_service import _normalize_phone

REFERRAL_POINTS_REFERRER = int(os.getenv("REFERRAL_POINTS_REFERRER", "200"))
REFERRAL_POINTS_REFEREE = int(os.getenv("REFERRAL_POINTS_REFEREE", "100"))


def _new_referral_code(db) -> str:
    for _ in range(12):
        code = secrets.token_hex(4)
        hit = db.execute(
            text("SELECT 1 FROM users WHERE referral_code = :c LIMIT 1"),
            {"c": code},
        ).fetchone()
        if not hit:
            return code
    return secrets.token_hex(6)


class UserService:
    def create_user(self, payload):
        phone = _normalize_phone(payload.phone)
        ref_raw = (getattr(payload, "referredBy", None) or "").strip()
        user_id = f"u_{uuid.uuid4().hex[:8]}"
        db = SessionLocal()
        try:
            existing = db.execute(
                text(
                    """
                    SELECT id, role, referral_code, COALESCE(reward_points, 0)
                    FROM users WHERE phone = :phone
                    """
                ),
                {"phone": phone},
            ).fetchone()

            if existing:
                uid, erole, ercode, erpoints = existing[0], existing[1], existing[2], existing[3]
                if not ercode:
                    code = _new_referral_code(db)
                    db.execute(
                        text("UPDATE users SET referral_code = :c WHERE id = :id"),
                        {"c": code, "id": uid},
                    )
                    db.commit()
                    ercode = code
                return {
                    "userId": uid,
                    "phone": phone,
                    "role": erole,
                    "isExisting": True,
                    "rewardPoints": int(erpoints or 0),
                    "referralCode": ercode,
                }

            ref_user_id = None
            if ref_raw:
                rrow = db.execute(
                    text(
                        """
                        SELECT id FROM users
                        WHERE id = :ref OR referral_code = :ref
                        LIMIT 1
                        """
                    ),
                    {"ref": ref_raw},
                ).fetchone()
                if rrow:
                    ref_user_id = rrow[0]

            rcode = _new_referral_code(db)
            db.execute(
                text("""
                    INSERT INTO users (id, phone, role, name, referral_code, referred_by_user_id)
                    VALUES (:id, :phone, :role, :name, :rcode, :refby)
                """),
                {
                    "id": user_id,
                    "phone": phone,
                    "role": payload.role,
                    "name": payload.name,
                    "rcode": rcode,
                    "refby": ref_user_id,
                },
            )

            referee_pts = 0
            if ref_user_id and ref_user_id != user_id:
                db.execute(
                    text(
                        "UPDATE users SET reward_points = reward_points + :pts WHERE id = :rid"
                    ),
                    {"pts": REFERRAL_POINTS_REFERRER, "rid": ref_user_id},
                )
                db.execute(
                    text(
                        "UPDATE users SET reward_points = reward_points + :pts WHERE id = :uid"
                    ),
                    {"pts": REFERRAL_POINTS_REFEREE, "uid": user_id},
                )
                referee_pts = REFERRAL_POINTS_REFEREE

            db.commit()

            return {
                "userId": user_id,
                "phone": phone,
                "role": payload.role,
                "name": payload.name,
                "isExisting": False,
                "rewardPoints": referee_pts,
                "referralCode": rcode,
                "referralBonusApplied": bool(ref_user_id),
            }
        finally:
            db.close()

    def get_user_by_phone(self, phone: str):
        norm = _normalize_phone(phone)
        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
                    SELECT id, phone, role, name, COALESCE(reward_points, 0), referral_code
                    FROM users WHERE phone = :phone
                    """
                ),
                {"phone": norm},
            ).fetchone()
            if not row:
                row = db.execute(
                    text(
                        """
                        SELECT id, phone, role, name, COALESCE(reward_points, 0), referral_code
                        FROM users WHERE phone = :plike
                        """
                    ),
                    {"plike": phone},
                ).fetchone()
            if not row:
                return None

            uid, ph, role, name, rpoints, rcode = row[0], row[1], row[2], row[3], row[4], row[5]
            if not rcode:
                code = _new_referral_code(db)
                db.execute(
                    text("UPDATE users SET referral_code = :c WHERE id = :id"),
                    {"c": code, "id": uid},
                )
                db.commit()
                rcode = code

            return {
                "userId": uid,
                "phone": ph,
                "role": role,
                "name": name,
                "rewardPoints": int(rpoints or 0),
                "referralCode": rcode,
            }
        finally:
            db.close()

    def try_redeem_with_session(
        self, db, phone: str, points_to_redeem: int, max_discount_usd: float
    ) -> tuple[int, float]:
        """Use within caller transaction. 1 point = 1 cent."""
        if points_to_redeem <= 0 or max_discount_usd <= 0:
            return 0, 0.0
        norm = _normalize_phone(phone)
        row = db.execute(
            text(
                """
                SELECT id, COALESCE(reward_points, 0)
                FROM users WHERE phone = :phone
                FOR UPDATE
                """
            ),
            {"phone": norm},
        ).fetchone()
        if not row and phone != norm:
            row = db.execute(
                text(
                    """
                    SELECT id, COALESCE(reward_points, 0)
                    FROM users WHERE phone = :phone
                    FOR UPDATE
                    """
                ),
                {"phone": phone},
            ).fetchone()
        if not row:
            return 0, 0.0
        balance = int(row[1] or 0)
        max_cents = max(0, int(round(max_discount_usd * 100)))
        want_cents = min(int(points_to_redeem), balance, max_cents)
        if want_cents <= 0:
            return 0, 0.0
        res = db.execute(
            text(
                """
                UPDATE users
                SET reward_points = reward_points - :spent
                WHERE id = :uid AND reward_points >= :spent
                """
            ),
            {"spent": want_cents, "uid": row[0]},
        )
        if res.rowcount != 1:
            return 0, 0.0
        return want_cents, round(want_cents / 100.0, 2)

    def try_redeem_points_for_phone(self, phone: str, points_to_redeem: int, max_discount_usd: float) -> tuple[int, float]:
        """Standalone transaction — 1 point = 1 cent."""
        if points_to_redeem <= 0 or max_discount_usd <= 0:
            return 0, 0.0
        db = SessionLocal()
        try:
            with db.begin():
                return self.try_redeem_with_session(db, phone, points_to_redeem, max_discount_usd)
        except Exception:
            return 0, 0.0
        finally:
            db.close()

    def set_customer_notifications(self, phone: str, enabled: bool):
        db = SessionLocal()
        try:
            db.execute(
                text("""
                    UPDATE customers
                    SET notifications_enabled = :enabled
                    WHERE phone = :phone
                """),
                {"phone": phone, "enabled": enabled},
            )
            db.commit()
            return {"phone": phone, "notificationsEnabled": enabled}
        finally:
            db.close()

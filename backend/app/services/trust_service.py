"""Reliability scores (0–100, matches existing vendors/customers columns) and strikes."""
from __future__ import annotations

from sqlalchemy import text

from app.db import SessionLocal


def _clamp_score(v: float) -> float:
    return max(0.0, min(100.0, v))


def update_trust_score(
    entity_type: str,
    entity_id: str,
    event_type: str,
    delta: float,
    order_id: str,
    notes: str | None = None,
) -> float:
    """
    Apply a delta on the 0–1 scale from product spec, stored as 0–100 in the database.
    E.g. delta=0.002 → +0.2 points; delta=-0.15 → -15 points.
    """
    db_delta = delta * 100.0
    db = SessionLocal()
    try:
        if entity_type == "vendor":
            row = db.execute(
                text("SELECT COALESCE(reliability_score, 100) FROM vendors WHERE id = :id"),
                {"id": entity_id},
            ).fetchone()
            if not row:
                return 100.0
            current = float(row[0] or 100)
            new_score = _clamp_score(current + db_delta)
            db.execute(
                text("UPDATE vendors SET reliability_score = :s WHERE id = :id"),
                {"s": new_score, "id": entity_id},
            )
        else:
            row = db.execute(
                text("SELECT COALESCE(reliability_score, 100) FROM customers WHERE id = :id"),
                {"id": entity_id},
            ).fetchone()
            if not row:
                return 100.0
            current = float(row[0] or 100)
            new_score = _clamp_score(current + db_delta)
            db.execute(
                text("UPDATE customers SET reliability_score = :s WHERE id = :id"),
                {"s": new_score, "id": entity_id},
            )

        db.execute(
            text(
                """
                INSERT INTO trust_events (entity_type, entity_id, event_type, delta, new_score, order_id, notes)
                VALUES (:et, :eid, :ev, :d, :ns, :oid, :notes)
                """
            ),
            {
                "et": entity_type,
                "eid": entity_id,
                "ev": event_type,
                "d": delta,
                "ns": new_score,
                "oid": order_id,
                "notes": notes,
            },
        )
        db.commit()
        return new_score / 100.0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def update_no_show_strikes(customer_id: str) -> None:
    db = SessionLocal()
    try:
        row = db.execute(
            text(
                """
                SELECT COALESCE(no_show_strikes, 0), COALESCE(total_no_shows, 0)
                FROM customers WHERE id = :id
                """
            ),
            {"id": customer_id},
        ).fetchone()
        if not row:
            return
        strikes = int(row[0] or 0) + 1
        total_ns = int(row[1] or 0) + 1
        if strikes >= 3:
            trust_level = 3
        elif strikes >= 2:
            trust_level = 2
        elif strikes >= 1:
            trust_level = 1
        else:
            trust_level = 0
        db.execute(
            text(
                """
                UPDATE customers
                SET no_show_strikes = :s, trust_level = :tl, total_no_shows = :tn
                WHERE id = :id
                """
            ),
            {"s": strikes, "tl": trust_level, "tn": total_ns, "id": customer_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

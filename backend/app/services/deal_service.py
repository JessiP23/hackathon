from app.db import SessionLocal
from sqlalchemy import text
from datetime import datetime, timezone
import asyncio


class DealService:
    # ── Customer-facing: ranked nearby deals ───────────────────────────
    def get_deals_nearby(self, lat: float, lng: float, limit: int = 20):
        db = SessionLocal()
        try:
            deals = db.execute(
                text("""
                    SELECT
                        d.id as deal_id, d.vendor_id, d.item_name,
                        d.original_price, d.deal_price, d.discount_pct,
                        d.remaining_quantity, d.end_at, d.status, d.media_url,
                        v.name as vendor_name, v.reliability_score,
                        ST_Distance(d.location, ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography) as distance_m
                    FROM flash_deals d
                    LEFT JOIN vendors v ON v.id = d.vendor_id
                    WHERE d.status = 'active'
                      AND d.end_at > NOW()
                      AND d.remaining_quantity > 0
                    ORDER BY distance_m ASC
                    LIMIT :limit
                """),
                {"lat": lat, "lng": lng, "limit": limit}
            ).fetchall()

            result = []
            for d in deals:
                dist_miles = float(d.distance_m or 0) / 1609.34
                discount = float(d.discount_pct or 0)
                reliability = float(d.reliability_score or 50)
                # Ranking: 40% distance, 35% discount, 25% reliability
                score = (1 / max(dist_miles, 0.1)) * 0.4 + (discount / 100) * 0.35 + (reliability / 100) * 0.25
                result.append({
                    "dealId": d.deal_id,
                    "vendorId": d.vendor_id,
                    "vendorName": d.vendor_name,
                    "itemName": d.item_name,
                    "originalPrice": float(d.original_price) if d.original_price else None,
                    "dealPrice": float(d.deal_price) if d.deal_price else None,
                    "discountPct": float(d.discount_pct) if d.discount_pct else None,
                    "remainingQuantity": d.remaining_quantity,
                    "expiresAt": d.end_at.isoformat() if d.end_at else None,
                    "distance_m": int(d.distance_m or 0),
                    "distanceMiles": round(dist_miles, 1),
                    "mediaUrl": d.media_url,
                    "reliabilityScore": reliability,
                    "rankScore": round(score, 4),
                })
            result.sort(key=lambda x: -x["rankScore"])
            return {"deals": result}
        finally:
            db.close()

    # Alias used by older router
    def find_nearby(self, lat: float, lng: float, limit: int = 20):
        return self.get_deals_nearby(lat, lng, limit)

    # ── Flash deal creation (full lifecycle) ───────────────────────────
    def create_flash_deal(self, data: dict) -> dict:
        db = SessionLocal()
        try:
            vendor_id = data["vendor_id"]
            item_name = data["item_name"]
            deal_price = data.get("deal_price")
            original_price = data.get("original_price")
            discount_pct = data.get("discount_pct")
            quantity = int(data.get("quantity") or 20)
            radius_miles = float(data.get("radius_miles") or 10)
            start_time = data.get("start_time") or datetime.now(timezone.utc).isoformat()
            end_time = data["end_time"]
            media_url = data.get("media_url")
            lat = data.get("lat", 0)
            lng = data.get("lng", 0)

            # Compute deal_price from discount_pct if needed
            if not deal_price and discount_pct and original_price:
                deal_price = round(original_price * (1 - discount_pct / 100), 2)

            # Determine status: scheduled vs active
            start_dt = datetime.fromisoformat(str(start_time).replace("Z", "+00:00")) if start_time else datetime.now(timezone.utc)
            status = "active" if start_dt <= datetime.now(timezone.utc) else "scheduled"

            result = db.execute(
                text("""
                    INSERT INTO flash_deals (
                        id, vendor_id, item_name, original_price, deal_price,
                        discount_pct, remaining_quantity, total_quantity,
                        start_at, end_at, status, radius_miles, media_url, location
                    ) VALUES (
                        'fd_' || substr(md5(random()::text), 1, 8),
                        :vendor_id, :item_name, :original_price, :deal_price,
                        :discount_pct, :quantity, :quantity,
                        :start_at, :end_at, :status, :radius_miles, :media_url,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    )
                    RETURNING id
                """),
                {
                    "vendor_id": vendor_id, "item_name": item_name,
                    "original_price": original_price, "deal_price": deal_price,
                    "discount_pct": discount_pct, "quantity": quantity,
                    "start_at": start_time, "end_at": end_time,
                    "status": status, "radius_miles": radius_miles,
                    "media_url": media_url, "lat": lat, "lng": lng,
                }
            )
            row = result.fetchone()
            if row is None:
                raise RuntimeError("Failed to create flash deal")
            deal_id = row[0]
            db.commit()

            # Fan out notifications asynchronously
            if status == "active":
                deal_info = {
                    "deal_id": deal_id, "vendor_id": vendor_id,
                    "vendor_name": data.get("vendor_name", ""),
                    "item_name": item_name, "deal_price": deal_price,
                    "original_price": original_price, "discount_pct": discount_pct,
                    "quantity": quantity, "end_time": end_time,
                    "radius_miles": radius_miles, "lat": lat, "lng": lng,
                }
                self._trigger_fan_out(deal_info)

            return {"dealId": deal_id, "status": status}
        finally:
            db.close()

    def _trigger_fan_out(self, deal_info: dict):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                from app.services.notify_service import notify_service
                asyncio.create_task(notify_service.fan_out_deal(deal_info))
        except Exception as e:
            print(f"[DealService] fan-out error: {e}")

    # Alias for old router
    def create_deal(self, payload) -> dict:
        if hasattr(payload, "vendorId"):
            data = {
                "vendor_id": payload.vendorId,
                "item_name": payload.itemName,
                "deal_price": payload.dealPrice,
                "original_price": getattr(payload, "originalPrice", None),
                "end_time": payload.expiresAt,
                "lat": 0, "lng": 0,
            }
        else:
            data = {k: v for k, v in payload.items()}
            data.setdefault("lat", 0)
            data.setdefault("lng", 0)
        return self.create_flash_deal(data)

    # ── Cancel deal + refund all paid orders ───────────────────────────
    def cancel_deal(self, deal_id: str, vendor_id: str) -> dict:
        db = SessionLocal()
        try:
            db.execute(
                text("""
                    UPDATE flash_deals
                    SET status = 'cancelled',
                        remaining_quantity = total_quantity
                    WHERE id = :id
                      AND vendor_id = :vid
                      AND status IN ('active', 'scheduled')
                """),
                {"id": deal_id, "vid": vendor_id}
            )
            # Get paid orders to refund
            orders = db.execute(
                text("SELECT id, customer_phone, stripe_payment_intent FROM orders WHERE deal_id = :did AND status = 'paid'"),
                {"did": deal_id}
            ).fetchall()
            db.commit()

            refunds = 0
            from app.services.stripe_service import stripe_service
            from app.services.notify_service import notify_service
            for o in orders:
                if o.stripe_payment_intent:
                    r = stripe_service.refund_payment_intent(o.stripe_payment_intent)
                    if r.get("refunded"):
                        db.execute(
                            text("UPDATE orders SET status = 'refunded' WHERE id = :oid"),
                            {"oid": o.id}
                        )
                        refunds += 1
                notify_service.notify_customer_confirmation(
                    o.customer_phone,
                    "El vendor cancelo este deal. Tu pago sera reembolsado en 3-5 dias."
                )
            db.commit()
            return {"cancelled": True, "refunds_issued": refunds}
        finally:
            db.close()

    def cancel_vendor_active_deals(self, vendor_id: str) -> int:
        db = SessionLocal()
        try:
            deals = db.execute(
                text("SELECT id FROM flash_deals WHERE vendor_id = :vid AND status IN ('active','scheduled')"),
                {"vid": vendor_id}
            ).fetchall()
            db.close()
        except Exception:
            db.close()
            return 0
        total_refunds = 0
        for d in deals:
            res = self.cancel_deal(d.id, vendor_id)
            total_refunds += res.get("refunds_issued", 0)
        return total_refunds

    # ── Expire deals (called by scheduler) ────────────────────────────
    def expire_old_deals(self):
        db = SessionLocal()
        try:
            db.execute(
                text("UPDATE flash_deals SET status = 'expired' WHERE status = 'active' AND end_at < NOW()")
            )
            db.execute(
                text("UPDATE flash_deals SET status = 'active' WHERE status = 'scheduled' AND start_at <= NOW()")
            )
            db.execute(
                text("UPDATE flash_deals SET status = 'sold_out' WHERE status = 'active' AND remaining_quantity = 0")
            )
            db.commit()
        finally:
            db.close()

    # ── Vendor stats ───────────────────────────────────────────────────
    def get_vendor_stats(self, vendor_id: str, days: int = 7) -> dict:
        db = SessionLocal()
        try:
            row = db.execute(
                text("""
                    SELECT
                        COALESCE(SUM(o.total), 0) as total_revenue,
                        COUNT(o.id) as total_orders,
                        v.reliability_score,
                        (SELECT item_name FROM flash_deals fd2
                         WHERE fd2.vendor_id = :vid
                           AND fd2.created_at > NOW() - (:days * INTERVAL '1 day')
                         GROUP BY item_name ORDER BY COUNT(*) DESC LIMIT 1) as top_item
                    FROM vendors v
                    LEFT JOIN orders o ON o.vendor_id = :vid
                        AND o.status = 'fulfilled'
                        AND o.created_at > NOW() - (:days * INTERVAL '1 day')
                    WHERE v.id = :vid
                    GROUP BY v.reliability_score
                """),
                {"vid": vendor_id, "days": days}
            ).fetchone()
            if not row:
                return {"total_revenue": 0, "total_orders": 0, "reliability_score": 100, "top_item": None}
            return {
                "total_revenue": float(row.total_revenue or 0),
                "total_orders": int(row.total_orders or 0),
                "reliability_score": float(row.reliability_score or 100),
                "top_item": row.top_item,
            }
        finally:
            db.close()

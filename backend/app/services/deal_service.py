import uuid
from datetime import datetime
from app.db import SessionLocal
from sqlalchemy import text


class DealService:
    def create_deal(self, payload):
        db = SessionLocal()
        try:
            deal_id = f"d_{uuid.uuid4().hex[:8]}"
            
            # Parse expires_at
            expires_at = payload.expiresAt
            if isinstance(expires_at, str):
                try:
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                except:
                    expires_at = datetime.utcnow()
            
            db.execute(
                text("""
                    INSERT INTO deals (id, vendor_id, item_name, original_price, deal_price, expires_at, location)
                    SELECT :id, :vendor_id, :item_name, :original_price, :deal_price, :expires_at, location
                    FROM vendors WHERE id = :vendor_id
                """),
                {
                    "id": deal_id,
                    "vendor_id": payload.vendorId,
                    "item_name": payload.itemName,
                    "original_price": getattr(payload, 'originalPrice', None),
                    "deal_price": payload.dealPrice,
                    "expires_at": expires_at
                }
            )
            db.commit()
            
            return {"dealId": deal_id, "status": "active"}
        finally:
            db.close()

    def find_nearby(self, lat: float, lng: float, limit: int = 10):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT 
                        d.id, d.item_name, d.deal_price, d.original_price,
                        d.vendor_id, v.name AS vendor_name,
                        ST_Distance(
                            d.location,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                        ) AS distance_m
                    FROM deals d
                    JOIN vendors v ON v.id = d.vendor_id
                    WHERE d.expires_at > now() 
                      AND d.is_active = true
                      AND d.location IS NOT NULL
                    ORDER BY distance_m
                    LIMIT :limit
                """),
                {"lat": lat, "lng": lng, "limit": limit}
            ).fetchall()

            return {
                "deals": [
                    {
                        "dealId": r.id,
                        "item": r.item_name,
                        "price": float(r.deal_price),
                        "originalPrice": float(r.original_price) if r.original_price else None,
                        "vendorId": r.vendor_id,
                        "vendorName": r.vendor_name,
                        "distance_m": int(r.distance_m) if r.distance_m else 0
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()
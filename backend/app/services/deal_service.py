import uuid
from app.db import SessionLocal
from sqlalchemy import text

class DealService:
    def create_deal(self, payload):
        db = SessionLocal()
        deal_id = f"d_{uuid.uuid4().hex[:8]}"
        db.execute(
            text("""
              INSERT INTO deals (id, vendor_id, item_name, deal_price, expires_at, location)
              SELECT :id, :vendor_id, :item_name, :deal_price, :expires_at, location
              FROM vendors WHERE id = :vendor_id
            """),
            {
                "id": deal_id,
                "vendor_id": payload.vendorId,
                "item_name": payload.itemName,
                "deal_price": payload.dealPrice,
                "expires_at": payload.expiresAt,
            }
        )
        db.commit()
        return {
            "dealId": deal_id
        }
    
    def find_nearby(self, lat, lon):
        db = SessionLocal()
        rows = db.execute(
            text("""
              SELECT item_name, deal_price,
                ST_Distance(
                  location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                ) AS distance_m
              FROM deals
              WHERE expires_at > now()
              ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
              LIMIT 10
            """),
            {"lat": lat, "lon": lon}
        ).fetchall()

        return {
            "deals": [
                {
                    "item": r.item_name,
                    "price": float(r.deal_price),
                    "distance_m": int(r.distance_m),
                }
                for r in rows
            ]
        }
from app.db import SessionLocal
from sqlalchemy import text
from datetime import datetime


class DealService:
    def get_deals_nearby(self, lat: float, lng: float, limit: int = 20):
        """Get active deals sorted by distance"""
        db = SessionLocal()
        try:
            deals = db.execute(
                text("""
                    SELECT 
                        d.id as deal_id,
                        d.vendor_id,
                        d.item_name,
                        d.original_price,
                        d.deal_price,
                        d.expires_at,
                        v.name as vendor_name,
                        ST_Distance(
                            d.location, 
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                        ) as distance_m
                    FROM deals d
                    LEFT JOIN vendors v ON v.id = d.vendor_id
                    WHERE d.is_active = true 
                    AND d.expires_at > NOW()
                    ORDER BY distance_m ASC
                    LIMIT :limit
                """),
                {"lat": lat, "lng": lng, "limit": limit}
            ).fetchall()

            return {
                "deals": [
                    {
                        "dealId": d.deal_id,
                        "vendorId": d.vendor_id,
                        "vendorName": d.vendor_name,
                        "itemName": d.item_name,
                        "originalPrice": float(d.original_price) if d.original_price else None,
                        "dealPrice": float(d.deal_price),
                        "expiresAt": d.expires_at.isoformat() if d.expires_at else None,
                        "distance_m": int(d.distance_m) if d.distance_m else None,
                    }
                    for d in deals
                ]
            }
        finally:
            db.close()

    def create_deal(self, data: dict):
        """Create a new deal"""
        db = SessionLocal()
        try:
            vendor_id = data["vendorId"]
            item_name = data["itemName"]
            deal_price = data["dealPrice"]
            original_price = data.get("originalPrice")
            expires_at = data.get("expiresAt")

            # Get vendor location
            vendor = db.execute(
                text("SELECT location FROM vendors WHERE id = :vid"),
                {"vid": vendor_id}
            ).fetchone()

            location = vendor.location if vendor else None

            result = db.execute(
                text("""
                    INSERT INTO deals (id, vendor_id, item_name, original_price, deal_price, expires_at, location, is_active)
                    VALUES (
                        'd_' || substr(md5(random()::text), 1, 8),
                        :vendor_id,
                        :item_name,
                        :original_price,
                        :deal_price,
                        :expires_at,
                        :location,
                        true
                    )
                    RETURNING id
                """),
                {
                    "vendor_id": vendor_id,
                    "item_name": item_name,
                    "original_price": original_price,
                    "deal_price": deal_price,
                    "expires_at": expires_at,
                    "location": location,
                }
            )
            db.commit()
            deal_id = result.fetchone()[0]

            return {"dealId": deal_id, "status": "created"}
        finally:
            db.close()
import uuid
from app.db import SessionLocal
from sqlalchemy import text


class DealService:
    def create_deal(self, payload):
        db = SessionLocal()
        try:
            deal_id = f"d_{uuid.uuid4().hex[:8]}"
            db.execute(
                text(
                    """
                  INSERT INTO deals (id, vendor_id, item_name, deal_price, expires_at, location)
                  SELECT :id, :vendor_id, :item_name, :deal_price, :expires_at, location
                  FROM vendors WHERE id = :vendor_id
                """
                ),
                {
                    "id": deal_id,
                    "vendor_id": payload.vendorId,
                    "item_name": payload.itemName,
                    "deal_price": payload.dealPrice,
                    "expires_at": payload.expiresAt,
                },
            )
            db.commit()
            return {"dealId": deal_id}
        finally:
            db.close()

    def find_nearby(self, lat, lng):
        db = SessionLocal()
        try:
            rows = db.execute(
                text(
                    """
                  SELECT d.item_name, d.deal_price, d.vendor_id, v.name AS vendor_name,
                    ST_Distance(
                      d.location,
                      ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    ) AS distance_m
                  FROM deals d
                  JOIN vendors v ON v.id = d.vendor_id
                  WHERE d.expires_at > now()
                  ORDER BY d.location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                  LIMIT 10
                """
                ),
                {"lat": lat, "lng": lng},
            ).fetchall()

            return {
                "deals": [
                    {
                        "item": r.item_name,
                        "price": float(r.deal_price),
                        "vendorId": r.vendor_id,
                        "vendorName": r.vendor_name,
                        "distance_m": int(r.distance_m),
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()
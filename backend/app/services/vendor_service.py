import uuid
from app.db import SessionLocal
from sqlalchemy import text

class VendorService:
    def create_vendor(self, payload):
        db = SessionLocal()
        vendor_id = f"v_{uuid.uuid4().hex[:8]}"
        
        db.execute(
            text("""
              INSERT INTO vendors (id, name, phone, location)
              VALUES (:id, :name, :phone,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))
            """),
            {
                "id": vendor_id,
                "name": payload.name,
                "phone": payload.phone,
                "lat": payload.lat,
                "lon": payload.lon
            }
        )
        db.commit()
        # persist to DB
        return {
            "vendorId": vendor_id
        }
    
    def upload_menu(self, payload):
        # do OCR + structure menu
        return {
            "status": "menu_processed",
            "vendorId": payload.vendorId
        }
    
    def search_nearby(self, query, lat, lon):
        # DO geospatial + search
        db = SessionLocal()
        rows = db.execute(
            text("""
              SELECT id, name,
                ST_Distance(
                  location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                ) AS distance_m
              FROM vendors
              ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
              LIMIT 10
            """),
            {"lat": lat, "lon": lon}
        ).fetchall()

        return {
            "results": [
                {
                    "vendorId": r.id,
                    "name": r.name,
                    "distance_m": int(r.distance_m)
                }
                for r in rows
            ]
        }
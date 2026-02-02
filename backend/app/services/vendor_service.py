import uuid
from app.db import SessionLocal
from sqlalchemy import text


class VendorService:
    def create_vendor(self, payload):
        db = SessionLocal()
        try:
            vendor_id = f"v_{uuid.uuid4().hex[:8]}"

            db.execute(
                text(
                    """
                  INSERT INTO vendors (id, name, phone, location)
                  VALUES (:id, :name, :phone,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
                """
                ),
                {
                    "id": vendor_id,
                    "name": payload.name,
                    "phone": payload.phone,
                    "lat": payload.lat,
                    "lng": payload.lng,
                },
            )
            db.commit()
            return {"vendorId": vendor_id}
        finally:
            db.close()

    def get_vendor(self, vendor_id: str):
        db = SessionLocal()
        try:
            vendor = db.execute(
                text("SELECT id, name FROM vendors WHERE id = :id"),
                {"id": vendor_id},
            ).fetchone()
            if not vendor:
                return None

            menu_rows = db.execute(
                text(
                    """
                  SELECT id, item_name, price
                  FROM menus
                  WHERE vendor_id = :vendor_id
                  ORDER BY item_name
                """
                ),
                {"vendor_id": vendor_id},
            ).fetchall()

            return {
                "vendorId": vendor.id,
                "name": vendor.name,
                "menu": [
                    {
                        "itemId": row.id,
                        "name": row.item_name,
                        "price": float(row.price) if row.price is not None else 0.0,
                    }
                    for row in menu_rows
                ],
            }
        finally:
            db.close()

    def upload_menu(self, vendor_id: str, file):
        db = SessionLocal()
        try:
            menu_id = f"m_{uuid.uuid4().hex[:8]}"
            db.execute(
                text(
                    """
                  INSERT INTO menus (id, vendor_id, item_name, price)
                  VALUES (:id, :vendor_id, :item_name, :price)
                """
                ),
                {
                    "id": menu_id,
                    "vendor_id": vendor_id,
                    "item_name": f"Menu upload: {file.filename}",
                    "price": 0,
                },
            )
            db.commit()
            return {
                "status": "menu_processed",
                "vendorId": vendor_id,
                "menuItemId": menu_id,
                "filename": file.filename,
            }
        finally:
            db.close()

    def search_nearby(self, query, lat, lng):
        db = SessionLocal()
        try:
            rows = db.execute(
                text(
                    """
                  SELECT id, name,
                    ST_Distance(
                      location,
                      ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                    ) AS distance_m
                  FROM vendors
                  ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                  LIMIT 10
                """
                ),
                {"lat": lat, "lng": lng},
            ).fetchall()

            return {
                "results": [
                    {
                        "vendorId": r.id,
                        "name": r.name,
                        "distance_m": int(r.distance_m),
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()
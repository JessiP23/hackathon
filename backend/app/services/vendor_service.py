import uuid
from app.db import SessionLocal
from sqlalchemy import text
from app.services.ocr_service import ocr


class VendorService:
    def create_vendor(self, payload):
        db = SessionLocal()
        try:
            vendor_id = f"v_{uuid.uuid4().hex[:8]}"
            db.execute(
                text("""
                    INSERT INTO vendors (id, name, phone, location, business_hours)
                    VALUES (:id, :name, :phone,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                            :hours)
                """),
                {
                    "id": vendor_id,
                    "name": payload.name,
                    "phone": payload.phone,
                    "lat": payload.lat,
                    "lng": payload.lng,
                    "hours": getattr(payload, "businessHours", None)
                }
            )
            db.commit()
            return {"vendorId": vendor_id, "name": payload.name}
        finally:
            db.close()

    def get_vendor(self, vendor_id: str):
        db = SessionLocal()
        try:
            vendor = db.execute(
                text("""
                    SELECT id, name, phone, business_hours,
                           ST_Y(location::geometry) as lat,
                           ST_X(location::geometry) as lng
                    FROM vendors WHERE id = :id
                """),
                {"id": vendor_id}
            ).fetchone()

            if not vendor:
                return None

            menu_rows = db.execute(
                text("SELECT id, item_name, description, price, is_available FROM menus WHERE vendor_id = :vid"),
                {"vid": vendor_id}
            ).fetchall()

            return {
                "vendorId": vendor.id,
                "name": vendor.name,
                "phone": vendor.phone,
                "businessHours": vendor.business_hours,
                "location": {"lat": vendor.lat, "lng": vendor.lng} if vendor.lat else None,
                "menu": [
                    {
                        "itemId": row.id,
                        "name": row.item_name,
                        "description": row.description,
                        "price": float(row.price or 0),
                        "isAvailable": row.is_available
                    }
                    for row in menu_rows
                ]
            }
        finally:
            db.close()

    async def upload_menu(self, vendor_id: str, file):
        """Upload menu image → OCR → insert items"""
        db = SessionLocal()
        try:
            content = await file.read()

            # Extract items via OCR
            items = ocr.extract_items(content)

            inserted = []
            for item in items:
                mid = f"m_{uuid.uuid4().hex[:8]}"
                db.execute(
                    text("""
                        INSERT INTO menus (id, vendor_id, item_name, description, price, is_available)
                        VALUES (:id, :vid, :name, :desc, :price, true)
                    """),
                    {"id": mid, "vid": vendor_id, "name": item["name"],
                     "desc": item["description"], "price": item["price"]}
                )
                inserted.append({"itemId": mid, "name": item["name"], "price": item["price"]})

            db.commit()

            if inserted:
                return {
                    "status": "success",
                    "itemsExtracted": len(inserted),
                    "items": inserted
                }
            else:
                return {
                    "status": "no_items",
                    "itemsExtracted": 0,
                    "message": "Could not extract items. Try a clearer image or add manually."
                }
        finally:
            db.close()

    def add_menu_item(self, vendor_id: str, item_name: str, price: float, description: str = ""):
        db = SessionLocal()
        try:
            menu_id = f"m_{uuid.uuid4().hex[:8]}"
            db.execute(
                text("""
                    INSERT INTO menus (id, vendor_id, item_name, description, price, is_available)
                    VALUES (:id, :vid, :name, :desc, :price, true)
                """),
                {"id": menu_id, "vid": vendor_id, "name": item_name, "desc": description, "price": price}
            )
            db.commit()
            return {"itemId": menu_id, "name": item_name, "price": price}
        finally:
            db.close()

    def search_nearby(self, query: str, lat: float, lng: float, limit: int = 10):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT DISTINCT v.id, v.name,
                           ST_Distance(v.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) AS dist
                    FROM vendors v
                    LEFT JOIN menus m ON m.vendor_id = v.id
                    WHERE v.location IS NOT NULL
                      AND (:q = '' OR v.name ILIKE '%' || :q || '%' OR m.item_name ILIKE '%' || :q || '%')
                    ORDER BY dist LIMIT :lim
                """),
                {"lat": lat, "lng": lng, "q": query or "", "lim": limit}
            ).fetchall()

            return {
                "results": [
                    {
                        "vendorId": r.id,
                        "name": r.name,
                        "distance_m": int(r.dist) if r.dist else 0
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()
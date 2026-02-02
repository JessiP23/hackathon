import uuid
from app.db import SessionLocal
from sqlalchemy import text


class VendorService:
    def create_vendor(self, payload):
        db = SessionLocal()
        try:
            vendor_id = f"v_{uuid.uuid4().hex[:8]}"

            db.execute(
                text("""
                    INSERT INTO vendors (id, name, phone, location, business_hours)
                    VALUES (
                        :id, :name, :phone,
                        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                        :business_hours
                    )
                """),
                {
                    "id": vendor_id,
                    "name": payload.name,
                    "phone": payload.phone,
                    "lat": payload.lat,
                    "lng": payload.lng,
                    "business_hours": getattr(payload, 'businessHours', None)
                }
            )
            db.commit()
            
            return {
                "vendorId": vendor_id,
                "name": payload.name,
                "phone": payload.phone
            }
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
                text("""
                    SELECT id, item_name, description, price, is_available
                    FROM menus
                    WHERE vendor_id = :vendor_id
                    ORDER BY item_name
                """),
                {"vendor_id": vendor_id}
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
                        "price": float(row.price) if row.price else 0.0,
                        "isAvailable": row.is_available
                    }
                    for row in menu_rows
                ]
            }
        finally:
            db.close()

    def upload_menu(self, vendor_id: str, file):
        """Process menu image - stub for OCR integration"""
        db = SessionLocal()
        try:
            menu_id = f"m_{uuid.uuid4().hex[:8]}"
            
            db.execute(
                text("""
                    INSERT INTO menus (id, vendor_id, item_name, description, price)
                    VALUES (:id, :vendor_id, :item_name, :description, :price)
                """),
                {
                    "id": menu_id,
                    "vendor_id": vendor_id,
                    "item_name": f"Menu from {file.filename}",
                    "description": "Items will be extracted via OCR",
                    "price": 0
                }
            )
            db.commit()
            
            return {
                "status": "processing",
                "vendorId": vendor_id,
                "menuId": menu_id,
                "filename": file.filename
            }
        finally:
            db.close()

    def add_menu_item(self, vendor_id: str, item_name: str, price: float, description: str = ''):
        db = SessionLocal()
        try:
            menu_id = f"m_{uuid.uuid4().hex[:8]}"
            
            db.execute(
                text("""
                    INSERT INTO menus (id, vendor_id, item_name, description, price)
                    VALUES (:id, :vendor_id, :item_name, :description, :price)
                """),
                {
                    "id": menu_id,
                    "vendor_id": vendor_id,
                    "item_name": item_name,
                    "description": description,
                    "price": price
                }
            )
            db.commit()
            
            return {"menuItemId": menu_id, "name": item_name, "price": price}
        finally:
            db.close()

    def search_nearby(self, query: str, lat: float, lng: float, limit: int = 10):
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT DISTINCT v.id, v.name, v.phone,
                        ST_Distance(
                            v.location,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                        ) AS distance_m
                    FROM vendors v
                    LEFT JOIN menus m ON m.vendor_id = v.id
                    WHERE v.location IS NOT NULL
                      AND (
                        :query = '' 
                        OR v.name ILIKE '%' || :query || '%'
                        OR m.item_name ILIKE '%' || :query || '%'
                      )
                    ORDER BY distance_m
                    LIMIT :limit
                """),
                {"lat": lat, "lng": lng, "query": query or "", "limit": limit}
            ).fetchall()

            return {
                "results": [
                    {
                        "vendorId": r.id,
                        "name": r.name,
                        "distance_m": int(r.distance_m) if r.distance_m else 0
                    }
                    for r in rows
                ]
            }
        finally:
            db.close()
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
        db = SessionLocal()
        try:
            content = await file.read()
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

            return {
                "status": "success" if inserted else "no_items",
                "itemsExtracted": len(inserted),
                "items": inserted
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

    def search_nearby(self, query: str, lat: float, lng: float, limit: int = 20):
        """
        Smart search: finds vendors by name OR menu items
        Ranking: menu match > name match > distance
        """
        db = SessionLocal()
        try:
            q = query.strip().lower()
            search_terms = self._expand_search(q)
            print(f"[Search] '{q}' -> {search_terms} at ({lat}, {lng})")

            # Get ALL vendors (no distance filter for demo)
            vendors_raw = db.execute(
                text("""
                    SELECT v.id, v.name, v.phone, v.business_hours,
                           ST_Y(v.location::geometry) as lat,
                           ST_X(v.location::geometry) as lng,
                           ST_Distance(v.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) AS dist
                    FROM vendors v
                    WHERE v.location IS NOT NULL
                    ORDER BY dist
                    LIMIT 100
                """),
                {"lat": lat, "lng": lng}
            ).fetchall()

            results = []
            for v in vendors_raw:
                menu_items = db.execute(
                    text("SELECT id, item_name, price FROM menus WHERE vendor_id = :vid"),
                    {"vid": v.id}
                ).fetchall()

                score = 0
                matching_items = []

                # Vendor name match
                name_lower = v.name.lower()
                for term in search_terms:
                    if term in name_lower:
                        score += 100
                        break

                # Menu item match
                for item in menu_items:
                    item_name_lower = item.item_name.lower()
                    for term in search_terms:
                        if term in item_name_lower:
                            score += 50
                            matching_items.append({
                                "itemId": item.id,
                                "name": item.item_name,
                                "price": float(item.price)
                            })
                            break

                # Skip if no match when query provided
                if q and score == 0:
                    continue

                # Distance score (closer = better, but don't filter out)
                dist = v.dist or 0
                distance_score = max(0, 50 - (dist / 1000))  # Lose 1 point per km
                score += distance_score

                results.append({
                    "vendorId": v.id,
                    "name": v.name,
                    "phone": v.phone,
                    "businessHours": v.business_hours,
                    "distance_m": int(dist),
                    "location": {"lat": v.lat, "lng": v.lng} if v.lat else None,
                    "matchingItems": matching_items[:3],
                    "score": score
                })

            results.sort(key=lambda x: (-x["score"], x["distance_m"]))

            for r in results:
                del r["score"]

            print(f"[Search] Found {len(results)} results")
            return {"results": results[:limit]}

        finally:
            db.close()

    def _expand_search(self, query: str) -> list[str]:
        """Expand search to related food terms"""
        if not query:
            return [""]

        # Food category mappings
        expansions = {
            "taco": ["taco", "taquito", "tortilla"],
            "burrito": ["burrito", "wrap", "bowl"],
            "nacho": ["nacho", "chip", "queso"],
            "chicken": ["chicken", "pollo"],
            "beef": ["beef", "carne", "steak", "asada"],
            "pork": ["pork", "carnitas", "al pastor"],
            "fish": ["fish", "pescado", "seafood", "shrimp", "camarones"],
            "mexican": ["taco", "burrito", "nacho", "enchilada", "quesadilla"],
            "chinese": ["noodle", "rice", "wok", "dumpling", "lo mein"],
            "pizza": ["pizza", "slice", "pie"],
            "burger": ["burger", "hamburger", "cheeseburger"],
            "sandwich": ["sandwich", "sub", "hoagie", "panini"],
            "salad": ["salad", "greens", "bowl"],
            "breakfast": ["egg", "bacon", "pancake", "waffle", "toast"],
        }

        terms = [query]

        # Check if query matches any category
        for key, related in expansions.items():
            if key in query or query in key:
                terms.extend(related)

        # Remove duplicates, keep order
        seen = set()
        unique = []
        for t in terms:
            if t not in seen:
                seen.add(t)
                unique.append(t)

        return unique
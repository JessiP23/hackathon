import uuid
from app.db import SessionLocal
from sqlalchemy import text


class UserService:
    def create_user(self, payload):
        db = SessionLocal()
        try:
            user_id = f"u_{uuid.uuid4().hex[:8]}"
            
            # Check if phone already exists
            existing = db.execute(
                text("SELECT id, role FROM users WHERE phone = :phone"),
                {"phone": payload.phone}
            ).fetchone()
            
            if existing:
                return {
                    "userId": existing.id,
                    "phone": payload.phone,
                    "role": existing.role,
                    "isExisting": True
                }
            
            db.execute(
                text("""
                    INSERT INTO users (id, phone, role, name)
                    VALUES (:id, :phone, :role, :name)
                """),
                {
                    "id": user_id,
                    "phone": payload.phone,
                    "role": payload.role,
                    "name": payload.name
                }
            )
            db.commit()
            
            return {
                "userId": user_id,
                "phone": payload.phone,
                "role": payload.role,
                "name": payload.name,
                "isExisting": False
            }
        finally:
            db.close()

    def get_user_by_phone(self, phone: str):
        db = SessionLocal()
        try:
            row = db.execute(
                text("SELECT id, phone, role, name FROM users WHERE phone = :phone"),
                {"phone": phone}
            ).fetchone()
            
            if not row:
                return None
                
            return {
                "userId": row.id,
                "phone": row.phone,
                "role": row.role,
                "name": row.name
            }
        finally:
            db.close()
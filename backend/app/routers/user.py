from fastapi import APIRouter, HTTPException
from app.schemas.user import UserCreate
from app.services.user_service import UserService

router = APIRouter()
service = UserService()

@router.post("")
def create_user(payload: UserCreate):
    return service.create_user(payload)

@router.get("/phone/{phone}")
def get_user_by_phone(phone: str):
    user = service.get_user_by_phone(phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
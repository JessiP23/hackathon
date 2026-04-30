"""Short deal links: GET /d/{code} → frontend with resolved deal id."""
import os

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.services.short_url_service import resolve_token

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


@router.get("/d/{token}")
def redirect_deal_link(token: str):
    deal_id = resolve_token(token) or (token if token.startswith("fd_") else None)
    if not deal_id:
        return RedirectResponse(f"{FRONTEND_URL}/deals", status_code=302)
    return RedirectResponse(f"{FRONTEND_URL}/deals?deal={deal_id}", status_code=302)

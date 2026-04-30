from fastapi import APIRouter

from app.schemas.customer import NotifyOptInRequest
from app.services.customer_service import CustomerService

router = APIRouter()
_service = CustomerService()


@router.post("/notify_opt_in")
def notify_opt_in(payload: NotifyOptInRequest):
    """§5E empty state — create/update customer, enable alerts, SMS OTP when Twilio configured."""
    return _service.notify_opt_in(payload.lat, payload.lng, payload.radius, payload.phone)

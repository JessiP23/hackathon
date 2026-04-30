"""Inbound Twilio SMS/MMS/WhatsApp webhook router."""
import os

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from app.services.agent_service import agent_service

router = APIRouter()


def _twiml(message: str) -> Response:
    response = MessagingResponse()
    response.message(message)
    return Response(content=str(response), media_type="application/xml")


async def _twilio_form(request: Request) -> dict:
    form = await request.form()
    data = {str(k): str(v) for k, v in form.items()}
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    signature = request.headers.get("X-Twilio-Signature", "")

    if not auth_token:
        raise HTTPException(500, "Twilio auth token is not configured")

    public_url = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    url = f"{public_url}{request.url.path}" if public_url else str(request.url)
    if not RequestValidator(auth_token).validate(url, data, signature):
        raise HTTPException(403, "Invalid Twilio signature")
    return data


@router.post("/sms/vendor")
async def vendor_sms_inbound(request: Request):
    """Receive vendor SMS/MMS/WhatsApp from Twilio and return TwiML."""
    form = await _twilio_form(request)
    phone = form.get("From", "")
    text_body = form.get("Body", "")
    media_url = form.get("MediaUrl0") if int(form.get("NumMedia", "0") or 0) > 0 else None

    if not phone:
        return _twiml("Missing sender.")

    reply = await agent_service.handle_vendor_message(phone, text_body, media_url)
    return _twiml(reply)


@router.post("/sms/customer")
async def customer_sms_inbound(request: Request):
    """Handle customer STOP/START replies sent by Twilio webhooks."""
    form = await _twilio_form(request)
    phone = form.get("From", "")
    body = form.get("Body", "").strip().lower()

    if body == "stop":
        from app.services.user_service import UserService
        UserService().set_customer_notifications(phone, enabled=False)
        return _twiml("InfraStreet alerts off. Text START to re-enable.")
    if body == "start":
        from app.services.user_service import UserService
        UserService().set_customer_notifications(phone, enabled=True)
        return _twiml("InfraStreet alerts on.")

    return _twiml("Open infrastreet.app to see deals near you.")

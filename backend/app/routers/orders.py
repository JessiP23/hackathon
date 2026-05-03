from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.schemas.order import OrderCreate, OrderStatusUpdate
from app.services.order_service import OrderService

router = APIRouter()
service = OrderService()


class PickupConfirmBody(BaseModel):
    qrCode: str


@router.post("")
def create_order(payload: OrderCreate):
    body = service.create_order(payload)
    if isinstance(body, dict) and body.get("error"):
        raise HTTPException(status_code=400, detail=body["error"])
    return body


@router.get("/recommendations/{phone}")
def get_recommendations(phone: str):
    return service.get_recommendations(phone)


@router.get("/customer/{phone}")
def get_customer_orders(phone: str):
    return service.get_customer_orders(phone)


@router.get("/vendor/{vendor_id}")
def get_vendor_orders(vendor_id: str):
    return service.get_vendor_orders(vendor_id)


@router.get("/{order_id}/receipt")
def get_order_receipt(order_id: str):
    body = service.get_order_receipt_url(order_id)
    if body is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return body


@router.get("/{order_id}/checkout-session")
def get_order_checkout_session(order_id: str):
    body = service.get_deal_checkout_session(order_id)
    if isinstance(body, dict) and body.get("error"):
        raise HTTPException(status_code=400, detail=body["error"])
    return body


@router.get("/{order_id}/hosted-checkout")
def get_order_hosted_checkout(order_id: str):
    body = service.get_hosted_checkout_url(order_id)
    if isinstance(body, dict) and body.get("error"):
        raise HTTPException(status_code=400, detail=body["error"])
    return body


@router.post("/{order_id}/sync-stripe-checkout")
def sync_stripe_checkout_order(order_id: str):
    body = service.sync_order_if_checkout_completed(order_id)
    if not isinstance(body, dict):
        raise HTTPException(status_code=500, detail="Invalid response")
    if body.get("error") == "Order not found":
        raise HTTPException(status_code=404, detail=body["error"])
    if body.get("ok") is False and body.get("error"):
        raise HTTPException(status_code=503, detail=str(body["error"]))
    return body


@router.post("/{order_id}/ack-payment-authorized")
def ack_payment_authorized(order_id: str):
    body = service.ack_deal_payment_authorized(order_id)
    if isinstance(body, dict) and body.get("error") == "Order not found":
        raise HTTPException(status_code=404, detail=body["error"])
    if isinstance(body, dict) and body.get("ok") is False and body.get("error"):
        raise HTTPException(status_code=503, detail=str(body["error"]))
    return body


@router.get("/{order_id}")
def get_order(order_id: str):
    order = service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _verify_vendor_order(vendor_id: str, order_id: str) -> None:
    o = service.get_order(order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.get("vendorId") != vendor_id:
        raise HTTPException(status_code=403, detail="Not this vendor's order")


@router.post("/{order_id}/ready")
def mark_order_ready(order_id: str, vendor_id: str = Query(..., description="Vendor id")):
    from app.services.fulfillment_service import FulfillmentService

    _verify_vendor_order(vendor_id, order_id)
    try:
        return FulfillmentService().vendor_mark_ready(order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{order_id}/pickup")
def confirm_pickup(order_id: str, body: PickupConfirmBody):
    from app.services.fulfillment_service import FulfillmentService

    try:
        return FulfillmentService().confirm_pickup_by_qr(order_id, body.qrCode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/cancel")
def cancel_order_vendor(order_id: str, vendor_id: str = Query(...)):
    from app.services.fulfillment_service import FulfillmentService

    _verify_vendor_order(vendor_id, order_id)
    try:
        return FulfillmentService().handle_vendor_cancellation(order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{order_id}/status")
def update_order_status(order_id: str, payload: OrderStatusUpdate):
    return service.update_status(order_id, payload.status)
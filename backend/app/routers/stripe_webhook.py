import os
from fastapi import APIRouter, Request, HTTPException
from app.services.stripe_service import stripe_service
from app.services.order_service import OrderService

router = APIRouter()
order_service = OrderService()

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    event = stripe_service.verify_webhook(payload, sig)
    if not event:
        raise HTTPException(400, "Invalid Stripe signature")

    event_type = event.type
    obj = event.data.object

    if event_type == "payment_intent.succeeded":
        pi_id = obj.get("id")
        # Metadata is on the PaymentIntent or the Checkout Session
        metadata = obj.get("metadata", {})
        order_id = metadata.get("order_id")
        if order_id:
            order_service.on_payment_succeeded(order_id, pi_id)

    elif event_type == "checkout.session.completed":
        metadata = obj.get("metadata", {})
        order_id = metadata.get("order_id")
        pi_id = obj.get("payment_intent")
        if order_id and pi_id:
            order_service.on_payment_succeeded(order_id, pi_id)

    elif event_type == "payment_intent.payment_failed":
        metadata = obj.get("metadata", {})
        order_id = metadata.get("order_id")
        if order_id:
            order_service.on_payment_failed(order_id)

    elif event_type == "charge.dispute.created":
        # Log and flag — manual review
        print(f"[Stripe] Dispute created: {obj.get('id')}")

    return {"received": True}

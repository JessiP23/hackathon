"""Async Telegram (and SMS) helpers for order / payout flows."""
from __future__ import annotations

from app.services.notify_service import notify_service


async def notify_customer_order_ready(customer_phone: str | None, message: str) -> None:
    if not customer_phone:
        return
    await notify_service.send_message(customer_phone, message, "customer")


async def notify_customer_order_cancelled(customer_phone: str | None) -> None:
    if not customer_phone:
        return
    await notify_service.send_message(
        customer_phone,
        "Your InfraStreet order was cancelled by the vendor. You were not charged.",
        "customer",
    )


async def notify_vendor_order_received(
    vendor_phone: str,
    item_line: str,
    quantity: int,
    order_id: str,
    customer_first_name: str,
) -> None:
    q = max(1, int(quantity or 1))
    msg = (
        f"🛎 New reservation\n\n"
        f"{item_line} × {q}\n"
        f"Order #{order_id}\n"
        f"Customer: {customer_first_name or 'Guest'}\n"
    )
    markup = {
        "inline_keyboard": [
            [
                {"text": "✅ I'm making it", "callback_data": f"vo_mk|{order_id}"},
                {"text": "❌ Cancel order", "callback_data": f"vo_cx|{order_id}"},
            ]
        ]
    }
    await notify_service.send_message(vendor_phone, msg, "vendor", reply_markup=markup)


async def notify_vendor_ready_prompt(vendor_row: dict, order_id: str) -> None:
    phone = vendor_row.get("vendor_phone") or vendor_row.get("phone")
    if not phone:
        return
    item = vendor_row.get("deal_item_name") or "Your item"
    msg = (
        f"📦 {item} — ready to go?\n\n"
        "Tap below when the food is ready for pickup.\n"
        "This charges the customer's card.\n"
    )
    markup = {
        "inline_keyboard": [
            [{"text": "✅ Mark ready for pickup", "callback_data": f"vo_rd|{order_id}"}],
        ]
    }
    await notify_service.send_message(phone, msg, "vendor", reply_markup=markup)


async def notify_vendor_qr_confirm_prompt(
    vendor_phone: str,
    qr_code: str,
    order_id: str,
) -> None:
    msg = f"Customer QR: {qr_code}\n\nConfirm pickup to release payment."
    markup = {
        "inline_keyboard": [
            [
                {"text": "✅ Confirm pickup", "callback_data": f"vo_cf|{order_id}|{qr_code}"},
                {"text": "❌ QR doesn't match", "callback_data": f"vo_bad|{order_id}"},
            ]
        ]
    }
    await notify_service.send_message(vendor_phone, msg, "vendor", reply_markup=markup)


async def notify_vendor_payout_sent(
    vendor_row: dict,
    order_id: str,
    item_line: str,
    gross: float,
    fee: float,
    net: float,
) -> None:
    phone = vendor_row.get("vendor_phone") or vendor_row.get("phone")
    if not phone:
        return
    msg = (
        f"💸 Payment sent.\n\n"
        f"Order #{order_id} fulfilled.\n"
        f"{item_line}\n\n"
        f"Gross:    ${gross:.2f}\n"
        f"Fee (15%): ${fee:.2f}\n"
        f"You get:   ${net:.2f}\n\n"
        "Transfer to your debit card · usually instant."
    )
    await notify_service.send_message(phone, msg, "vendor")


async def notify_vendor_payment_failed(order_id: str) -> None:
    print(f"[telegram_notify] payment failed for order {order_id}", flush=True)


async def notify_vendor_payout_failed(destination: str | None, db=None) -> None:
    _ = (destination, db)
    print("[telegram_notify] payout.failed webhook — notify vendor to update card", flush=True)

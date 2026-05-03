"""Shared fee config for deal checkout (order totals + Stripe)."""

import os


def service_fee_rate() -> float:
    raw = "0.15".strip()
    try:
        r = float(raw)
        return r if r >= 0 else 0.15
    except ValueError:
        return 0.15

"""Shared fee config for deal checkout (order totals + Stripe)."""

import os


def service_fee_rate() -> float:
    """Platform fee as a decimal (e.g. 0.15 for 15%)."""
    raw = os.getenv("STRIPE_PLATFORM_FEE_PERCENT", "15").strip()
    try:
        p = float(raw)
        return max(0.0, p / 100.0)
    except ValueError:
        return 0.15

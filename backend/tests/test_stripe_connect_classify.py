"""Unit tests for Connect error classification (no Stripe API calls)."""
from __future__ import annotations

import unittest

from app.services.stripe_connect import classify_connect_account_creation_error


class TestClassifyConnectError(unittest.TestCase):
    def test_signup_required_explicit_phrase(self) -> None:
        exc = Exception(
            "Request req_abc: You can only create new accounts if you've signed up for Connect, "
            "which you can do at https://dashboard.stripe.com/connect"
        )
        self.assertEqual(classify_connect_account_creation_error(exc), "connect_signup_required")

    def test_signup_required_short_phrase(self) -> None:
        exc = Exception(
            "You can only create new accounts if you've signed the connect agreement"
        )
        self.assertEqual(classify_connect_account_creation_error(exc), "connect_signup_required")

    def test_generic_does_not_match_broad_prefix(self) -> None:
        exc = Exception("You can only create new accounts during business hours")
        self.assertEqual(classify_connect_account_creation_error(exc), "generic")

    def test_generic_card_error_not_misclassified(self) -> None:
        """Loosely 'connect' + dashboard URL must NOT imply signup required."""
        exc = Exception(
            "Invalid routing: see https://dashboard.stripe.com/docs/connect for bank account validation"
        )
        self.assertEqual(classify_connect_account_creation_error(exc), "generic")


if __name__ == "__main__":
    unittest.main()

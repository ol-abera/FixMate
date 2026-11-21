import hashlib
import hmac
import json
import time
from decimal import Decimal
from types import SimpleNamespace
from unittest import mock

from django.test import TestCase, override_settings

from common.testing import client_for, make_booking, make_provider, make_user
from notifications.models import Notification

from .models import Payment

WHSEC = "whsec_test_secret"


def stripe_signature(payload: bytes, secret=WHSEC, ts=None):
    ts = ts or int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


@override_settings(STRIPE_SECRET_KEY="", PAYMENTS_MOCK=True)
class MockCheckoutTests(TestCase):
    def setUp(self):
        self.cu = make_user("pay-c@example.com")
        self.other = make_user("pay-o@example.com")
        self.pu, self.p = make_provider("pay-p@example.com")
        self.done = make_booking(self.cu, self.p, status="COMPLETED", final_price=Decimal("140.00"))
        self.c = client_for(self.cu)

    def checkout(self, booking=None, client=None):
        return (client or self.c).post("/api/payments/checkout/", {"booking": (booking or self.done).id}, format="json")

    def test_config_reports_mock_gateway(self):
        r = client_for().get("/api/payments/config/")
        self.assertEqual(r.data, {"gateway": "mock", "currency": "usd"})

    def test_booking_exposes_can_pay_until_paid(self):
        r = self.c.get(f"/api/bookings/{self.done.id}/")
        self.assertTrue(r.data["can_pay"])
        self.assertIsNone(r.data["payment"])
        self.assertFalse(client_for(self.pu).get(f"/api/bookings/{self.done.id}/").data["can_pay"])

    def test_full_mock_flow_marks_paid_and_notifies_both_sides(self):
        r = self.checkout()
        self.assertEqual(r.status_code, 201, r.data)
        sid = r.data["checkout_url"].split("session_id=")[1]
        self.assertTrue(sid.startswith("mock_"))
        self.assertEqual(r.data["payment"]["amount"], "140.00")

        self.assertEqual(self.c.get(f"/api/payments/session/{sid}/").data["status"], "PENDING")
        r = self.c.post("/api/payments/mock/confirm/", {"session_id": sid, "card_number": "4242 4242 4242 4242"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "PAID")
        self.assertIsNotNone(r.data["paid_at"])

        b = self.c.get(f"/api/bookings/{self.done.id}/").data
        self.assertFalse(b["can_pay"])
        self.assertEqual(b["payment"]["status"], "PAID")
        self.assertEqual(Notification.objects.filter(notification_type="PAYMENT_RECEIVED").count(), 2)
        self.assertTrue(Notification.objects.filter(recipient=self.pu, notification_type="PAYMENT_RECEIVED").exists())

        again = self.checkout()
        self.assertEqual(again.status_code, 400)
        self.assertIn("already paid", str(again.data))
        # Confirming twice is harmless and does not notify again.
        self.c.post("/api/payments/mock/confirm/", {"session_id": sid, "card_number": "4242424242424242"}, format="json")
        self.assertEqual(Notification.objects.filter(notification_type="PAYMENT_RECEIVED").count(), 2)

    def test_declined_card_then_retry_reuses_the_payment_row(self):
        sid = self.checkout().data["checkout_url"].split("session_id=")[1]
        r = self.c.post("/api/payments/mock/confirm/", {"session_id": sid, "card_number": "4000 0000 0000 0002"}, format="json")
        self.assertEqual(r.status_code, 402)
        self.assertEqual(Payment.objects.get().status, "FAILED")
        self.assertTrue(self.c.get(f"/api/bookings/{self.done.id}/").data["can_pay"])

        sid2 = self.checkout().data["checkout_url"].split("session_id=")[1]
        self.assertNotEqual(sid, sid2)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Payment.objects.get().status, "PENDING")
        self.assertEqual(self.c.get(f"/api/payments/session/{sid}/").status_code, 404)

    def test_only_owner_can_pay_completed_bookings_with_amount_due(self):
        self.assertEqual(self.checkout(client=client_for(self.other)).status_code, 404)
        self.assertEqual(self.checkout(client=client_for(self.pu)).status_code, 404)
        self.assertEqual(self.checkout(client=client_for()).status_code, 401)
        open_job = make_booking(self.cu, self.p, status="IN_PROGRESS")
        self.assertEqual(self.checkout(open_job).status_code, 400)
        free = make_booking(self.cu, self.p, status="COMPLETED", final_price=Decimal("0"))
        self.assertEqual(self.checkout(free).status_code, 400)
        self.assertEqual(self.c.post("/api/payments/checkout/", {"booking": "x"}, format="json").status_code, 400)

    def test_other_users_cannot_see_or_confirm_a_session(self):
        sid = self.checkout().data["checkout_url"].split("session_id=")[1]
        o = client_for(self.other)
        self.assertEqual(o.get(f"/api/payments/session/{sid}/").status_code, 404)
        self.assertEqual(o.post("/api/payments/mock/confirm/", {"session_id": sid, "card_number": "4242424242424242"}, format="json").status_code, 404)
        self.assertEqual(Payment.objects.get().status, "PENDING")

    @override_settings(PAYMENTS_MOCK=False)
    def test_payments_off_without_stripe_or_mock(self):
        self.assertEqual(self.checkout().status_code, 503)
        self.assertFalse(self.c.get(f"/api/bookings/{self.done.id}/").data["can_pay"])
        self.assertIsNone(client_for().get("/api/payments/config/").data["gateway"])


@override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_WEBHOOK_SECRET=WHSEC, PAYMENTS_MOCK=True)
class StripeTests(TestCase):
    def setUp(self):
        self.cu = make_user("stripe-c@example.com")
        self.pu, self.p = make_provider("stripe-p@example.com")
        self.done = make_booking(self.cu, self.p, status="COMPLETED", final_price=Decimal("99.50"))
        self.c = client_for(self.cu)

    def start(self):
        fake = SimpleNamespace(id="cs_test_123", url="https://checkout.stripe.com/c/pay/cs_test_123")
        with mock.patch("stripe.checkout.Session.create", return_value=fake) as create:
            r = self.c.post("/api/payments/checkout/", {"booking": self.done.id}, format="json")
        return r, create

    def webhook(self, event, sig=None):
        body = json.dumps(event).encode()
        return client_for().post("/api/payments/webhook/", body, content_type="application/json",
                                 HTTP_STRIPE_SIGNATURE=sig or stripe_signature(body))

    def event(self, kind="checkout.session.completed", payment_status="paid", sid="cs_test_123"):
        return {"id": "evt_1", "object": "event", "type": kind,
                "data": {"object": {"id": sid, "object": "checkout.session", "payment_status": payment_status, "payment_intent": "pi_1"}}}

    def test_checkout_creates_stripe_session_with_amount_in_cents(self):
        r, create = self.start()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["checkout_url"], "https://checkout.stripe.com/c/pay/cs_test_123")
        kw = create.call_args.kwargs
        self.assertEqual(kw["line_items"][0]["price_data"]["unit_amount"], 9950)
        self.assertEqual(kw["metadata"], {"booking_id": str(self.done.id)})
        self.assertIn("{CHECKOUT_SESSION_ID}", kw["success_url"])
        self.assertEqual(Payment.objects.get().gateway, "stripe")

    def test_mock_confirm_is_disabled_when_stripe_is_configured(self):
        self.start()
        r = self.c.post("/api/payments/mock/confirm/", {"session_id": "cs_test_123", "card_number": "4242424242424242"}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_signed_webhook_marks_paid_once(self):
        self.start()
        self.assertEqual(self.webhook(self.event()).status_code, 200)
        p = Payment.objects.get()
        self.assertEqual((p.status, p.payment_intent), ("PAID", "pi_1"))
        self.webhook(self.event())
        self.assertEqual(Notification.objects.filter(notification_type="PAYMENT_RECEIVED").count(), 2)

    def test_webhook_rejects_bad_or_missing_signatures(self):
        self.start()
        body = json.dumps(self.event()).encode()
        self.assertEqual(self.webhook(self.event(), sig=stripe_signature(body, secret="whsec_wrong")).status_code, 400)
        self.assertEqual(self.webhook(self.event(), sig="t=1,v1=deadbeef").status_code, 400)
        stale = stripe_signature(body, ts=int(time.time()) - 3600)
        self.assertEqual(self.webhook(self.event(), sig=stale).status_code, 400)
        self.assertEqual(Payment.objects.get().status, "PENDING")

    @override_settings(STRIPE_WEBHOOK_SECRET="")
    def test_webhook_refuses_when_secret_missing(self):
        self.assertEqual(self.webhook(self.event()).status_code, 503)

    def test_unpaid_completion_and_expiry(self):
        self.start()
        self.webhook(self.event(payment_status="unpaid"))
        self.assertEqual(Payment.objects.get().status, "PENDING")
        self.webhook(self.event(kind="checkout.session.expired", payment_status="unpaid"))
        self.assertEqual(Payment.objects.get().status, "FAILED")

    def test_sync_asks_stripe_when_customer_returns(self):
        self.start()
        paid = SimpleNamespace(payment_status="paid", status="complete", payment_intent="pi_9")
        with mock.patch("stripe.checkout.Session.retrieve", return_value=paid) as retrieve:
            r = self.c.post("/api/payments/sync/", {"session_id": "cs_test_123"}, format="json")
        self.assertEqual(r.data["status"], "PAID")
        retrieve.assert_called_once()
        self.assertEqual(Payment.objects.get().payment_intent, "pi_9")

    def test_stripe_errors_surface_as_502(self):
        import stripe

        with mock.patch("stripe.checkout.Session.create", side_effect=stripe.APIConnectionError("down")):
            r = self.c.post("/api/payments/checkout/", {"booking": self.done.id}, format="json")
        self.assertEqual(r.status_code, 502)
        self.assertFalse(Payment.objects.exists())

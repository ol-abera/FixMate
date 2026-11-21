from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from common.testing import client_for, make_booking, make_category, make_provider, make_service, make_user
from notifications.models import Notification


class BookingTests(TestCase):
    def setUp(self):
        self.cat = make_category("Plumbing")
        self.cu = make_user("c1@example.com")
        self.cu2 = make_user("c2@example.com")
        self.pu, self.p = make_provider("p1@example.com", category=self.cat, hourly_rate=50, starting_price=60)
        self.pu2, self.p2 = make_provider("p2@example.com")

    def payload(self, **kw):
        d = {"provider": self.p.id, "category": "plumbing", "title": "Leak", "description": "Drip under sink",
             "scheduled_date": str(timezone.localdate() + timedelta(days=3)), "time_slot": "10:00 - 12:00",
             "location": "1 Main St, Austin", "contact_phone": "555"}
        d.update(kw)
        return d

    def test_customer_creates_booking_for_self_with_server_side_price(self):
        r = client_for(self.cu).post("/api/bookings/", self.payload(customer=self.cu2.id, estimated_price="1", status="COMPLETED"), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["customer"], self.cu.id)
        self.assertEqual(r.data["status"], "PENDING")
        self.assertEqual(str(r.data["estimated_price"]), "100.00")  # hourly 50 * 2
        self.assertEqual(r.data["scheduled_time"], "10:00:00")
        self.assertTrue(Notification.objects.filter(recipient=self.pu, notification_type="NEW_BOOKING").exists())

    def test_booking_validation(self):
        c = client_for(self.cu)
        past = str(timezone.localdate() - timedelta(days=1))
        self.assertEqual(c.post("/api/bookings/", self.payload(scheduled_date=past), format="json").status_code, 400)
        self.assertEqual(c.post("/api/bookings/", self.payload(time_slot="noon"), format="json").status_code, 400)
        _, pending = make_provider("pend@example.com", verified=False)
        self.assertEqual(c.post("/api/bookings/", self.payload(provider=pending.id), format="json").status_code, 400)
        other_service = make_service(self.p2, self.cat)
        self.assertEqual(c.post("/api/bookings/", self.payload(service=other_service.id), format="json").status_code, 400)

    def test_service_price_used_when_service_selected(self):
        s = make_service(self.p, self.cat, price=333)
        r = client_for(self.cu).post("/api/bookings/", self.payload(service=s.id), format="json")
        self.assertEqual(str(r.data["estimated_price"]), "333.00")

    def test_provider_and_anon_cannot_create(self):
        self.assertEqual(client_for(self.pu).post("/api/bookings/", self.payload(), format="json").status_code, 403)
        self.assertEqual(client_for().post("/api/bookings/", self.payload(), format="json").status_code, 401)

    def test_visibility_is_scoped(self):
        b = make_booking(self.cu, self.p)
        self.assertEqual(client_for(self.cu).get("/api/bookings/").data["count"], 1)
        self.assertEqual(client_for(self.pu).get("/api/bookings/").data["count"], 1)
        self.assertEqual(client_for(self.cu2).get("/api/bookings/").data["count"], 0)
        self.assertEqual(client_for(self.pu2).get("/api/bookings/").data["count"], 0)
        self.assertEqual(client_for(self.cu2).get(f"/api/bookings/{b.id}/").status_code, 404)
        self.assertEqual(client_for(self.pu2).get(f"/api/bookings/{b.id}/").status_code, 404)

    def test_happy_path_workflow(self):
        b = make_booking(self.cu, self.p)
        prov, cust = client_for(self.pu), client_for(self.cu)
        self.assertEqual(prov.post(f"/api/bookings/{b.id}/accept/").data["status"], "ACCEPTED")
        self.assertTrue(Notification.objects.filter(recipient=self.cu, notification_type="BOOKING_ACCEPTED").exists())
        self.assertEqual(prov.post(f"/api/bookings/{b.id}/start/").data["status"], "IN_PROGRESS")
        r = prov.post(f"/api/bookings/{b.id}/complete/", {"final_price": "150.50"}, format="json")
        self.assertEqual(r.data["status"], "COMPLETED")
        self.assertEqual(str(r.data["final_price"]), "150.50")
        self.assertTrue(r.data["can_review"] is False)  # provider cannot review
        self.assertTrue(Notification.objects.filter(recipient=self.cu, notification_type="REVIEW_REMINDER").exists())
        self.assertEqual([e["status"] for e in cust.get(f"/api/bookings/{b.id}/").data["events"]],
                         ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"])

    def test_decline_notifies_customer(self):
        b = make_booking(self.cu, self.p)
        self.assertEqual(client_for(self.pu).post(f"/api/bookings/{b.id}/decline/").data["status"], "DECLINED")
        self.assertTrue(Notification.objects.filter(recipient=self.cu, notification_type="BOOKING_DECLINED").exists())

    def test_invalid_transitions_rejected(self):
        b = make_booking(self.cu, self.p)
        prov = client_for(self.pu)
        self.assertEqual(prov.post(f"/api/bookings/{b.id}/start/").status_code, 400)     # pending -> in_progress
        self.assertEqual(prov.post(f"/api/bookings/{b.id}/complete/").status_code, 400)  # pending -> completed
        prov.post(f"/api/bookings/{b.id}/decline/")
        self.assertEqual(prov.post(f"/api/bookings/{b.id}/accept/").status_code, 400)    # declined is terminal
        self.assertEqual(client_for(self.cu).post(f"/api/bookings/{b.id}/cancel/").status_code, 400)

    def test_role_restrictions_on_transitions(self):
        b = make_booking(self.cu, self.p)
        self.assertEqual(client_for(self.cu).post(f"/api/bookings/{b.id}/accept/").status_code, 403)  # customer can't accept
        self.assertEqual(client_for(self.pu2).post(f"/api/bookings/{b.id}/accept/").status_code, 404)  # other provider: not visible
        self.assertEqual(client_for(self.cu2).post(f"/api/bookings/{b.id}/cancel/").status_code, 404)  # other customer
        b.refresh_from_db()
        self.assertEqual(b.status, "PENDING")

    def test_customer_can_cancel_pending_and_accepted_only(self):
        b = make_booking(self.cu, self.p)
        self.assertEqual(client_for(self.cu).post(f"/api/bookings/{b.id}/cancel/").data["status"], "CANCELLED")
        b2 = make_booking(self.cu, self.p, status="IN_PROGRESS")
        self.assertEqual(client_for(self.cu).post(f"/api/bookings/{b2.id}/cancel/").status_code, 400)

    def test_status_cannot_be_patched_directly(self):
        b = make_booking(self.cu, self.p)
        r = client_for(self.cu).patch(f"/api/bookings/{b.id}/", {"status": "COMPLETED"}, format="json")
        self.assertEqual(r.status_code, 405)
        self.assertEqual(client_for(self.pu).patch(f"/api/bookings/{b.id}/", {"status": "COMPLETED"}, format="json").status_code, 405)

    def test_customer_cannot_set_final_price(self):
        b = make_booking(self.cu, self.p, status="IN_PROGRESS")
        r = client_for(self.cu).post(f"/api/bookings/{b.id}/complete/", {"final_price": "1"}, format="json")
        self.assertEqual(r.status_code, 400)


class BookingReviewFieldTests(TestCase):
    def test_booking_exposes_own_review(self):
        from reviews.models import Review
        cu = make_user("rc@example.com")
        _, p = make_provider("rp@example.com")
        b = make_booking(cu, p, status="COMPLETED")
        r = client_for(cu).get(f"/api/bookings/{b.id}/")
        self.assertIsNone(r.data["review"])
        rv = Review.objects.create(customer=cu, provider=p, booking=b, rating=4, comment="Good")
        r = client_for(cu).get(f"/api/bookings/{b.id}/")
        self.assertEqual(r.data["review"], {"id": rv.id, "rating": 4, "comment": "Good"})

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


class DoubleBookingTests(TestCase):
    def setUp(self):
        self.cu = make_user("dc1@example.com")
        self.cu2 = make_user("dc2@example.com")
        self.pu, self.p = make_provider("dp1@example.com")
        self.day = timezone.localdate() + timedelta(days=4)

    def post(self, user, slot, **kw):
        return client_for(user).post("/api/bookings/", {
            "provider": self.p.id, "title": "Job", "description": "d", "scheduled_date": str(self.day),
            "time_slot": slot, "location": "x", **kw,
        }, format="json")

    def test_customer_cannot_double_submit_same_slot(self):
        self.assertEqual(self.post(self.cu, "10:00 - 12:00").status_code, 201)
        r = self.post(self.cu, "11:00 - 13:00")
        self.assertEqual(r.status_code, 400)
        self.assertIn("time_slot", r.data["errors"])
        self.assertEqual(self.post(self.cu, "12:00 - 14:00").status_code, 201)  # touching, not overlapping

    def test_committed_slot_blocks_new_requests_but_pending_does_not(self):
        make_booking(self.cu2, self.p, status="PENDING", scheduled_date=self.day)
        self.assertEqual(self.post(self.cu, "10:00 - 12:00").status_code, 201)
        make_booking(self.cu2, self.p, status="ACCEPTED", scheduled_date=self.day, time_slot="14:00 - 16:00")
        r = self.post(self.cu, "14:00 - 16:00")
        self.assertEqual(r.status_code, 400)
        self.assertIn("already booked", str(r.data["errors"]["time_slot"]))

    def test_provider_cannot_accept_overlapping_jobs(self):
        a = make_booking(self.cu, self.p, scheduled_date=self.day)
        b = make_booking(self.cu2, self.p, scheduled_date=self.day, time_slot="11:00 - 13:00")
        c = client_for(self.pu)
        self.assertEqual(c.post(f"/api/bookings/{a.id}/accept/").status_code, 200)
        r = c.post(f"/api/bookings/{b.id}/accept/")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(c.post(f"/api/bookings/{b.id}/decline/").status_code, 200)

    def test_busy_endpoint_lists_only_committed_slots(self):
        make_booking(self.cu, self.p, status="ACCEPTED", scheduled_date=self.day)
        make_booking(self.cu2, self.p, status="PENDING", scheduled_date=self.day, time_slot="14:00 - 16:00")
        r = client_for().get(f"/api/bookings/busy/?provider={self.p.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, [{"date": self.day, "time_slot": "10:00 - 12:00"}])
        self.assertEqual(client_for().get("/api/bookings/busy/").status_code, 400)


class BookingNotesPhotosTests(TestCase):
    def setUp(self):
        import tempfile

        from django.test import override_settings

        self.media = override_settings(MEDIA_ROOT=tempfile.mkdtemp())
        self.media.enable()
        self.cu = make_user("nc@example.com")
        self.other = make_user("nc2@example.com")
        self.pu, self.p = make_provider("np@example.com")

    def tearDown(self):
        self.media.disable()

    def png(self):
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (8, 8), (0, 128, 0)).save(buf, "PNG")
        return SimpleUploadedFile("job.png", buf.getvalue(), content_type="image/png")

    def test_notes_saved_and_visible_to_provider(self):
        r = client_for(self.cu).post("/api/bookings/", {
            "provider": self.p.id, "title": "Job", "description": "d", "location": "x", "notes": "Gate code 4411",
            "scheduled_date": str(timezone.localdate() + timedelta(days=1)), "time_slot": "08:00 - 10:00",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        got = client_for(self.pu).get(f"/api/bookings/{r.data['id']}/")
        self.assertEqual(got.data["notes"], "Gate code 4411")

    def test_customer_uploads_and_removes_photos(self):
        b = make_booking(self.cu, self.p)
        c = client_for(self.cu)
        r = c.post(f"/api/bookings/{b.id}/photos/", {"image": self.png()}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["image"].startswith("http"))
        detail = client_for(self.pu).get(f"/api/bookings/{b.id}/").data
        self.assertEqual(len(detail["photos"]), 1)
        # provider and strangers can't add or remove
        self.assertEqual(client_for(self.pu).post(f"/api/bookings/{b.id}/photos/", {"image": self.png()}, format="multipart").status_code, 403)
        self.assertEqual(client_for(self.other).delete(f"/api/bookings/{b.id}/photos/{r.data['id']}/").status_code, 404)
        self.assertEqual(c.delete(f"/api/bookings/{b.id}/photos/{r.data['id']}/").status_code, 204)
        self.assertEqual(c.get(f"/api/bookings/{b.id}/").data["photos"], [])

    def test_photo_limits(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        b = make_booking(self.cu, self.p)
        c = client_for(self.cu)
        bad = SimpleUploadedFile("x.png", b"nope", content_type="image/png")
        self.assertEqual(c.post(f"/api/bookings/{b.id}/photos/", {"image": bad}, format="multipart").status_code, 400)
        for _ in range(6):
            self.assertEqual(c.post(f"/api/bookings/{b.id}/photos/", {"image": self.png()}, format="multipart").status_code, 201)
        self.assertEqual(c.post(f"/api/bookings/{b.id}/photos/", {"image": self.png()}, format="multipart").status_code, 400)
        done = make_booking(self.cu, self.p, status="COMPLETED")
        self.assertEqual(c.post(f"/api/bookings/{done.id}/photos/", {"image": self.png()}, format="multipart").status_code, 400)

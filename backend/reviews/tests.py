from django.test import TestCase

from common.testing import client_for, make_booking, make_provider, make_user


class ReviewTests(TestCase):
    def setUp(self):
        self.cu = make_user("c1@example.com")
        self.cu2 = make_user("c2@example.com")
        self.pu, self.p = make_provider("p1@example.com")
        self.done = make_booking(self.cu, self.p, status="COMPLETED")

    def post(self, user, booking, rating=5, comment="great"):
        return client_for(user).post("/api/reviews/", {"booking": booking.id, "rating": rating, "comment": comment}, format="json")

    def test_customer_reviews_completed_booking_and_rating_updates(self):
        r = self.post(self.cu, self.done, 4)
        self.assertEqual(r.status_code, 201, r.data)
        self.p.refresh_from_db()
        self.assertEqual(float(self.p.rating), 4.0)
        self.assertEqual(self.p.total_reviews, 1)
        b2 = make_booking(self.cu2, self.p, status="COMPLETED")
        self.post(self.cu2, b2, 5)
        self.p.refresh_from_db()
        self.assertEqual(float(self.p.rating), 4.5)
        self.assertEqual(self.p.total_reviews, 2)

    def test_duplicate_review_rejected(self):
        self.assertEqual(self.post(self.cu, self.done).status_code, 201)
        self.assertEqual(self.post(self.cu, self.done).status_code, 400)

    def test_must_be_own_completed_booking(self):
        self.assertEqual(self.post(self.cu2, self.done).status_code, 400)  # someone else's booking
        pending = make_booking(self.cu, self.p, status="PENDING")
        self.assertEqual(self.post(self.cu, pending).status_code, 400)
        self.assertEqual(self.post(self.pu, self.done).status_code, 403)   # providers can't review
        self.assertEqual(client_for().post("/api/reviews/", {}, format="json").status_code, 401)

    def test_rating_bounds(self):
        self.assertEqual(self.post(self.cu, self.done, 0).status_code, 400)
        self.assertEqual(self.post(self.cu, self.done, 6).status_code, 400)

    def test_edit_recalculates_and_only_author_can_edit(self):
        rid = self.post(self.cu, self.done, 5).data["id"]
        self.assertEqual(client_for(self.cu2).patch(f"/api/reviews/{rid}/", {"rating": 1}, format="json").status_code, 404)
        self.assertEqual(client_for(self.cu).patch(f"/api/reviews/{rid}/", {"rating": 2}, format="json").status_code, 200)
        self.p.refresh_from_db()
        self.assertEqual(float(self.p.rating), 2.0)
        self.assertEqual(client_for(self.cu).delete(f"/api/reviews/{rid}/").status_code, 204)
        self.p.refresh_from_db()
        self.assertEqual((float(self.p.rating), self.p.total_reviews), (0.0, 0))

    def test_hidden_reviews_excluded_from_rating_and_public_list(self):
        from reviews.models import Review
        self.post(self.cu, self.done, 1)
        rv = Review.objects.get()
        rv.is_published = False
        rv.save()
        self.p.refresh_from_db()
        self.assertEqual(self.p.total_reviews, 0)
        self.assertEqual(client_for().get(f"/api/providers/{self.p.id}/reviews/").data["count"], 0)

    def test_public_review_list_by_provider(self):
        self.post(self.cu, self.done, 5)
        r = client_for().get(f"/api/reviews/?provider={self.p.id}")
        self.assertEqual(r.data["count"], 1)
        r = client_for().get(f"/api/providers/{self.p.id}/reviews/")
        self.assertEqual(r.data["count"], 1)


class ReviewModerationTests(TestCase):
    def setUp(self):
        from reviews.models import Review

        self.admin = make_user("mod@example.com", role="ADMIN")
        self.cu = make_user("mc@example.com")
        self.pu, self.p = make_provider("mp@example.com")
        self.good = Review.objects.create(customer=self.cu, provider=self.p, booking=make_booking(self.cu, self.p, status="COMPLETED"), rating=5, comment="great")
        self.bad = Review.objects.create(customer=self.cu, provider=self.p, booking=make_booking(self.cu, self.p, status="COMPLETED", time_slot="14:00 - 16:00"), rating=1, comment="spam link")

    def test_only_admins_moderate(self):
        for u in (None, self.cu, self.pu):
            c = client_for(u)
            self.assertIn(c.get("/api/reviews/moderation/").status_code, (401, 403))
            self.assertIn(c.post(f"/api/reviews/{self.bad.id}/hide/").status_code, (401, 403))

    def test_hide_and_publish_update_public_list_and_rating(self):
        c = client_for(self.admin)
        low = c.get("/api/reviews/moderation/?max_rating=2").data["results"]
        self.assertEqual([r["id"] for r in low], [self.bad.id])
        r = c.post(f"/api/reviews/{self.bad.id}/hide/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["is_published"])
        self.p.refresh_from_db()
        self.assertEqual((float(self.p.rating), self.p.total_reviews), (5.0, 1))
        public = client_for().get(f"/api/reviews/?provider={self.p.id}").data["results"]
        self.assertEqual([x["id"] for x in public], [self.good.id])
        hidden = c.get("/api/reviews/moderation/?state=hidden").data["results"]
        self.assertEqual([x["id"] for x in hidden], [self.bad.id])
        c.post(f"/api/reviews/{self.bad.id}/publish/")
        self.p.refresh_from_db()
        self.assertEqual(self.p.total_reviews, 2)

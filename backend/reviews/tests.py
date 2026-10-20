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

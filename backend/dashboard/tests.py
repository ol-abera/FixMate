from decimal import Decimal

from django.test import TestCase

from common.testing import client_for, make_booking, make_category, make_provider, make_user
from favorites.models import Favorite
from reviews.models import Review


class DashboardTests(TestCase):
    def setUp(self):
        self.cat = make_category("Plumbing")
        self.cu = make_user("c1@example.com")
        self.pu, self.p = make_provider("p1@example.com", category=self.cat)
        self.admin = make_user("admin@example.com", role="ADMIN")

    def test_permissions(self):
        self.assertEqual(client_for().get("/api/dashboard/customer/").status_code, 401)
        self.assertEqual(client_for(self.pu).get("/api/dashboard/customer/").status_code, 403)
        self.assertEqual(client_for(self.cu).get("/api/dashboard/provider/").status_code, 403)
        self.assertEqual(client_for(self.cu).get("/api/dashboard/admin/").status_code, 403)
        self.assertEqual(client_for(self.admin).get("/api/dashboard/admin/").status_code, 200)

    def test_customer_dashboard_from_real_data(self):
        make_booking(self.cu, self.p, status="PENDING")
        make_booking(self.cu, self.p, status="COMPLETED")
        _, other = make_provider("p2@example.com", rating=4.9)
        Favorite.objects.create(customer=self.cu, provider=self.p)
        r = client_for(self.cu).get("/api/dashboard/customer/")
        self.assertEqual(r.status_code, 200, r.data)
        s = r.data["stats"]
        self.assertEqual((s["active_bookings"], s["completed_bookings"], s["favorite_providers"]), (1, 1, 1))
        self.assertEqual(len(r.data["favorite_providers"]), 1)
        self.assertEqual([p["id"] for p in r.data["recommended_providers"]], [other.id])  # excludes favourites

    def test_customer_dashboard_ignores_other_customers_data(self):
        cu2 = make_user("c2@example.com")
        make_booking(cu2, self.p, status="PENDING")
        r = client_for(self.cu).get("/api/dashboard/customer/")
        self.assertEqual(r.data["stats"]["active_bookings"], 0)

    def test_provider_dashboard_earnings_and_reviews(self):
        make_booking(self.cu, self.p, status="PENDING")
        make_booking(self.cu, self.p, status="IN_PROGRESS")
        done = make_booking(self.cu, self.p, status="PENDING", estimated_price=100, time_slot="14:00 - 16:00")
        c = client_for(self.pu)
        c.post(f"/api/bookings/{done.id}/accept/")
        c.post(f"/api/bookings/{done.id}/start/")
        c.post(f"/api/bookings/{done.id}/complete/", {"final_price": "250"}, format="json")
        Review.objects.create(customer=self.cu, provider=self.p, booking=done, rating=5, comment="ok")
        r = c.get("/api/dashboard/provider/")
        self.assertEqual(r.status_code, 200, r.data)
        st = r.data["stats"]
        self.assertEqual((st["new_requests"], st["active_jobs"], st["completed_jobs"]), (1, 1, 1))
        self.assertEqual(Decimal(str(r.data["earnings"]["total"])), Decimal("250"))
        self.assertEqual(Decimal(str(r.data["earnings"]["last_7_days"])), Decimal("250"))
        self.assertEqual(len(r.data["earnings"]["daily"]), 7)
        self.assertEqual(float(st["rating"]), 5.0)
        self.assertEqual(len(r.data["recent_reviews"]), 1)

    def test_provider_without_profile_gets_404(self):
        lonely = make_user("lone@example.com", role="PROVIDER")
        self.assertEqual(client_for(lonely).get("/api/dashboard/provider/").status_code, 404)


class PublicStatsTests(TestCase):
    def test_public_stats_use_real_data_and_hide_unverified(self):
        cat = make_category("Plumbing")
        cu = make_user("c@example.com", first_name="Cara")
        _, p = make_provider("p@example.com", category=cat, location="Austin")
        make_provider("q@example.com", location="Round Rock")
        make_provider("hidden@example.com", verified=False, location="Secret City")
        done = make_booking(cu, p, status="COMPLETED")
        Review.objects.create(customer=cu, provider=p, booking=done, rating=5, comment="Great work")
        r = client_for().get("/api/dashboard/public/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["verified_providers"], 2)
        self.assertEqual(r.data["jobs_completed"], 1)
        self.assertEqual(r.data["avg_rating"], 5.0)
        self.assertEqual(r.data["cities"], ["Austin", "Round Rock"])
        self.assertEqual(len(r.data["featured_reviews"]), 1)
        self.assertEqual(r.data["featured_reviews"][0]["comment"], "Great work")
        self.assertEqual(r.data["featured_reviews"][0]["provider_city"], "Austin")

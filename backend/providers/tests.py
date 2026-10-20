from django.test import TestCase

from common.testing import client_for, make_category, make_provider, make_service, make_user
from notifications.models import Notification


class ProviderTests(TestCase):
    def setUp(self):
        self.cat = make_category("Plumbing")
        self.admin = make_user("admin@example.com", role="ADMIN")

    def test_provider_creates_and_updates_own_profile(self):
        u = make_user("p@example.com", role="PROVIDER")
        c = client_for(u)
        r = c.post("/api/providers/", {"profession": "Plumber", "location": "Austin", "hourly_rate": "50",
                                       "categories": [self.cat.slug], "skills": ["Leaks", "Pipes"]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["verification_status"], "PENDING")
        self.assertEqual(r.data["skills"], ["Leaks", "Pipes"])
        self.assertEqual(c.post("/api/providers/", {"profession": "x"}, format="json").status_code, 400)  # only one profile
        r = c.patch("/api/providers/me/", {"hourly_rate": "75", "verification_status": "VERIFIED", "rating": "5"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["verification_status"], "PENDING")  # cannot self-verify
        self.assertEqual(str(r.data["hourly_rate"]), "75.00")

    def test_customer_cannot_create_provider_profile(self):
        c = client_for(make_user("c@example.com"))
        self.assertEqual(c.post("/api/providers/", {"profession": "x"}, format="json").status_code, 403)

    def test_admin_verifies_and_rejects(self):
        _, p = make_provider(verified=False)
        # not public yet
        self.assertEqual(client_for().get("/api/providers/").data["count"], 0)
        self.assertEqual(client_for().get(f"/api/providers/{p.id}/").status_code, 404)
        # non-admin cannot verify
        self.assertEqual(client_for(make_user("c@example.com")).post(f"/api/providers/{p.id}/verify/").status_code, 403)
        self.assertEqual(client_for(p.user).post(f"/api/providers/{p.id}/verify/").status_code, 403)
        r = client_for(self.admin).post(f"/api/providers/{p.id}/verify/")
        self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        p.user.refresh_from_db()
        self.assertEqual(p.verification_status, "VERIFIED")
        self.assertTrue(p.user.is_verified)
        self.assertTrue(Notification.objects.filter(recipient=p.user, notification_type="PROVIDER_VERIFICATION").exists())
        self.assertEqual(client_for().get("/api/providers/").data["count"], 1)
        client_for(self.admin).post(f"/api/providers/{p.id}/reject/")
        p.refresh_from_db()
        self.assertEqual(p.verification_status, "REJECTED")
        self.assertEqual(client_for().get("/api/providers/").data["count"], 0)

    def test_owner_can_view_own_unverified_profile(self):
        u, p = make_provider(verified=False)
        self.assertEqual(client_for(u).get(f"/api/providers/{p.id}/").status_code, 200)
        self.assertEqual(client_for(make_user("c@example.com")).get(f"/api/providers/{p.id}/").status_code, 404)

    def test_admin_can_list_unverified_explicitly(self):
        make_provider(verified=False)
        r = client_for(self.admin).get("/api/providers/?include_unverified=true")
        self.assertEqual(r.data["count"], 1)
        r = client_for(make_user("c@example.com")).get("/api/providers/?include_unverified=true")
        self.assertEqual(r.data["count"], 0)  # ignored for non-admins

    def test_search_filter_order_and_pagination(self):
        elec = make_category("Computer Repair")
        _, a = make_provider("a@example.com", category=self.cat, profession="Plumber", location="Austin",
                             hourly_rate=40, starting_price=50, rating=4.9, skills="leaks,pipes")
        _, b = make_provider("b@example.com", category=elec, profession="Computer fixer", location="Round Rock",
                             hourly_rate=120, starting_price=150, rating=4.2, skills="laptops")
        _, c_ = make_provider("c@example.com", category=elec, profession="Phone tech", location="Austin",
                              hourly_rate=80, starting_price=90, rating=4.6, availability="BUSY")
        make_provider("hidden@example.com", verified=False, category=elec, profession="Computer hidden")
        api = client_for()
        ids = lambda q: sorted(x["id"] for x in api.get("/api/providers/" + q).data["results"])
        self.assertEqual(ids("?search=computer"), [b.id])
        self.assertEqual(ids("?search=pipes"), [a.id])
        self.assertEqual(ids("?category=computer-repair"), sorted([b.id, c_.id]))
        self.assertEqual(ids("?location=round-rock"), [b.id])
        self.assertEqual(ids("?min_price=100"), [b.id])
        self.assertEqual(ids("?max_price=90"), sorted([a.id, c_.id]))
        self.assertEqual(ids("?max_rate=50"), [a.id])
        self.assertEqual(ids("?rating=4.5"), sorted([a.id, c_.id]))
        self.assertEqual(ids("?available_now=true"), sorted([a.id, b.id]))
        r = api.get("/api/providers/?ordering=-rating")
        self.assertEqual([x["id"] for x in r.data["results"]], [a.id, c_.id, b.id])
        r = api.get("/api/providers/?ordering=hourly_rate&page_size=2")
        self.assertEqual(len(r.data["results"]), 2)
        self.assertEqual(r.data["count"], 3)
        self.assertIsNotNone(r.data["next"])
        self.assertEqual(api.get("/api/providers/?min_price=abc").status_code, 400)

    def test_provider_detail_has_services_and_gallery(self):
        _, p = make_provider(category=self.cat)
        make_service(p, self.cat)
        r = client_for().get(f"/api/providers/{p.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["services"]), 1)
        self.assertEqual(r.data["gallery"], [])

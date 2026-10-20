from django.test import TestCase

from common.testing import client_for, make_category, make_provider, make_service, make_user


class ServiceTests(TestCase):
    def setUp(self):
        self.cat = make_category("Plumbing")
        self.pu, self.p = make_provider("p1@example.com")
        self.pu2, self.p2 = make_provider("p2@example.com")

    def payload(self, **kw):
        d = {"title": "Fix leak", "description": "d", "starting_price": "100.00", "duration_minutes": 60, "category": self.cat.slug}
        d.update(kw)
        return d

    def test_provider_creates_service_for_self_only(self):
        c = client_for(self.pu)
        r = c.post("/api/services/", self.payload(provider=self.p2.id), format="json")  # provider in payload is ignored
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["provider"], self.p.id)

    def test_customer_and_anon_cannot_create(self):
        self.assertEqual(client_for(make_user("c@example.com")).post("/api/services/", self.payload(), format="json").status_code, 403)
        self.assertEqual(client_for().post("/api/services/", self.payload(), format="json").status_code, 401)

    def test_provider_cannot_modify_others_service(self):
        s = make_service(self.p, self.cat)
        other = client_for(self.pu2)
        self.assertEqual(other.patch(f"/api/services/{s.id}/", {"title": "hack"}, format="json").status_code, 403)
        self.assertEqual(other.delete(f"/api/services/{s.id}/").status_code, 403)
        owner = client_for(self.pu)
        self.assertEqual(owner.patch(f"/api/services/{s.id}/", {"title": "ok"}, format="json").status_code, 200)
        self.assertEqual(owner.delete(f"/api/services/{s.id}/").status_code, 204)

    def test_public_list_hides_inactive_and_unverified(self):
        make_service(self.p, self.cat, "Visible")
        make_service(self.p, self.cat, "Inactive", is_active=False)
        _, pending = make_provider("pend@example.com", verified=False)
        make_service(pending, self.cat, "Pending provider")
        r = client_for().get("/api/services/")
        self.assertEqual([s["title"] for s in r.data["results"]], ["Visible"])
        r = client_for(self.pu).get("/api/services/?mine=true")
        self.assertEqual(r.data["count"], 2)

    def test_service_filters(self):
        make_service(self.p, self.cat, "Cheap leak", 50)
        make_service(self.p, self.cat, "Big job", 500)
        api = client_for()
        self.assertEqual(api.get("/api/services/?search=leak").data["count"], 1)
        self.assertEqual(api.get("/api/services/?min_price=100").data["count"], 1)
        self.assertEqual(api.get("/api/services/?category=plumbing").data["count"], 2)

    def test_categories_endpoint(self):
        r = client_for().get("/api/categories/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data[0]["slug"], "plumbing")

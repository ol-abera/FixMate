from django.test import TestCase

from common.testing import client_for, make_provider, make_user


class FavoriteTests(TestCase):
    def setUp(self):
        self.cu = make_user("c1@example.com")
        self.cu2 = make_user("c2@example.com")
        self.pu, self.p = make_provider("p1@example.com")

    def test_add_list_remove(self):
        c = client_for(self.cu)
        r = c.post("/api/favorites/", {"provider": self.p.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual([x["id"] for x in c.get("/api/favorites/").data], [self.p.id])
        self.assertEqual(c.delete(f"/api/favorites/{self.p.id}/").status_code, 204)
        self.assertEqual(c.get("/api/favorites/").data, [])
        self.assertEqual(c.delete(f"/api/favorites/{self.p.id}/").status_code, 404)

    def test_no_duplicates(self):
        c = client_for(self.cu)
        c.post("/api/favorites/", {"provider": self.p.id}, format="json")
        r = c.post("/api/favorites/", {"provider": self.p.id}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["created"])
        from favorites.models import Favorite
        self.assertEqual(Favorite.objects.count(), 1)

    def test_isolated_per_customer_and_roles(self):
        client_for(self.cu).post("/api/favorites/", {"provider": self.p.id}, format="json")
        self.assertEqual(client_for(self.cu2).get("/api/favorites/").data, [])
        self.assertEqual(client_for(self.cu2).delete(f"/api/favorites/{self.p.id}/").status_code, 404)
        self.assertEqual(client_for(self.pu).post("/api/favorites/", {"provider": self.p.id}, format="json").status_code, 403)
        self.assertEqual(client_for().get("/api/favorites/").status_code, 401)

    def test_cannot_favorite_unverified(self):
        _, pending = make_provider("pend@example.com", verified=False)
        r = client_for(self.cu).post("/api/favorites/", {"provider": pending.id}, format="json")
        self.assertEqual(r.status_code, 400)

from django.test import TestCase
from rest_framework.test import APIClient

from common.testing import TEST_PASSWORD, client_for, make_category, make_user
from providers.models import ProviderProfile
from users.models import User


class AuthTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_register_customer_hashes_password_and_returns_tokens(self):
        r = self.api.post("/api/auth/register/", {
            "email": "New@Example.com", "password": TEST_PASSWORD, "first_name": "Nia", "role": "CUSTOMER",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)
        u = User.objects.get(email="new@example.com")
        self.assertNotEqual(u.password, TEST_PASSWORD)
        self.assertTrue(u.check_password(TEST_PASSWORD))
        self.assertEqual(u.role, "CUSTOMER")

    def test_register_provider_creates_pending_profile(self):
        cat = make_category("Electrician")
        r = self.api.post("/api/auth/register/", {
            "email": "pro@example.com", "password": TEST_PASSWORD, "first_name": "Pat", "role": "PROVIDER",
            "profession": "Electrician", "category": cat.slug, "hourly_rate": "40.00", "location": "Austin",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        p = ProviderProfile.objects.get(user__email="pro@example.com")
        self.assertEqual(p.verification_status, "PENDING")
        self.assertIn(cat, p.categories.all())

    def test_cannot_register_as_admin(self):
        r = self.api.post("/api/auth/register/", {
            "email": "evil@example.com", "password": TEST_PASSWORD, "first_name": "E", "role": "ADMIN",
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(email="evil@example.com").exists())

    def test_duplicate_email_and_weak_password_rejected(self):
        make_user("dup@example.com")
        r = self.api.post("/api/auth/register/", {"email": "DUP@example.com", "password": TEST_PASSWORD, "first_name": "D"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.api.post("/api/auth/register/", {"email": "x@example.com", "password": "12345678", "first_name": "D"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_login_and_me(self):
        make_user("a@example.com")
        r = self.api.post("/api/auth/login/", {"email": "a@example.com", "password": TEST_PASSWORD}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["user"]["email"], "a@example.com")
        me = client_for().get("/api/auth/me/")
        self.assertEqual(me.status_code, 401)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        me = c.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["email"], "a@example.com")

    def test_login_wrong_password(self):
        make_user("a@example.com")
        r = self.api.post("/api/auth/login/", {"email": "a@example.com", "password": "nope"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_disabled_user_cannot_login(self):
        make_user("off@example.com", is_active=False)
        r = self.api.post("/api/auth/login/", {"email": "off@example.com", "password": TEST_PASSWORD}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_token_refresh(self):
        make_user("a@example.com")
        r = self.api.post("/api/auth/login/", {"email": "a@example.com", "password": TEST_PASSWORD}, format="json")
        r2 = self.api.post("/api/auth/token/refresh/", {"refresh": r.data["refresh"]}, format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertIn("access", r2.data)

    def test_me_cannot_escalate_role(self):
        u = make_user("a@example.com")
        c = client_for(u)
        r = c.patch("/api/auth/me/", {"role": "ADMIN", "is_verified": True, "first_name": "Zed"}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertEqual(u.role, "CUSTOMER")
        self.assertFalse(u.is_verified)
        self.assertEqual(u.first_name, "Zed")

    def test_profile_image_validation(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        u = make_user("a@example.com")
        c = client_for(u)
        bad = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
        r = c.patch("/api/auth/me/", {"profile_image": bad}, format="multipart")
        self.assertEqual(r.status_code, 400)
        evil = SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")
        r = c.patch("/api/auth/me/", {"profile_image": evil}, format="multipart")
        self.assertEqual(r.status_code, 400)

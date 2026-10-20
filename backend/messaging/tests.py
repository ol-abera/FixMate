from django.test import TestCase

from common.testing import client_for, make_booking, make_provider, make_user
from notifications.models import Notification


class MessagingTests(TestCase):
    def setUp(self):
        self.cu = make_user("c1@example.com")
        self.cu2 = make_user("c2@example.com")
        self.pu, self.p = make_provider("p1@example.com")
        self.pu2, self.p2 = make_provider("p2@example.com")

    def start(self, user=None, provider=None, text="hello"):
        return client_for(user or self.cu).post("/api/conversations/", {"provider": (provider or self.p).id, "text": text}, format="json")

    def test_customer_starts_conversation_once(self):
        r = self.start()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["other"]["provider_id"], self.p.id)
        r2 = self.start(text="again")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["id"], r.data["id"])
        cid = r.data["id"]
        d = client_for(self.cu).get(f"/api/conversations/{cid}/")
        self.assertEqual([m["text"] for m in d.data["messages"]], ["hello", "again"])

    def test_send_message_notifies_and_marks_read_on_open(self):
        cid = self.start().data["id"]
        r = client_for(self.pu).post(f"/api/conversations/{cid}/messages/", {"text": "hi there"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Notification.objects.filter(recipient=self.cu, notification_type="NEW_MESSAGE").exists())
        lst = client_for(self.cu).get("/api/conversations/").data["results"]
        self.assertEqual(lst[0]["unread_count"], 1)
        client_for(self.cu).get(f"/api/conversations/{cid}/")
        self.assertEqual(client_for(self.cu).get("/api/conversations/").data["results"][0]["unread_count"], 0)

    def test_conversations_are_private(self):
        cid = self.start().data["id"]
        for outsider in (self.cu2, self.pu2):
            c = client_for(outsider)
            self.assertEqual(c.get(f"/api/conversations/{cid}/").status_code, 404)
            self.assertEqual(c.get(f"/api/conversations/{cid}/messages/").status_code, 404)
            self.assertEqual(c.post(f"/api/conversations/{cid}/messages/", {"text": "spy"}, format="json").status_code, 404)
            self.assertEqual(c.get("/api/conversations/").data["results"], [])
        self.assertEqual(client_for().get(f"/api/conversations/{cid}/").status_code, 401)

    def test_empty_message_and_self_or_same_role_rejected(self):
        cid = self.start().data["id"]
        self.assertEqual(client_for(self.cu).post(f"/api/conversations/{cid}/messages/", {"text": "  "}, format="json").status_code, 400)
        # provider cannot message their own profile / providers cannot start with providers
        r = client_for(self.pu).post("/api/conversations/", {"provider": self.p2.id}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_provider_can_only_start_with_customer_having_booking(self):
        c = client_for(self.pu)
        self.assertEqual(c.post("/api/conversations/", {"customer": self.cu.id}, format="json").status_code, 400)
        make_booking(self.cu, self.p)
        self.assertEqual(c.post("/api/conversations/", {"customer": self.cu.id, "text": "Hi"}, format="json").status_code, 201)

    def test_polling_after_id(self):
        cid = self.start(text="one").data["id"]
        c = client_for(self.cu)
        m2 = c.post(f"/api/conversations/{cid}/messages/", {"text": "two"}, format="json").data["id"]
        r = c.get(f"/api/conversations/{cid}/messages/?after={m2 - 1}")
        self.assertEqual([m["text"] for m in r.data], ["two"])

    def test_attachment_validation(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        cid = self.start().data["id"]
        bad = SimpleUploadedFile("x.png", b"nope", content_type="image/png")
        r = client_for(self.cu).post(f"/api/conversations/{cid}/messages/", {"text": "pic", "attachment": bad}, format="multipart")
        self.assertEqual(r.status_code, 400)

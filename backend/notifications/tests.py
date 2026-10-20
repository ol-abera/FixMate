from django.test import TestCase

from common.testing import client_for, make_user
from notifications.models import Notification
from notifications.services import notify


class NotificationTests(TestCase):
    def setUp(self):
        self.u = make_user("a@example.com")
        self.v = make_user("b@example.com")
        self.n1 = notify(self.u, "NEW_MESSAGE", "t1", "m1")
        self.n2 = notify(self.u, "BOOKING_STATUS", "t2", "m2")
        self.other = notify(self.v, "NEW_MESSAGE", "secret", "x")

    def test_list_only_own_with_unread_count(self):
        r = client_for(self.u).get("/api/notifications/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 2)
        self.assertEqual(r.data["unread_count"], 2)
        self.assertEqual(client_for().get("/api/notifications/").status_code, 401)

    def test_mark_read_own_only(self):
        c = client_for(self.u)
        self.assertEqual(c.patch(f"/api/notifications/{self.n1.id}/read/").status_code, 200)
        self.n1.refresh_from_db()
        self.assertTrue(self.n1.is_read)
        self.assertEqual(c.patch(f"/api/notifications/{self.other.id}/read/").status_code, 404)
        self.other.refresh_from_db()
        self.assertFalse(self.other.is_read)

    def test_read_all_and_clear(self):
        c = client_for(self.u)
        self.assertEqual(c.post("/api/notifications/read-all/").data["updated"], 2)
        self.assertEqual(c.get("/api/notifications/?unread=true").data["count"], 0)
        self.assertFalse(Notification.objects.get(pk=self.other.pk).is_read)  # not touched
        self.assertEqual(c.delete("/api/notifications/").data["deleted"], 2)
        self.assertEqual(Notification.objects.filter(recipient=self.v).count(), 1)

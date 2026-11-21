from datetime import timedelta
from unittest import mock

from asgiref.sync import sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from common.testing import client_for, make_booking, make_provider, make_user
from config.asgi import application
from messaging.services import get_or_create_conversation

from .consumers import UserEventsConsumer
from .events import group_name

IN_MEMORY = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
ORIGIN = (b"origin", b"http://localhost:3000")


def socket(origin=ORIGIN):
    return WebsocketCommunicator(application, "/ws/", headers=[origin] if origin else [])


@override_settings(CHANNEL_LAYERS=IN_MEMORY)
class ConsumerTests(TransactionTestCase):
    async def connect_as(self, user):
        ws = socket()
        connected, _ = await ws.connect()
        self.assertTrue(connected)
        await ws.send_json_to({"type": "auth", "token": str(AccessToken.for_user(user))})
        self.assertEqual(await ws.receive_json_from(), {"type": "ready"})
        return ws

    async def test_authenticated_socket_receives_its_users_events_only(self):
        alice = await sync_to_async(make_user)("ws-a@example.com")
        bob = await sync_to_async(make_user)("ws-b@example.com")
        a, b = await self.connect_as(alice), await self.connect_as(bob)
        await get_channel_layer().group_send(group_name(alice.id), {"type": "push", "payload": {"type": "booking", "booking_id": 1}})
        self.assertEqual(await a.receive_json_from(), {"type": "booking", "booking_id": 1})
        self.assertTrue(await b.receive_nothing(timeout=0.2))
        await a.send_json_to({"type": "ping"})
        self.assertEqual(await a.receive_json_from(), {"type": "pong"})
        await a.disconnect()
        await b.disconnect()

    async def test_bad_or_missing_auth_closes_with_4001(self):
        user = await sync_to_async(make_user)("ws-c@example.com")
        for first in ({"type": "auth", "token": "garbage"}, {"type": "ping"}):
            ws = socket()
            await ws.connect()
            await ws.send_json_to(first)
            self.assertEqual((await ws.receive_output())["code"], 4001)
        user.is_active = False
        await sync_to_async(user.save)()
        ws = socket()
        await ws.connect()
        await ws.send_json_to({"type": "auth", "token": str(AccessToken.for_user(user))})
        self.assertEqual((await ws.receive_output())["code"], 4001)

    async def test_expired_token_is_rejected_and_live_socket_closes_on_expiry(self):
        user = await sync_to_async(make_user)("ws-d@example.com")
        old = AccessToken.for_user(user)
        old.set_exp(lifetime=-timedelta(seconds=1))
        ws = socket()
        await ws.connect()
        await ws.send_json_to({"type": "auth", "token": str(old)})
        self.assertEqual((await ws.receive_output())["code"], 4001)

        ws = await self.connect_as(user)
        with mock.patch.object(UserEventsConsumer, "_expired", return_value=True):
            await get_channel_layer().group_send(group_name(user.id), {"type": "push", "payload": {"type": "x"}})
            self.assertEqual((await ws.receive_output())["code"], 4001)

    async def test_unauthenticated_socket_times_out(self):
        with mock.patch("realtime.consumers.AUTH_TIMEOUT", 0.05):
            ws = socket()
            await ws.connect()
            self.assertEqual((await ws.receive_output(timeout=1))["code"], 4001)

    async def test_foreign_origin_is_refused(self):
        ws = socket(origin=(b"origin", b"https://evil.example"))
        connected, _ = await ws.connect()
        self.assertFalse(connected)


class PushHookTests(TestCase):
    """Domain events fan out to the right users, only after commit."""

    def setUp(self):
        self.cu = make_user("hook-c@example.com")
        self.pu, self.p = make_provider("hook-p@example.com")
        patcher = mock.patch("realtime.events.group_send")
        self.sent = patcher.start()
        self.addCleanup(patcher.stop)

    def payloads(self):
        return [(c.args[0], c.args[1]) for c in self.sent.call_args_list]

    def test_booking_request_notifies_provider_in_realtime(self):
        b = make_booking(self.cu, self.p)
        with self.captureOnCommitCallbacks(execute=True):
            client_for(self.pu).post(f"/api/bookings/{b.id}/accept/")
        sent = self.payloads()
        self.assertIn((f"user_{self.cu.id}", {"type": "booking", "booking_id": b.id, "status": "ACCEPTED"}), sent)
        self.assertIn((f"user_{self.pu.id}", {"type": "booking", "booking_id": b.id, "status": "ACCEPTED"}), sent)
        notes = [p for g, p in sent if p["type"] == "notification"]
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0]["notification"]["notification_type"], "BOOKING_ACCEPTED")
        self.assertEqual(notes[0]["notification"]["data"], {"booking_id": b.id})

    def test_message_signals_both_participants(self):
        conv, _ = get_or_create_conversation(self.cu, self.pu)
        with self.captureOnCommitCallbacks(execute=True):
            r = client_for(self.cu).post(f"/api/conversations/{conv.id}/messages/", {"text": "hi"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        signals = [(g, p) for g, p in self.payloads() if p["type"] == "message"]
        self.assertEqual({g for g, _ in signals}, {f"user_{self.cu.id}", f"user_{self.pu.id}"})
        self.assertEqual(signals[0][1]["conversation_id"], conv.id)
        self.assertNotIn("text", signals[0][1])

    def test_nothing_is_sent_when_the_transaction_rolls_back(self):
        b = make_booking(self.cu, self.p, status="COMPLETED")
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            client_for(self.pu).post(f"/api/bookings/{b.id}/accept/")  # invalid transition -> 400
        self.assertEqual(callbacks, [])
        self.sent.assert_not_called()

    def test_broken_channel_layer_does_not_break_requests(self):
        self.sent.side_effect = ConnectionError("redis down")
        b = make_booking(self.cu, self.p)
        with self.assertLogs("realtime.events", "WARNING"), self.captureOnCommitCallbacks(execute=True):
            r = client_for(self.pu).post(f"/api/bookings/{b.id}/accept/")
        self.assertEqual(r.status_code, 200)

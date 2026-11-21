import asyncio
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .events import group_name

AUTH_TIMEOUT = 10
CLOSE_UNAUTHORIZED = 4001


@database_sync_to_async
def active_user_id(raw_token):
    try:
        token = AccessToken(raw_token)
    except TokenError:
        return None, 0
    uid = token.get("user_id")
    if not get_user_model().objects.filter(pk=uid, is_active=True).exists():
        return None, 0
    return uid, int(token["exp"])


class UserEventsConsumer(AsyncJsonWebsocketConsumer):
    """One socket per tab. The client authenticates with its first message, `{"type": "auth", "token": <access>}`,
    rather than in the URL, so tokens never end up in proxy or server logs. The socket closes with 4001 when the
    token is missing, invalid or expires; the client refreshes it and reconnects."""

    user_id = None
    expires_at = 0

    async def connect(self):
        await self.accept()
        self._auth_timer = asyncio.get_running_loop().call_later(AUTH_TIMEOUT, self._auth_timeout)

    def _auth_timeout(self):
        if self.user_id is None:
            asyncio.ensure_future(self.close(code=CLOSE_UNAUTHORIZED))

    async def disconnect(self, code):
        if getattr(self, "_auth_timer", None):
            self._auth_timer.cancel()
        if self.user_id is not None:
            await self.channel_layer.group_discard(group_name(self.user_id), self.channel_name)

    async def receive_json(self, content, **kwargs):
        kind = content.get("type") if isinstance(content, dict) else None
        if self.user_id is None:
            if kind != "auth":
                return await self.close(code=CLOSE_UNAUTHORIZED)
            uid, exp = await active_user_id(str(content.get("token", "")))
            if uid is None:
                return await self.close(code=CLOSE_UNAUTHORIZED)
            self.user_id, self.expires_at = uid, exp
            self._auth_timer.cancel()
            await self.channel_layer.group_add(group_name(uid), self.channel_name)
            return await self.send_json({"type": "ready"})
        if self._expired():
            return await self.close(code=CLOSE_UNAUTHORIZED)
        if kind == "ping":
            await self.send_json({"type": "pong"})

    async def push(self, event):
        if self._expired():
            return await self.close(code=CLOSE_UNAUTHORIZED)
        await self.send_json(event["payload"])

    def _expired(self):
        return time.time() >= self.expires_at

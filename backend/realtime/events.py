"""Push events to connected browsers. Every user has one group, `user_<id>`, that all their tabs join.

Events are sent after the surrounding transaction commits, so clients never fetch data that isn't saved yet.
A failing channel layer (e.g. Redis down) is logged and never breaks the request that triggered the event;
clients fall back to polling."""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

log = logging.getLogger(__name__)


def group_name(user_id):
    return f"user_{user_id}"


def group_send(group, payload):
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(group, {"type": "push", "payload": payload})


def push(user_ids, payload):
    ids = sorted({i for i in user_ids if i})

    def send():
        for uid in ids:
            try:
                group_send(group_name(uid), payload)
            except Exception:  # noqa: BLE001 - realtime is best-effort by design
                log.warning("Realtime push to user %s failed", uid, exc_info=True)

    transaction.on_commit(send)

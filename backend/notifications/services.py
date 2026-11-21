from realtime.events import push

from .models import Notification
from .serializers import NotificationSerializer


def notify(recipient, notification_type, title, message="", **data):
    """Single entry point for creating notifications. Connected browsers get them over the WebSocket."""
    n = Notification.objects.create(
        recipient=recipient, notification_type=notification_type,
        title=title, message=message, data=data,
    )
    push([recipient.id], {"type": "notification", "notification": NotificationSerializer(n).data})
    return n

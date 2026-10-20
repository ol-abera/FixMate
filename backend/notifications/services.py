from .models import Notification


def notify(recipient, notification_type, title, message="", **data):
    """Single entry point for creating notifications (easy to extend with push/WebSocket later)."""
    return Notification.objects.create(
        recipient=recipient, notification_type=notification_type,
        title=title, message=message, data=data,
    )

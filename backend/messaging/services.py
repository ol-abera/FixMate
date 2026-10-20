"""Messaging business logic. A WebSocket consumer (Django Channels) can call these same functions."""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import PermissionDenied, ValidationError

from notifications.models import Notification, NotificationType
from notifications.services import notify

from .models import Conversation, Message


def get_or_create_conversation(user_a, user_b):
    if user_a.id == user_b.id:
        raise ValidationError({"detail": "You cannot message yourself."})
    roles = {user_a.role, user_b.role}
    if roles != {"CUSTOMER", "PROVIDER"}:
        raise ValidationError({"detail": "Conversations are between a customer and a provider."})
    key = "-".join(str(i) for i in sorted([user_a.id, user_b.id]))
    with transaction.atomic():
        conv, created = Conversation.objects.get_or_create(participant_key=key)
        if created:
            conv.participants.add(user_a, user_b)
    return conv, created


def send_message(conversation, sender, text="", attachment=None):
    text = (text or "").strip()
    if not text and not attachment:
        raise ValidationError({"detail": "Message must have text or an attachment."})
    if len(text) > 4000:
        raise ValidationError({"text": "Message too long (max 4000 characters)."})
    if not conversation.participants.filter(pk=sender.pk).exists():
        raise PermissionDenied("You are not part of this conversation.")
    msg = Message(conversation=conversation, sender=sender, text=text, attachment=attachment)
    try:
        msg.full_clean()
    except DjangoValidationError as e:
        raise ValidationError(e.message_dict if hasattr(e, "message_dict") else e.messages)
    msg.save()
    Conversation.objects.filter(pk=conversation.pk).update(last_message_at=msg.created_at)
    recipient = conversation.participants.exclude(pk=sender.pk).first()
    if recipient:
        preview = text[:140] or "Sent an attachment"
        existing = Notification.objects.filter(
            recipient=recipient, notification_type=NotificationType.NEW_MESSAGE, is_read=False,
            data__conversation_id=conversation.id,
        ).first()
        if existing:  # collapse chatty threads into one unread notification
            existing.title = f"New message from {sender.full_name}"
            existing.message = preview
            existing.save(update_fields=["title", "message", "updated_at"])
        else:
            notify(recipient, NotificationType.NEW_MESSAGE, f"New message from {sender.full_name}", preview,
                   conversation_id=conversation.id)
    return msg


def mark_read(conversation, user):
    conversation.messages.exclude(sender=user).filter(is_read=False).update(is_read=True)
    Notification.objects.filter(
        recipient=user, notification_type=NotificationType.NEW_MESSAGE, is_read=False,
        data__conversation_id=conversation.id,
    ).update(is_read=True)

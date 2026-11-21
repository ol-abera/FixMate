from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    NEW_BOOKING = "NEW_BOOKING", "New booking request"
    BOOKING_ACCEPTED = "BOOKING_ACCEPTED", "Booking accepted"
    BOOKING_DECLINED = "BOOKING_DECLINED", "Booking declined"
    BOOKING_STATUS = "BOOKING_STATUS", "Booking status changed"
    NEW_MESSAGE = "NEW_MESSAGE", "New message"
    REVIEW_REMINDER = "REVIEW_REMINDER", "Review reminder"
    PROVIDER_VERIFICATION = "PROVIDER_VERIFICATION", "Provider verification"
    UPCOMING_BOOKING = "UPCOMING_BOOKING", "Upcoming booking"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED", "Payment received"


class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=160)
    message = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["recipient", "is_read", "-created_at"])]

    def __str__(self):
        return f"{self.notification_type} -> {self.recipient_id}"

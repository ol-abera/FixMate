from django.conf import settings
from django.db import models

from common.validators import validate_image_file

MAX_BOOKING_PHOTOS = 6


class BookingStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    DECLINED = "DECLINED", "Declined"


class Booking(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    provider = models.ForeignKey("providers.ProviderProfile", on_delete=models.CASCADE, related_name="bookings")
    service = models.ForeignKey("services.Service", on_delete=models.SET_NULL, null=True, blank=True, related_name="bookings")
    category = models.ForeignKey("services.ServiceCategory", on_delete=models.SET_NULL, null=True, blank=True, related_name="bookings")
    title = models.CharField(max_length=140)
    description = models.TextField()
    scheduled_date = models.DateField()
    scheduled_time = models.TimeField(help_text="Start of the requested slot.")
    time_slot = models.CharField(max_length=20, blank=True, help_text="e.g. '10:00 - 12:00'")
    location = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=120, blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    contact_email = models.EmailField(blank=True)
    notes = models.TextField(blank=True, help_text="Access notes: gate codes, parking, pets...")
    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=12, choices=BookingStatus.choices, default=BookingStatus.PENDING, db_index=True)
    upcoming_reminder_sent = models.BooleanField(default=False)
    review_reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["provider", "status"]),
            models.Index(fields=["scheduled_date"]),
        ]

    @property
    def earned_price(self):
        return self.final_price if self.final_price is not None else self.estimated_price

    def __str__(self):
        return f"#{self.pk} {self.title} [{self.status}]"


class BookingEvent(models.Model):
    """Timeline entries shown in the UI (one per status change)."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=12, choices=BookingStatus.choices)
    label = models.CharField(max_length=140)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class BookingPhoto(models.Model):
    """Photos the customer attaches so the provider can see the job before arriving."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="booking_photos/", validators=[validate_image_file])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

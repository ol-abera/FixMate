from django.conf import settings
from django.db import models


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Awaiting payment"
    PAID = "PAID", "Paid"
    FAILED = "FAILED", "Failed"


class Gateway(models.TextChoices):
    STRIPE = "stripe", "Stripe"
    MOCK = "mock", "Mock (development)"


class Payment(models.Model):
    """One payment per completed booking. A new checkout session replaces an unfinished one."""

    booking = models.OneToOneField("bookings.Booking", on_delete=models.CASCADE, related_name="payment")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="usd")
    gateway = models.CharField(max_length=10, choices=Gateway.choices)
    session_id = models.CharField(max_length=255, unique=True)
    payment_intent = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_gateway_display()} {self.amount} {self.currency.upper()} for booking #{self.booking_id} [{self.status}]"

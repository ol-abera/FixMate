from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews_written")
    provider = models.ForeignKey("providers.ProviderProfile", on_delete=models.CASCADE, related_name="reviews")
    booking = models.OneToOneField("bookings.Booking", on_delete=models.CASCADE, related_name="review")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    is_published = models.BooleanField(default=True, help_text="Untick to hide (moderation).")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["provider", "is_published", "-created_at"])]
        constraints = [
            models.CheckConstraint(condition=models.Q(rating__gte=1, rating__lte=5), name="review_rating_1_5"),
        ]

    def __str__(self):
        return f"{self.rating}★ by {self.customer_id} for {self.provider_id}"

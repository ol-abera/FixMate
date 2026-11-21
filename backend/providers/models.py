from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.validators import validate_image_file


class VerificationStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"


class Availability(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available now"
    BUSY = "BUSY", "Busy"
    OFFLINE = "OFFLINE", "Offline"


class ProviderProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_profile")
    profession = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    years_of_experience = models.PositiveSmallIntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    starting_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Minimum job price.")
    rating = models.DecimalField(
        max_digits=3, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )
    total_reviews = models.PositiveIntegerField(default=0)
    verification_status = models.CharField(
        max_length=10, choices=VerificationStatus.choices, default=VerificationStatus.PENDING, db_index=True
    )
    availability = models.CharField(max_length=10, choices=Availability.choices, default=Availability.AVAILABLE)
    instant_book = models.BooleanField(default=False)
    response_time_mins = models.PositiveIntegerField(default=30)
    skills = models.CharField(max_length=500, blank=True, help_text="Comma-separated.")
    categories = models.ManyToManyField("services.ServiceCategory", related_name="providers", blank=True)
    cover_image = models.ImageField(upload_to="covers/", blank=True, null=True, validators=[validate_image_file])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-rating", "-total_reviews", "id"]
        indexes = [
            models.Index(fields=["verification_status", "-rating"]),
            models.Index(fields=["hourly_rate"]),
        ]

    @property
    def skills_list(self):
        return [s.strip() for s in self.skills.split(",") if s.strip()]

    @property
    def is_verified(self):
        return self.verification_status == VerificationStatus.VERIFIED

    def __str__(self):
        return f"{self.user.full_name} ({self.profession})"


class PortfolioImage(models.Model):
    provider = models.ForeignKey(ProviderProfile, on_delete=models.CASCADE, related_name="portfolio_images")
    image = models.ImageField(upload_to="portfolio/", validators=[validate_image_file])
    caption = models.CharField(max_length=140, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

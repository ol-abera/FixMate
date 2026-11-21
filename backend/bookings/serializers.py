from datetime import datetime

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from payments.serializers import BookingPaymentSerializer
from payments.services import can_pay
from providers.models import ProviderProfile
from services.models import Service, ServiceCategory

from .models import Booking, BookingEvent, BookingPhoto
from .scheduling import SLOT_RE, customer_duplicate, provider_conflict
from .workflow import actor_role


class BookingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingEvent
        fields = ["status", "label", "created_at"]


class BookingPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingPhoto
        fields = ["id", "image", "created_at"]
        read_only_fields = ["id", "created_at"]


class BookingSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source="provider.user.full_name", read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    category_slug = serializers.SlugRelatedField(source="category", slug_field="slug", read_only=True)
    events = BookingEventSerializer(many=True, read_only=True)
    photos = BookingPhotoSerializer(many=True, read_only=True)
    has_review = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    can_pay = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "customer", "customer_name", "provider", "provider_name", "service", "category_slug",
            "title", "description", "scheduled_date", "scheduled_time", "time_slot", "location",
            "contact_name", "contact_phone", "contact_email", "notes", "estimated_price", "final_price",
            "status", "events", "photos", "has_review", "can_review", "review", "payment", "can_pay",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_has_review(self, obj):
        return hasattr(obj, "review")

    def get_review(self, obj):
        r = getattr(obj, "review", None)
        return {"id": r.id, "rating": r.rating, "comment": r.comment} if r else None

    def get_payment(self, obj):
        p = getattr(obj, "payment", None)
        return BookingPaymentSerializer(p).data if p else None

    def get_can_pay(self, obj):
        req = self.context.get("request")
        return bool(req and can_pay(obj, req.user))

    def get_can_review(self, obj):
        req = self.context.get("request")
        return bool(
            req and obj.status == "COMPLETED" and obj.customer_id == req.user.id and not hasattr(obj, "review")
        )


class BookingCreateSerializer(serializers.Serializer):
    """Input for creating a booking. customer/status/prices are never accepted from the client."""

    provider = serializers.PrimaryKeyRelatedField(queryset=ProviderProfile.objects.all())
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), required=False, allow_null=True)
    category = serializers.SlugRelatedField(slug_field="slug", queryset=ServiceCategory.objects.all(), required=False, allow_null=True)
    title = serializers.CharField(max_length=140)
    description = serializers.CharField()
    scheduled_date = serializers.DateField()
    time_slot = serializers.CharField(max_length=20)
    location = serializers.CharField(max_length=255)
    contact_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    contact_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate_provider(self, p):
        if p.verification_status != "VERIFIED":
            raise serializers.ValidationError("This provider is not available for booking.")
        return p

    def validate_scheduled_date(self, d):
        if d < timezone.localdate():
            raise serializers.ValidationError("Date cannot be in the past.")
        return d

    def validate_time_slot(self, v):
        m = SLOT_RE.match(v.strip())
        if not m:
            raise serializers.ValidationError("Use format 'HH:MM - HH:MM'.")
        h1, m1, h2, m2 = map(int, m.groups())
        if not (0 <= h1 < 24 and 0 <= h2 < 24 and m1 < 60 and m2 < 60) or (h2, m2) <= (h1, m1):
            raise serializers.ValidationError("Invalid time slot.")
        return v.strip()

    def validate(self, attrs):
        service = attrs.get("service")
        if service is not None:
            if service.provider_id != attrs["provider"].id or not service.is_active:
                raise serializers.ValidationError({"service": "Service does not belong to this provider."})
            attrs.setdefault("category", service.category)
        if attrs["provider"].user_id == self.context["request"].user.id:
            raise serializers.ValidationError("You cannot book yourself.")
        return attrs

    @transaction.atomic
    def create(self, data):
        # Lock the provider row so two concurrent requests can't both pass the overlap checks.
        provider = ProviderProfile.objects.select_for_update().get(pk=data["provider"].pk)
        date, slot = data["scheduled_date"], data["time_slot"]
        if customer_duplicate(self.context["request"].user, provider, date, slot):
            raise serializers.ValidationError({"time_slot": "You already have a booking with this pro at that time."})
        if provider_conflict(provider, date, slot):
            raise serializers.ValidationError({"time_slot": "This pro is already booked for that time. Please pick another slot."})
        service = data.get("service")
        h, m = map(int, SLOT_RE.match(data["time_slot"]).groups()[:2])
        # Estimate is computed server-side (never trusted from the client).
        estimate = service.starting_price if service else max(provider.hourly_rate * 2, provider.starting_price)
        return Booking.objects.create(
            customer=self.context["request"].user,
            provider=provider, service=service, category=data.get("category"),
            title=data["title"], description=data["description"],
            scheduled_date=data["scheduled_date"],
            scheduled_time=datetime.strptime(f"{h:02d}:{m:02d}", "%H:%M").time(),
            time_slot=data["time_slot"], location=data["location"],
            contact_name=data.get("contact_name", ""), contact_phone=data.get("contact_phone", ""),
            contact_email=data.get("contact_email", ""), notes=data.get("notes", ""), estimated_price=estimate,
        )

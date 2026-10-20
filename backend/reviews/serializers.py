from rest_framework import serializers

from bookings.models import Booking
from common.utils import abs_url

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="customer.full_name", read_only=True)
    avatar = serializers.SerializerMethodField()
    provider_name = serializers.CharField(source="provider.user.full_name", read_only=True)
    booking = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all())

    class Meta:
        model = Review
        fields = ["id", "booking", "provider", "provider_name", "author", "avatar", "rating", "comment", "created_at", "updated_at"]
        read_only_fields = ["id", "provider", "provider_name", "author", "avatar", "created_at", "updated_at"]

    def get_avatar(self, obj):
        return abs_url(self.context.get("request"), obj.customer.profile_image)

    def validate_rating(self, v):
        if not 1 <= v <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return v

    def validate_booking(self, booking):
        # Only on create: booking is immutable afterwards (see view)
        user = self.context["request"].user
        if booking.customer_id != user.id:
            raise serializers.ValidationError("You can only review your own bookings.")
        if booking.status != "COMPLETED":
            raise serializers.ValidationError("You can only review a completed booking.")
        if Review.objects.filter(booking=booking).exists():
            raise serializers.ValidationError("This booking has already been reviewed.")
        return booking

    def create(self, data):
        booking = data["booking"]
        return Review.objects.create(
            customer=self.context["request"].user, provider=booking.provider,
            booking=booking, rating=data["rating"], comment=data.get("comment", ""),
        )


class ReviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["rating", "comment"]

    def validate_rating(self, v):
        if not 1 <= v <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return v

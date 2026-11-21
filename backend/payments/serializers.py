from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    booking_title = serializers.CharField(source="booking.title", read_only=True)
    provider_name = serializers.CharField(source="booking.provider.user.full_name", read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "booking", "booking_title", "provider_name", "amount", "currency", "gateway",
                  "status", "failure_reason", "paid_at", "created_at"]
        read_only_fields = fields


class BookingPaymentSerializer(serializers.ModelSerializer):
    """Compact payment summary embedded in booking responses."""

    class Meta:
        model = Payment
        fields = ["status", "amount", "currency", "gateway", "paid_at"]
        read_only_fields = fields

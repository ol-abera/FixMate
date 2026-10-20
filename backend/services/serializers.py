from rest_framework import serializers

from .models import Service, ServiceCategory


class CategorySerializer(serializers.ModelSerializer):
    provider_count = serializers.IntegerField(read_only=True, default=0)
    avg_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, default=0)

    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "icon", "description", "provider_count", "avg_price"]


class ServiceSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field="slug", queryset=ServiceCategory.objects.filter(is_active=True)
    )
    category_name = serializers.CharField(source="category.name", read_only=True)
    provider = serializers.PrimaryKeyRelatedField(read_only=True)
    provider_name = serializers.CharField(source="provider.user.full_name", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id", "provider", "provider_name", "category", "category_name", "title",
            "description", "starting_price", "duration_minutes", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "provider", "created_at", "updated_at"]

    def validate_starting_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value

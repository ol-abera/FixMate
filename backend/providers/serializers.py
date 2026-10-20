from django.db.models import Count, Q
from rest_framework import serializers

from common.utils import abs_url
from services.models import ServiceCategory
from services.serializers import ServiceSerializer

from .models import Availability, PortfolioImage, ProviderProfile


class SkillsField(serializers.Field):
    """Stored as comma-separated text; exposed as a JSON list."""

    def to_representation(self, value):
        return [s.strip() for s in (value or "").split(",") if s.strip()]

    def to_internal_value(self, data):
        if isinstance(data, str):
            data = data.split(",")
        if not isinstance(data, list):
            raise serializers.ValidationError("Provide a list of skills.")
        cleaned = [str(s).strip() for s in data if str(s).strip()]
        if len(cleaned) > 20:
            raise serializers.ValidationError("At most 20 skills.")
        return ",".join(cleaned)


class ProviderListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(source="user.full_name", read_only=True)
    title = serializers.CharField(source="profession", read_only=True)
    avatar = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()
    categories = serializers.SlugRelatedField(many=True, read_only=True, slug_field="slug")
    city = serializers.CharField(source="location", read_only=True)
    bio = serializers.CharField(source="description", read_only=True)
    skills = SkillsField(read_only=True)
    verified = serializers.BooleanField(source="is_verified", read_only=True)
    available_now = serializers.SerializerMethodField()
    jobs_completed = serializers.SerializerMethodField()

    class Meta:
        model = ProviderProfile
        fields = [
            "id", "user_id", "name", "title", "avatar", "cover", "categories", "city", "bio", "skills",
            "rating", "total_reviews", "hourly_rate", "starting_price", "verification_status", "verified",
            "instant_book", "available_now", "availability", "years_of_experience", "jobs_completed",
            "response_time_mins",
        ]

    def get_avatar(self, obj):
        return abs_url(self.context.get("request"), obj.user.profile_image)

    def get_cover(self, obj):
        return abs_url(self.context.get("request"), obj.cover_image)

    def get_available_now(self, obj):
        return obj.availability == Availability.AVAILABLE

    def get_jobs_completed(self, obj):
        annotated = getattr(obj, "jobs_completed_count", None)
        if annotated is not None:
            return annotated
        return obj.bookings.filter(status="COMPLETED").count()


class ProviderReviewSerializer(serializers.Serializer):
    """Lightweight review shape embedded in provider detail (avoids a circular import)."""

    id = serializers.IntegerField()
    author = serializers.CharField(source="customer.full_name")
    avatar = serializers.SerializerMethodField()
    rating = serializers.IntegerField()
    comment = serializers.CharField()
    created_at = serializers.DateTimeField()

    def get_avatar(self, obj):
        return abs_url(self.context.get("request"), obj.customer.profile_image)


class ProviderDetailSerializer(ProviderListSerializer):
    gallery = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()

    class Meta(ProviderListSerializer.Meta):
        fields = ProviderListSerializer.Meta.fields + ["gallery", "services", "reviews", "created_at"]

    def get_gallery(self, obj):
        req = self.context.get("request")
        return [abs_url(req, i.image) for i in obj.portfolio_images.all()]

    def get_services(self, obj):
        qs = obj.services.filter(is_active=True).select_related("category", "provider__user")
        return ServiceSerializer(qs, many=True, context=self.context).data

    def get_reviews(self, obj):
        qs = obj.reviews.filter(is_published=True).select_related("customer")[:10]
        return ProviderReviewSerializer(qs, many=True, context=self.context).data


class ProviderWriteSerializer(serializers.ModelSerializer):
    """Fields a provider may edit on their own profile. verification_status/rating are read-only."""

    skills = SkillsField(required=False)
    categories = serializers.SlugRelatedField(
        many=True, slug_field="slug", required=False,
        queryset=ServiceCategory.objects.filter(is_active=True),
    )

    class Meta:
        model = ProviderProfile
        fields = [
            "profession", "description", "location", "years_of_experience", "hourly_rate",
            "starting_price", "availability", "instant_book", "response_time_mins", "skills",
            "categories", "cover_image",
        ]

    def validate_hourly_rate(self, v):
        if v < 0:
            raise serializers.ValidationError("Must be >= 0.")
        return v


class PortfolioImageSerializer(serializers.ModelSerializer):
    image = serializers.ImageField()

    class Meta:
        model = PortfolioImage
        fields = ["id", "image", "caption", "created_at"]
        read_only_fields = ["id", "created_at"]

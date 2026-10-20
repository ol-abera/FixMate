from django.contrib.auth import password_validation
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from services.models import ServiceCategory

from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    """Private representation (own profile / admin)."""

    full_name = serializers.CharField(read_only=True)
    provider_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "phone", "role",
            "profile_image", "location", "bio", "is_verified", "provider_id",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "email", "role", "is_verified", "created_at", "updated_at"]

    def get_provider_id(self, obj):
        profile = getattr(obj, "provider_profile", None)
        return profile.id if profile else None


class PublicUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "profile_image"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[Role.CUSTOMER, Role.PROVIDER], default=Role.CUSTOMER)
    location = serializers.CharField(max_length=120, required=False, allow_blank=True)
    # Optional provider fields, used when role == PROVIDER
    profession = serializers.CharField(max_length=120, required=False, allow_blank=True)
    category = serializers.SlugRelatedField(
        slug_field="slug", required=False, allow_null=True,
        queryset=ServiceCategory.objects.filter(is_active=True),
    )
    hourly_rate = serializers.DecimalField(max_digits=8, decimal_places=2, required=False, min_value=0)
    years_of_experience = serializers.IntegerField(required=False, min_value=0, max_value=70)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        candidate = User(email=attrs["email"], first_name=attrs["first_name"], last_name=attrs.get("last_name", ""))
        password_validation.validate_password(attrs["password"], candidate)
        if attrs["role"] == Role.PROVIDER and not attrs.get("profession"):
            raise serializers.ValidationError({"profession": "Providers must supply a profession/title."})
        return attrs

    @transaction.atomic
    def create(self, data):
        from providers.models import ProviderProfile

        role = data["role"]
        user = User.objects.create_user(
            email=data["email"], password=data["password"], role=role,
            first_name=data["first_name"], last_name=data.get("last_name", ""),
            phone=data.get("phone", ""), location=data.get("location", ""),
        )
        if role == Role.PROVIDER:
            rate = data.get("hourly_rate") or 0
            profile = ProviderProfile.objects.create(
                user=user,
                profession=data["profession"],
                description=data.get("description", ""),
                location=data.get("location", ""),
                years_of_experience=data.get("years_of_experience", 0),
                hourly_rate=rate,
                starting_price=rate,
            )
            if data.get("category"):
                profile.categories.add(data["category"])
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with email+password; response also carries the user."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user, context=self.context).data
        return data


def tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}

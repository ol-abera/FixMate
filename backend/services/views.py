from django.db.models import Avg, Count, Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission, IsAuthenticated

from .models import Service, ServiceCategory
from .serializers import CategorySerializer, ServiceSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        verified = Q(providers__verification_status="VERIFIED")
        return ServiceCategory.objects.filter(is_active=True).annotate(
            provider_count=Count("providers", filter=verified, distinct=True),
            avg_price=Avg("providers__hourly_rate", filter=verified),
        )


class ServicePermission(BasePermission):
    """Public read; only PROVIDERs create; only the owning provider (or an admin) modifies."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if view.action == "create":
            return u.role == "PROVIDER"
        return u.role in ("PROVIDER", "ADMIN")

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return u.role == "ADMIN" or obj.provider.user_id == u.id


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [ServicePermission]
    filter_backends = [OrderingFilter]
    ordering_fields = ["starting_price", "created_at", "title"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Service.objects.select_related("provider__user", "category")
        u = self.request.user
        if u.is_authenticated and u.role == "ADMIN":
            pass
        else:
            visible = Q(is_active=True, provider__verification_status="VERIFIED")
            if u.is_authenticated and u.role == "PROVIDER":
                visible |= Q(provider__user=u)
            qs = qs.filter(visible)

        if self.action != "list":
            return qs
        p = self.request.query_params
        if p.get("search"):
            qs = qs.filter(Q(title__icontains=p["search"]) | Q(description__icontains=p["search"]))
        if p.get("category"):
            qs = qs.filter(category__slug=p["category"])
        if p.get("provider"):
            qs = qs.filter(provider_id=p["provider"]) if p["provider"].isdigit() else qs.none()
        if p.get("mine") in ("1", "true") and u.is_authenticated:
            qs = qs.filter(provider__user=u)
        try:
            if p.get("min_price"):
                qs = qs.filter(starting_price__gte=p["min_price"])
            if p.get("max_price"):
                qs = qs.filter(starting_price__lte=p["max_price"])
        except Exception:
            raise ValidationError({"price": "min_price/max_price must be numbers."})
        return qs

    def perform_create(self, serializer):
        profile = getattr(self.request.user, "provider_profile", None)
        if profile is None:
            raise ValidationError({"detail": "Create your provider profile before adding services."})
        if profile.verification_status == "REJECTED":
            raise PermissionDenied("Your provider profile was rejected.")
        serializer.save(provider=profile)

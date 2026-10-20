from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from common.permissions import IsAdminRole, IsProvider

from .filters import apply_status_scope, filter_providers
from .models import PortfolioImage, ProviderProfile, VerificationStatus
from .serializers import (
    PortfolioImageSerializer, ProviderDetailSerializer, ProviderListSerializer, ProviderWriteSerializer,
)
from .services import set_verification


class ProviderViewSet(viewsets.GenericViewSet):
    """
    list      GET  /api/providers/            public, verified only, searchable/filterable/paginated
    retrieve  GET  /api/providers/{id}/       verified, or the owner / an admin
    create    POST /api/providers/            a PROVIDER user creates their own profile
    me        GET/PATCH /api/providers/me/
    verify / reject   POST /api/providers/{id}/verify|reject/   (ADMIN)
    """

    queryset = ProviderProfile.objects.all()
    lookup_value_regex = r"\d+"
    filter_backends = [OrderingFilter]
    ordering_fields = ["rating", "hourly_rate", "starting_price", "total_reviews", "years_of_experience", "created_at"]
    ordering = ["-rating", "-total_reviews", "id"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "reviews"):
            return [AllowAny()]
        if self.action in ("verify", "reject"):
            return [IsAdminRole()]
        if self.action in ("create", "me", "portfolio", "portfolio_delete", "partial_update"):
            return [IsProvider()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProviderDetailSerializer
        if self.action in ("create", "me"):
            return ProviderWriteSerializer
        return ProviderListSerializer

    def _base_qs(self):
        return (
            ProviderProfile.objects.select_related("user")
            .prefetch_related("categories")
            .annotate(jobs_completed_count=Count("bookings", filter=Q(bookings__status="COMPLETED"), distinct=True))
        )

    # ---- public marketplace ----
    def list(self, request):
        qs = apply_status_scope(self._base_qs(), request.user, request.query_params)
        qs = filter_providers(qs, request.query_params)
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        ser = ProviderListSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(ser.data)

    def retrieve(self, request, pk=None):
        profile = self.get_object_or_404(pk)
        u = request.user
        allowed = (
            profile.is_verified
            or (u.is_authenticated and (u.role == "ADMIN" or profile.user_id == u.id))
        )
        if not allowed:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProviderDetailSerializer(profile, context={"request": request}).data)

    def get_object_or_404(self, pk):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(self._base_qs(), pk=pk)

    # ---- provider self-service ----
    def create(self, request):
        if hasattr(request.user, "provider_profile"):
            raise ValidationError({"detail": "You already have a provider profile. Use PATCH /api/providers/me/."})
        ser = ProviderWriteSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        profile = ser.save(user=request.user)  # user comes from the token, never from the payload
        return Response(
            ProviderDetailSerializer(self.get_object_or_404(profile.pk), context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        profile = self.get_object_or_404(pk)
        if profile.user_id != request.user.id:
            return Response({"detail": "You can only edit your own profile."}, status=status.HTTP_403_FORBIDDEN)
        ser = ProviderWriteSerializer(profile, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ProviderDetailSerializer(self.get_object_or_404(pk), context={"request": request}).data)

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        profile = getattr(request.user, "provider_profile", None)
        if profile is None:
            return Response({"detail": "No provider profile yet."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "PATCH":
            ser = ProviderWriteSerializer(profile, data=request.data, partial=True, context={"request": request})
            ser.is_valid(raise_exception=True)
            ser.save()
        return Response(ProviderDetailSerializer(self.get_object_or_404(profile.pk), context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="me/portfolio")
    def portfolio(self, request):
        profile = getattr(request.user, "provider_profile", None)
        if profile is None:
            raise ValidationError({"detail": "Create your provider profile first."})
        if profile.portfolio_images.count() >= 20:
            raise ValidationError({"detail": "Portfolio is limited to 20 images."})
        ser = PortfolioImageSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save(provider=profile)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["delete"], url_path=r"me/portfolio/(?P<image_id>\d+)")
    def portfolio_delete(self, request, image_id=None):
        profile = getattr(request.user, "provider_profile", None)
        img = PortfolioImage.objects.filter(pk=image_id, provider=profile).first() if profile else None
        if img is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        img.image.delete(save=False)
        img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- admin moderation ----
    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        profile = set_verification(self.get_object_or_404(pk), VerificationStatus.VERIFIED)
        return Response({"id": profile.id, "verification_status": profile.verification_status})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        profile = set_verification(self.get_object_or_404(pk), VerificationStatus.REJECTED)
        return Response({"id": profile.id, "verification_status": profile.verification_status})

    # ---- reviews of a provider ----
    @action(detail=True, methods=["get"])
    def reviews(self, request, pk=None):
        from reviews.serializers import ReviewSerializer
        profile = self.get_object_or_404(pk)
        if not profile.is_verified:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        qs = profile.reviews.filter(is_published=True).select_related("customer", "provider__user")
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(ReviewSerializer(page, many=True, context={"request": request}).data)

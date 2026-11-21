from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.permissions import IsAdminRole, IsCustomer
from notifications.models import NotificationType
from notifications.services import notify

from .models import Review
from .serializers import ModerationReviewSerializer, ReviewSerializer, ReviewUpdateSerializer


class ReviewViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                    mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Public read of published reviews. Only the authoring customer can create/edit/delete."""

    serializer_class = ReviewSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "create":
            return [IsCustomer()]
        if self.action in ("moderation", "hide", "publish"):
            return [IsAdminRole()]
        return super().get_permissions()

    def get_queryset(self):
        qs = Review.objects.select_related("customer", "provider__user")
        u = self.request.user
        if self.action in ("list", "retrieve"):
            qs = qs.filter(is_published=True)
            if self.request.query_params.get("provider"):
                p = self.request.query_params["provider"]
                qs = qs.filter(provider_id=p) if p.isdigit() else qs.none()
            return qs
        if self.action in ("moderation", "hide", "publish"):
            return qs.order_by("-created_at")
        # update/delete: only own reviews
        return qs.filter(customer=u)

    def get_serializer_class(self):
        return ReviewUpdateSerializer if self.action in ("update", "partial_update") else ReviewSerializer

    def create(self, request, *args, **kwargs):
        ser = ReviewSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        review = ser.save()
        notify(review.provider.user, NotificationType.BOOKING_STATUS, "New review",
               f"{request.user.full_name} rated you {review.rating}★.", booking_id=review.booking_id)
        return Response(ReviewSerializer(review, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        review = self.get_object()
        ser = ReviewUpdateSerializer(review, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()  # post_save signal recalculates the provider rating
        return Response(ReviewSerializer(review, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def moderation(self, request):
        """ADMIN: every review incl. hidden. ?state=hidden|published, ?max_rating=2 for low ratings."""
        qs = self.get_queryset()
        state = request.query_params.get("state")
        if state in ("hidden", "published"):
            qs = qs.filter(is_published=state == "published")
        max_rating = request.query_params.get("max_rating", "")
        if max_rating.isdigit():
            qs = qs.filter(rating__lte=int(max_rating))
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(ModerationReviewSerializer(page, many=True, context={"request": request}).data)

    def _set_published(self, request, value):
        review = self.get_object()
        if review.is_published != value:
            review.is_published = value
            review.save(update_fields=["is_published", "updated_at"])  # signal recalculates the rating
        return Response(ModerationReviewSerializer(review, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def hide(self, request, pk=None):
        return self._set_published(request, False)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        return self._set_published(request, True)

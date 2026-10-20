from rest_framework import mixins, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.permissions import IsCustomer
from notifications.models import NotificationType
from notifications.services import notify

from .models import Review
from .serializers import ReviewSerializer, ReviewUpdateSerializer


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
        # update/delete: only own reviews (admins use the Django admin for moderation)
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

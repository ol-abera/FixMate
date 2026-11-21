from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.permissions import IsCustomer
from notifications.models import NotificationType
from notifications.services import notify

from .models import MAX_BOOKING_PHOTOS, Booking, BookingPhoto, BookingStatus as S
from .scheduling import COMMITTED
from .serializers import BookingCreateSerializer, BookingPhotoSerializer, BookingSerializer
from .workflow import transition


class BookingViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Customers see bookings they created; providers see bookings assigned to them; admins see all.
    Status can only change through the POST action endpoints (accept/decline/start/complete/cancel).
    """

    serializer_class = BookingSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsCustomer()]
        if self.action == "busy":
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        u = self.request.user
        qs = Booking.objects.select_related("customer", "provider__user", "category", "service", "payment").prefetch_related("events", "photos")
        if u.role == "ADMIN":
            pass
        elif u.role == "PROVIDER":
            qs = qs.filter(provider__user=u)
        else:
            qs = qs.filter(customer=u)
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status__in=[s.strip().upper() for s in st.split(",")])
        return qs

    def create(self, request, *args, **kwargs):
        ser = BookingCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        booking = ser.save()
        from bookings.models import BookingEvent

        BookingEvent.objects.create(booking=booking, status=booking.status, label="Request sent", actor=request.user)
        notify(booking.provider.user, NotificationType.NEW_BOOKING, "New booking request",
               f"{request.user.full_name} requested {booking.title} on {booking.scheduled_date}.", booking_id=booking.id)
        return Response(BookingSerializer(booking, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def _do(self, request, name):
        booking = self.get_object()  # scoped queryset => other users' bookings 404
        final_price = request.data.get("final_price") if name == "complete" else None
        transition(booking, request.user, name, final_price=final_price)
        booking.refresh_from_db()
        return Response(BookingSerializer(booking, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        return self._do(request, "accept")

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        return self._do(request, "decline")

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._do(request, "start")

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._do(request, "complete")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._do(request, "cancel")

    @action(detail=False, methods=["get"])
    def busy(self, request):
        """Slots a provider already committed to over the next 30 days. Exposes no customer details."""
        provider = request.query_params.get("provider")
        if not provider or not provider.isdigit():
            raise ValidationError({"provider": "Pass ?provider=<id>."})
        today = timezone.localdate()
        rows = (Booking.objects.filter(provider_id=provider, provider__verification_status="VERIFIED", status__in=COMMITTED,
                                       scheduled_date__range=(today, today + timedelta(days=30)))
                .order_by("scheduled_date", "scheduled_time").values("scheduled_date", "time_slot"))
        return Response([{"date": r["scheduled_date"], "time_slot": r["time_slot"]} for r in rows])

    @action(detail=True, methods=["post"], url_path="photos", parser_classes=[MultiPartParser, FormParser])
    def add_photo(self, request, pk=None):
        booking = self.get_object()
        if booking.customer_id != request.user.id:
            raise PermissionDenied("Only the customer can add photos to a booking.")
        if booking.status not in (S.PENDING, S.ACCEPTED, S.IN_PROGRESS):
            raise ValidationError({"detail": "Photos can only be added to open bookings."})
        if booking.photos.count() >= MAX_BOOKING_PHOTOS:
            raise ValidationError({"image": f"A booking can have at most {MAX_BOOKING_PHOTOS} photos."})
        ser = BookingPhotoSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save(booking=booking)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>\d+)")
    def remove_photo(self, request, pk=None, photo_id=None):
        booking = self.get_object()
        if booking.customer_id != request.user.id:
            raise PermissionDenied("Only the customer can remove booking photos.")
        photo = get_object_or_404(BookingPhoto, pk=photo_id, booking=booking)
        photo.image.delete(save=False)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

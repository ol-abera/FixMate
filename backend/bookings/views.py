from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsCustomer
from notifications.models import NotificationType
from notifications.services import notify

from .models import Booking
from .serializers import BookingCreateSerializer, BookingSerializer
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
        return super().get_permissions()

    def get_queryset(self):
        u = self.request.user
        qs = Booking.objects.select_related("customer", "provider__user", "category", "service").prefetch_related("events")
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

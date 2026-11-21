"""Booking state machine. All status changes go through `transition()`."""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from notifications.models import NotificationType
from notifications.services import notify

from .models import Booking, BookingEvent, BookingStatus as S
from .scheduling import provider_conflict

# action -> (target status, allowed from-statuses, allowed actor roles)
ACTIONS = {
    "accept": (S.ACCEPTED, {S.PENDING}, {"provider"}),
    "decline": (S.DECLINED, {S.PENDING}, {"provider"}),
    "start": (S.IN_PROGRESS, {S.ACCEPTED}, {"provider"}),
    "complete": (S.COMPLETED, {S.IN_PROGRESS}, {"provider", "customer"}),
    "cancel": (S.CANCELLED, {S.PENDING, S.ACCEPTED}, {"provider", "customer"}),
}


def actor_role(user, booking):
    if booking.customer_id == user.id:
        return "customer"
    if booking.provider.user_id == user.id:
        return "provider"
    return None


@transaction.atomic
def transition(booking, user, action, final_price=None):
    if action not in ACTIONS:
        raise ValidationError({"detail": f"Unknown action '{action}'."})
    target, allowed_from, roles = ACTIONS[action]
    role = actor_role(user, booking)
    if role is None:
        raise PermissionDenied("This booking is not yours.")
    if role not in roles:
        raise PermissionDenied(f"A {role} cannot {action} a booking.")
    if booking.status not in allowed_from:
        raise ValidationError({"detail": f"Cannot {action} a booking that is {booking.status}."})
    if action == "accept":
        from providers.models import ProviderProfile

        ProviderProfile.objects.select_for_update().get(pk=booking.provider_id)
        clash = provider_conflict(booking.provider_id, booking.scheduled_date, booking.time_slot, exclude_id=booking.id)
        if clash:
            raise ValidationError({"detail": f"You already have a job booked at that time (booking #{clash.id})."})

    if final_price is not None:
        if role != "provider" or action != "complete":
            raise ValidationError({"final_price": "Only the provider can set a final price when completing."})
        try:
            price = Decimal(str(final_price))
        except InvalidOperation:
            raise ValidationError({"final_price": "Must be a number."})
        if not price.is_finite() or price < 0:
            raise ValidationError({"final_price": "Must be a non-negative number."})
        booking.final_price = price
    if action == "complete" and booking.final_price is None:
        booking.final_price = booking.estimated_price

    booking.status = target
    booking.save()
    labels = {
        "accept": "Accepted by provider", "decline": "Declined by provider", "start": "Job in progress",
        "complete": "Completed", "cancel": f"Cancelled by {role}",
    }
    BookingEvent.objects.create(booking=booking, status=target, label=labels[action], actor=user)
    _notify(booking, action, role)
    return booking


def _notify(booking, action, role):
    pname = booking.provider.user.full_name
    cname = booking.customer.full_name
    data = {"booking_id": booking.id}
    if action == "accept":
        notify(booking.customer, NotificationType.BOOKING_ACCEPTED, f"{pname} accepted your request",
               f"{booking.title} is confirmed for {booking.scheduled_date} ({booking.time_slot}).", **data)
    elif action == "decline":
        notify(booking.customer, NotificationType.BOOKING_DECLINED, f"{pname} declined your request",
               f"{booking.title} could not be scheduled. Try another pro.", **data)
    elif action == "cancel":
        other = booking.provider.user if role == "customer" else booking.customer
        notify(other, NotificationType.BOOKING_STATUS, "Booking cancelled",
               f"{booking.title} was cancelled.", **data)
    else:
        label = "started" if action == "start" else "completed"
        for other in {booking.customer, booking.provider.user}:
            notify(other, NotificationType.BOOKING_STATUS, f"Job {label}", f"{booking.title} was marked {label}.", **data)
        if action == "complete":
            notify(booking.customer, NotificationType.REVIEW_REMINDER, f"How was {pname}?",
                   "Leave a review to help others choose.", **data)
            booking.review_reminder_sent = True
            booking.save(update_fields=["review_reminder_sent"])

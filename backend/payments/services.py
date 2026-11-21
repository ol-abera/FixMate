"""Checkout for completed bookings. Uses Stripe Checkout when STRIPE_SECRET_KEY is set,
otherwise a local mock gateway (only when PAYMENTS_MOCK is on, the default with DEBUG)."""
import secrets
from decimal import Decimal

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from bookings.models import BookingStatus
from notifications.models import NotificationType
from notifications.services import notify

from .models import Gateway, Payment, PaymentStatus as P


class PaymentsUnavailable(APIException):
    status_code = 503
    default_detail = "Online payments are not configured."


class GatewayError(APIException):
    status_code = 502
    default_detail = "The payment provider could not be reached. Please try again."


def active_gateway():
    if settings.STRIPE_SECRET_KEY:
        return Gateway.STRIPE
    if settings.PAYMENTS_MOCK:
        return Gateway.MOCK
    return None


def amount_due(booking):
    return booking.final_price if booking.final_price is not None else booking.estimated_price


def can_pay(booking, user):
    paid = getattr(booking, "payment", None)
    return bool(
        active_gateway() and booking.customer_id == user.id and booking.status == BookingStatus.COMPLETED
        and amount_due(booking) > 0 and not (paid and paid.status == P.PAID)
    )


@transaction.atomic
def start_checkout(booking, user):
    from bookings.models import Booking

    booking = Booking.objects.select_for_update().select_related("provider__user").get(pk=booking.pk)
    if booking.customer_id != user.id:
        raise PermissionDenied("Only the customer can pay for this booking.")
    if booking.status != BookingStatus.COMPLETED:
        raise ValidationError({"detail": "You can pay once the job is completed."})
    amount = amount_due(booking)
    if amount <= 0:
        raise ValidationError({"detail": "Nothing is due for this booking."})
    existing = Payment.objects.filter(booking=booking).first()
    if existing and existing.status == P.PAID:
        raise ValidationError({"detail": "This booking is already paid."})
    gateway = active_gateway()
    if gateway is None:
        raise PaymentsUnavailable()

    currency = settings.PAYMENTS_CURRENCY
    if gateway == Gateway.STRIPE:
        session_id, url = _stripe_session(booking, user, amount, currency)
    else:
        session_id = f"mock_{secrets.token_urlsafe(18)}"
        url = f"{settings.FRONTEND_URL}/checkout/mock?session_id={session_id}"

    fields = dict(customer=user, amount=amount, currency=currency, gateway=gateway, session_id=session_id,
                  payment_intent="", status=P.PENDING, failure_reason="")
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        existing.save()
        payment = existing
    else:
        payment = Payment.objects.create(booking=booking, **fields)
    return payment, url


def _stripe_session(booking, user, amount, currency):
    cents = int((Decimal(amount) * 100).quantize(Decimal("1")))
    try:
        session = stripe.checkout.Session.create(
            api_key=settings.STRIPE_SECRET_KEY,
            mode="payment",
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": currency, "unit_amount": cents,
                    "product_data": {"name": f"{booking.title} with {booking.provider.user.full_name}"},
                },
            }],
            customer_email=user.email,
            client_reference_id=str(booking.id),
            metadata={"booking_id": str(booking.id)},
            success_url=f"{settings.FRONTEND_URL}/checkout/return?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/customer-dashboard?payment=cancelled#booking-{booking.id}",
        )
    except stripe.StripeError as e:
        raise GatewayError() from e
    return session.id, session.url


@transaction.atomic
def mark_paid(session_id, payment_intent=""):
    """Idempotent: webhooks may be delivered more than once and race the return-page sync."""
    payment = Payment.objects.select_for_update().select_related("booking__provider__user").filter(session_id=session_id).first()
    if payment is None or payment.status == P.PAID:
        return payment
    payment.status = P.PAID
    payment.paid_at = timezone.now()
    payment.payment_intent = payment_intent or payment.payment_intent
    payment.failure_reason = ""
    payment.save()
    b = payment.booking
    notify(b.provider.user, NotificationType.PAYMENT_RECEIVED, f"Payment received for {b.title}",
           f"{payment.customer.full_name} paid ${payment.amount}.", booking_id=b.id)
    notify(payment.customer, NotificationType.PAYMENT_RECEIVED, "Payment confirmed",
           f"You paid ${payment.amount} to {b.provider.user.full_name} for {b.title}.", booking_id=b.id)
    return payment


def mark_failed(session_id, reason):
    Payment.objects.filter(session_id=session_id, status=P.PENDING).update(
        status=P.FAILED, failure_reason=reason[:255], updated_at=timezone.now())


def sync_from_stripe(payment):
    """Ask Stripe directly so the return page does not depend on webhook timing."""
    try:
        session = stripe.checkout.Session.retrieve(payment.session_id, api_key=settings.STRIPE_SECRET_KEY)
    except stripe.StripeError as e:
        raise GatewayError() from e
    if session.payment_status == "paid":
        return mark_paid(payment.session_id, session.payment_intent or "")
    if session.status == "expired":
        mark_failed(payment.session_id, "Checkout session expired.")
    payment.refresh_from_db()
    return payment

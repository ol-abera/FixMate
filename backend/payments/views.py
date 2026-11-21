import json
import logging
import re

import stripe
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking

from . import services
from .models import Gateway, Payment, PaymentStatus as P
from .serializers import PaymentSerializer

log = logging.getLogger(__name__)

# Stripe's documented "card declined" test number, honoured by the mock gateway too.
DECLINE_CARD = "4000000000000002"


def _own_payment(request, session_id):
    if not session_id:
        raise ValidationError({"session_id": "This field is required."})
    payment = Payment.objects.select_related("booking__provider__user", "customer").filter(session_id=str(session_id)).first()
    if payment is None or payment.customer_id != request.user.id:
        raise NotFound("Payment session not found.")
    return payment


class PaymentConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"gateway": services.active_gateway(), "currency": settings.PAYMENTS_CURRENCY})


class CheckoutView(APIView):
    """POST {booking} -> {checkout_url, payment}. The frontend redirects the browser to checkout_url."""

    def post(self, request):
        booking_id = request.data.get("booking")
        if not str(booking_id or "").isdigit():
            raise ValidationError({"booking": "A valid booking id is required."})
        booking = get_object_or_404(Booking, pk=booking_id, customer=request.user)
        payment, url = services.start_checkout(booking, request.user)
        return Response({"checkout_url": url, "payment": PaymentSerializer(payment).data}, status=status.HTTP_201_CREATED)


class SessionView(APIView):
    """GET a checkout session the signed-in customer owns (used by the mock checkout and return pages)."""

    def get(self, request, session_id):
        return Response(PaymentSerializer(_own_payment(request, session_id)).data)


class SyncView(APIView):
    """POST {session_id}: reconcile with the gateway after the customer returns from checkout."""

    def post(self, request):
        payment = _own_payment(request, request.data.get("session_id"))
        if payment.gateway == Gateway.STRIPE and payment.status == P.PENDING and settings.STRIPE_SECRET_KEY:
            payment = services.sync_from_stripe(payment)
        return Response(PaymentSerializer(payment).data)


class MockConfirmView(APIView):
    """POST {session_id, card_number}: completes a mock checkout. Disabled unless the mock gateway is active."""

    def post(self, request):
        if services.active_gateway() != Gateway.MOCK:
            raise NotFound()
        payment = _own_payment(request, request.data.get("session_id"))
        if payment.gateway != Gateway.MOCK:
            raise NotFound("Payment session not found.")
        if payment.status == P.PAID:
            return Response(PaymentSerializer(payment).data)
        card = re.sub(r"\D", "", str(request.data.get("card_number", "")))
        if len(card) < 12:
            raise ValidationError({"card_number": "Enter a card number."})
        if card == DECLINE_CARD:
            services.mark_failed(payment.session_id, "Your card was declined.")
            return Response({"detail": "Your card was declined."}, status=status.HTTP_402_PAYMENT_REQUIRED)
        payment = services.mark_paid(payment.session_id, payment_intent=f"mock_pi_{payment.id}")
        return Response(PaymentSerializer(payment).data)


class StripeWebhookView(APIView):
    """Stripe -> FixMate events. The signature is verified against STRIPE_WEBHOOK_SECRET before anything is trusted."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        secret = settings.STRIPE_WEBHOOK_SECRET
        if not secret:
            return Response({"detail": "Webhooks are not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            stripe.Webhook.construct_event(request.body, request.META.get("HTTP_STRIPE_SIGNATURE", ""), secret)
        except (ValueError, stripe.SignatureVerificationError):
            return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)
        event = json.loads(request.body)

        obj = event["data"]["object"]
        kind = event["type"]
        if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            if obj.get("payment_status") == "paid":
                services.mark_paid(obj["id"], obj.get("payment_intent") or "")
        elif kind == "checkout.session.async_payment_failed":
            services.mark_failed(obj["id"], "The payment failed.")
        elif kind == "checkout.session.expired":
            services.mark_failed(obj["id"], "Checkout session expired.")
        else:
            log.debug("Ignoring Stripe event %s", kind)
        return Response({"received": True})

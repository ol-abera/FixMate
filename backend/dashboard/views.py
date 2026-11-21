from collections import OrderedDict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking, BookingEvent
from bookings.serializers import BookingSerializer
from common.admin_site import platform_stats
from common.permissions import IsAdminRole, IsCustomer, IsProvider
from favorites.models import Favorite
from messaging.models import Message
from messaging.serializers import MessageSerializer
from notifications.models import Notification
from notifications.serializers import NotificationSerializer
from providers.models import ProviderProfile
from providers.serializers import ProviderListSerializer
from reviews.models import Review
from reviews.serializers import ReviewSerializer
from services.models import Service
from services.serializers import ServiceSerializer

ACTIVE = ["PENDING", "ACCEPTED", "IN_PROGRESS"]


def _bookings(qs, request, limit=None):
    qs = qs.select_related("customer", "provider__user", "category").prefetch_related("events")
    if limit:
        qs = qs[:limit]
    return BookingSerializer(qs, many=True, context={"request": request}).data


class CustomerDashboardView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        u = request.user
        today = timezone.localdate()
        mine = Booking.objects.filter(customer=u)

        fav_ids = list(Favorite.objects.filter(customer=u).values_list("provider_id", flat=True))
        verified = ProviderProfile.objects.filter(verification_status="VERIFIED").select_related("user").prefetch_related("categories")
        favorites = verified.filter(pk__in=fav_ids)
        recommended_providers = verified.exclude(pk__in=fav_ids).order_by("-rating", "-total_reviews")[:3]
        recommended_services = (
            Service.objects.filter(is_active=True, provider__verification_status="VERIFIED")
            .exclude(provider__pk__in=fav_ids)
            .select_related("provider__user", "category")
            .order_by("-provider__rating", "-created_at")[:5]
        )
        recent_messages = (
            Message.objects.filter(conversation__participants=u).exclude(sender=u)
            .select_related("sender").order_by("-created_at")[:5]
        )
        ctx = {"request": request}
        return Response({
            "stats": {
                "active_bookings": mine.filter(status__in=ACTIVE).count(),
                "upcoming_bookings": mine.filter(status__in=["PENDING", "ACCEPTED"], scheduled_date__gte=today).count(),
                "completed_bookings": mine.filter(status="COMPLETED").count(),
                "favorite_providers": len(fav_ids),
                "unread_notifications": Notification.objects.filter(recipient=u, is_read=False).count(),
            },
            "active_bookings": _bookings(mine.filter(status__in=ACTIVE), request, 10),
            "upcoming_bookings": _bookings(
                mine.filter(status__in=["PENDING", "ACCEPTED"], scheduled_date__gte=today).order_by("scheduled_date", "scheduled_time"),
                request, 5),
            "completed_bookings": _bookings(mine.filter(status="COMPLETED"), request, 5),
            "favorite_providers": ProviderListSerializer(favorites, many=True, context=ctx).data,
            "recent_messages": MessageSerializer(recent_messages, many=True, context=ctx).data,
            "notifications": NotificationSerializer(Notification.objects.filter(recipient=u)[:5], many=True).data,
            "recommended_providers": ProviderListSerializer(recommended_providers, many=True, context=ctx).data,
            "recommended_services": ServiceSerializer(recommended_services, many=True, context=ctx).data,
        })


class ProviderDashboardView(APIView):
    permission_classes = [IsProvider]

    def get(self, request):
        profile = getattr(request.user, "provider_profile", None)
        if profile is None:
            return Response({"detail": "Create your provider profile first."}, status=404)
        today = timezone.localdate()
        mine = Booking.objects.filter(provider=profile)
        completed = mine.filter(status="COMPLETED")

        # Earnings: final_price (falling back to the estimate) of jobs completed in the window.
        since = timezone.now() - timedelta(days=7)
        events = (
            BookingEvent.objects.filter(booking__provider=profile, status="COMPLETED", created_at__gte=since)
            .select_related("booking")
        )
        daily = OrderedDict()
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            daily[d] = Decimal("0")
        for ev in events:
            d = timezone.localtime(ev.created_at).date()
            if d in daily:
                daily[d] += ev.booking.earned_price
        total = sum((b.earned_price for b in completed), Decimal("0"))

        ctx = {"request": request}
        reviews = Review.objects.filter(provider=profile, is_published=True).select_related("customer", "provider__user")[:5]
        return Response({
            "stats": {
                "new_requests": mine.filter(status="PENDING").count(),
                "active_jobs": mine.filter(status__in=["ACCEPTED", "IN_PROGRESS"]).count(),
                "completed_jobs": completed.count(),
                "rating": profile.rating,
                "total_reviews": profile.total_reviews,
            },
            "verification_status": profile.verification_status,
            "new_requests": _bookings(mine.filter(status="PENDING").order_by("scheduled_date"), request, 20),
            "active_jobs": _bookings(mine.filter(status__in=["ACCEPTED", "IN_PROGRESS"]), request, 20),
            "completed_jobs": _bookings(completed, request, 5),
            "earnings": {
                "total": total,
                "last_7_days": sum(daily.values(), Decimal("0")),
                "daily": [{"date": d.isoformat(), "day": d.strftime("%a"), "amount": a} for d, a in daily.items()],
            },
            "recent_bookings": _bookings(mine, request, 5),
            "upcoming_schedule": _bookings(
                mine.filter(status__in=["ACCEPTED", "IN_PROGRESS"], scheduled_date__gte=today).order_by("scheduled_date", "scheduled_time"),
                request, 10),
            "recent_reviews": ReviewSerializer(reviews, many=True, context=ctx).data,
        })


class PublicStatsView(APIView):
    """Marketplace numbers and featured reviews for the public marketing pages."""

    permission_classes = [AllowAny]

    def get(self, request):
        verified = ProviderProfile.objects.filter(verification_status="VERIFIED")
        cities = sorted({c.strip() for c in verified.values_list("location", flat=True) if c and c.strip()})
        published = Review.objects.filter(is_published=True, provider__verification_status="VERIFIED")
        featured = (
            published.filter(rating__gte=4).exclude(comment="")
            .select_related("customer", "provider__user").order_by("-rating", "-created_at")[:3]
        )
        ctx = {"request": request}
        return Response({
            "verified_providers": verified.count(),
            "jobs_completed": Booking.objects.filter(status="COMPLETED").count(),
            "avg_rating": round(published.aggregate(a=Avg("rating"))["a"] or 0, 1),
            "cities": cities,
            "cities_count": len(cities),
            "featured_reviews": [
                {**ReviewSerializer(r, context=ctx).data, "provider_city": r.provider.location} for r in featured
            ],
        })


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        from users.models import User

        today = timezone.localdate()
        start = today - timedelta(days=13)
        days = OrderedDict(((start + timedelta(days=i)).isoformat(), {"bookings": 0, "completed_value": Decimal("0")}) for i in range(14))
        for b in Booking.objects.filter(created_at__date__gte=start).only("created_at"):
            days[timezone.localtime(b.created_at).date().isoformat()]["bookings"] += 1
        done = BookingEvent.objects.filter(status="COMPLETED", created_at__date__gte=start).select_related("booking")
        for e in done:
            d = timezone.localtime(e.created_at).date().isoformat()
            if d in days:
                days[d]["completed_value"] += e.booking.earned_price or 0
        by_status = dict(Booking.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        signups = User.objects.order_by("-created_at")[:6]
        return Response({
            **platform_stats(),
            "bookings_by_status": by_status,
            "daily": [{"day": d, **v} for d, v in days.items()],
            "recent_signups": [
                {"id": u.id, "name": u.full_name, "email": u.email, "role": u.role, "created_at": u.created_at} for u in signups
            ],
        })

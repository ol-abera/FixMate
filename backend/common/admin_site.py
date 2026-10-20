"""Adds platform statistics to the Django admin index page."""
from django.contrib import admin
from django.db.models import Avg, Sum


def platform_stats():
    from bookings.models import Booking
    from providers.models import ProviderProfile
    from reviews.models import Review
    from users.models import User

    completed = Booking.objects.filter(status="COMPLETED")
    return {
        "users": User.objects.count(),
        "customers": User.objects.filter(role="CUSTOMER").count(),
        "providers": ProviderProfile.objects.count(),
        "pending_providers": ProviderProfile.objects.filter(verification_status="PENDING").count(),
        "bookings": Booking.objects.count(),
        "completed_bookings": completed.count(),
        "gmv": completed.aggregate(t=Sum("final_price"))["t"] or 0,
        "reviews": Review.objects.count(),
        "avg_rating": Review.objects.filter(is_published=True).aggregate(a=Avg("rating"))["a"] or 0,
    }


admin.site.site_header = "FixMate Administration"
admin.site.site_title = "FixMate Admin"
admin.site.index_template = "admin/fixmate_index.html"

_original_index = admin.site.index


def _index(request, extra_context=None):
    extra_context = dict(extra_context or {})
    extra_context["platform_stats"] = platform_stats()
    return _original_index(request, extra_context)


admin.site.index = _index

from django.db.models import Exists, OuterRef, Q
from rest_framework.exceptions import ValidationError

from common.geo import distance_km_expr

from services.models import Service

from .models import ProviderProfile, VerificationStatus


def _num(params, key):
    raw = params.get(key)
    if raw in (None, ""):
        return None
    try:
        return float(raw)
    except ValueError:
        raise ValidationError({key: "Must be a number."})


def filter_providers(qs, params):
    """Apply marketplace search/filter query params to a ProviderProfile queryset."""
    search = (params.get("search") or "").strip()
    if search:
        matching_service = Service.objects.filter(
            provider=OuterRef("pk"), is_active=True, title__icontains=search
        )
        qs = qs.filter(
            Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(profession__icontains=search)
            | Q(description__icontains=search)
            | Q(skills__icontains=search)
            | Q(Exists(matching_service))
        )

    category = params.get("category")
    if category:
        by_service = Service.objects.filter(provider=OuterRef("pk"), is_active=True, category__slug=category)
        qs = qs.filter(Q(categories__slug=category) | Q(Exists(by_service)))

    location = (params.get("location") or "").strip()
    if location:
        qs = qs.filter(location__iexact=location.replace("-", " "))

    for key, lookup in (
        ("min_price", "starting_price__gte"), ("max_price", "starting_price__lte"),
        ("min_rate", "hourly_rate__gte"), ("max_rate", "hourly_rate__lte"),
        ("rating", "rating__gte"),
    ):
        val = _num(params, key)
        if val is not None:
            qs = qs.filter(**{lookup: val})

    if params.get("available_now") in ("1", "true", "True"):
        qs = qs.filter(availability="AVAILABLE")
    if params.get("instant_book") in ("1", "true", "True"):
        qs = qs.filter(instant_book=True)

    origin = parse_origin(params)
    if origin:
        qs = qs.annotate(distance_km=distance_km_expr(*origin))
        radius = _num(params, "radius_km")
        if radius is not None:
            if radius <= 0:
                raise ValidationError({"radius_km": "Must be greater than 0."})
            qs = qs.filter(distance_km__lte=radius)
    return qs.distinct()


def parse_origin(params):
    """(lat, lng) from ?lat=&lng=, or None. Both are required together."""
    lat, lng = _num(params, "lat"), _num(params, "lng")
    if lat is None and lng is None:
        return None
    if lat is None or lng is None:
        raise ValidationError({"lat": "Send lat and lng together."})
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValidationError({"lat": "Coordinates are out of range."})
    return lat, lng


def apply_status_scope(qs, user, params):
    """Public marketplace = VERIFIED only. Admins may ask for others explicitly."""
    if user.is_authenticated and user.role == "ADMIN" and params.get("include_unverified") in ("1", "true"):
        status = params.get("status")
        return qs.filter(verification_status=status) if status in VerificationStatus.values else qs
    return qs.filter(verification_status=VerificationStatus.VERIFIED)

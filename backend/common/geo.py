"""Distance search helpers (haversine on plain lat/lng columns, so no PostGIS needed)."""
from django.db.models import Case, F, FloatField, Value, When
from django.db.models.functions import ASin, Cast, Cos, Least, Power, Radians, Sin, Sqrt

EARTH_RADIUS_KM = 6371.0

# Centres of the cities the demo data uses. Providers in a known city get these coordinates until they pin
# an exact location; unknown cities simply have no coordinates (and no distance).
CITY_CENTERS = {
    "austin": (30.2672, -97.7431),
    "round rock": (30.5083, -97.6789),
    "cedar park": (30.5052, -97.8203),
    "pflugerville": (30.4394, -97.6200),
    "georgetown": (30.6333, -97.6770),
}


def city_center(name):
    return CITY_CENTERS.get((name or "").strip().lower())


def distance_km_expr(lat, lng, lat_field="latitude", lng_field="longitude"):
    """Great-circle distance in km from (lat, lng) to each row; NULL when the row has no coordinates."""
    lat1, lng1 = Radians(Value(float(lat))), Radians(Value(float(lng)))
    lat2 = Radians(Cast(F(lat_field), FloatField()))
    lng2 = Radians(Cast(F(lng_field), FloatField()))
    a = Power(Sin((lat2 - lat1) / 2), 2) + Cos(lat1) * Cos(lat2) * Power(Sin((lng2 - lng1) / 2), 2)
    # Least() guards ASIN against floating-point values a hair above 1. Postgres LEAST skips NULLs, so rows
    # without coordinates must be special-cased or they would come out as half the Earth's circumference.
    return Case(
        When(**{f"{lat_field}__isnull": True}, then=Value(None)),
        default=Value(2 * EARTH_RADIUS_KM) * ASin(Least(Sqrt(a), Value(1.0))),
        output_field=FloatField(),
    )

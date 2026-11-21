"""Time-slot overlap checks used to stop double-booking a provider."""
import re

from .models import Booking, BookingStatus as S

SLOT_RE = re.compile(r"^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$")
COMMITTED = (S.ACCEPTED, S.IN_PROGRESS)
OPEN = (S.PENDING, S.ACCEPTED, S.IN_PROGRESS)


def slot_minutes(slot):
    m = SLOT_RE.match((slot or "").strip())
    if not m:
        return None
    h1, m1, h2, m2 = map(int, m.groups())
    return h1 * 60 + m1, h2 * 60 + m2


def overlapping(qs, date, slot, exclude_id=None):
    """First booking in `qs` on `date` whose slot overlaps `slot`, or None."""
    target = slot_minutes(slot)
    if target is None:
        return None
    qs = qs.filter(scheduled_date=date)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    for b in qs.only("id", "time_slot"):
        other = slot_minutes(b.time_slot)
        if other and other[0] < target[1] and target[0] < other[1]:
            return b
    return None


def provider_conflict(provider, date, slot, exclude_id=None):
    return overlapping(Booking.objects.filter(provider=provider, status__in=COMMITTED), date, slot, exclude_id)


def customer_duplicate(customer, provider, date, slot):
    return overlapping(Booking.objects.filter(provider=provider, customer=customer, status__in=OPEN), date, slot)

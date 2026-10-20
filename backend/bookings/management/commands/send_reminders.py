"""Run periodically (cron/Celery beat): upcoming-booking reminders (bookings tomorrow)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.models import Booking
from notifications.models import NotificationType
from notifications.services import notify


class Command(BaseCommand):
    help = "Create 'upcoming booking' notifications for accepted bookings scheduled for tomorrow."

    def handle(self, *args, **opts):
        tomorrow = timezone.localdate() + timedelta(days=1)
        qs = Booking.objects.filter(
            scheduled_date=tomorrow, status__in=["ACCEPTED", "IN_PROGRESS"], upcoming_reminder_sent=False
        ).select_related("customer", "provider__user")
        count = 0
        for b in qs:
            for u in (b.customer, b.provider.user):
                notify(u, NotificationType.UPCOMING_BOOKING, "Upcoming booking tomorrow",
                       f"{b.title} at {b.time_slot}.", booking_id=b.id)
            b.upcoming_reminder_sent = True
            b.save(update_fields=["upcoming_reminder_sent"])
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Sent reminders for {count} booking(s)."))

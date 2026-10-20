"""Shared helpers for tests."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from bookings.models import Booking, BookingEvent
from providers.models import ProviderProfile
from services.models import Service, ServiceCategory
from users.models import User

TEST_PASSWORD = "T3st-only-Passw0rd!"  # test-suite only


def make_user(email="cust@example.com", role="CUSTOMER", first_name="Test", last_name="User", **kw):
    return User.objects.create_user(email=email, password=TEST_PASSWORD, role=role,
                                    first_name=first_name, last_name=last_name, **kw)


def make_category(name="Plumbing"):
    return ServiceCategory.objects.get_or_create(name=name)[0]


def make_provider(email="pro@example.com", verified=True, category=None, **profile_kw):
    user = make_user(email, role="PROVIDER", first_name="Pro", last_name=email.split("@")[0].title())
    defaults = dict(profession="Plumber", location="Austin", hourly_rate=50, starting_price=60,
                    verification_status="VERIFIED" if verified else "PENDING")
    defaults.update(profile_kw)
    profile = ProviderProfile.objects.create(user=user, **defaults)
    if category is not None:
        profile.categories.add(category)
    return user, profile


def make_service(profile, category=None, title="Fix leak", price=100, **kw):
    return Service.objects.create(provider=profile, category=category or make_category(), title=title,
                                  starting_price=price, **kw)


def make_booking(customer, profile, status="PENDING", **kw):
    data = dict(title="Fix sink", description="It leaks", scheduled_date=timezone.localdate() + timedelta(days=2),
                scheduled_time="10:00", time_slot="10:00 - 12:00", location="1 Main St", estimated_price=100)
    data.update(kw)
    b = Booking.objects.create(customer=customer, provider=profile, status=status, **data)
    BookingEvent.objects.create(booking=b, status=status, label=status)
    return b


def client_for(user=None):
    c = APIClient()
    if user is not None:
        c.credentials(HTTP_AUTHORIZATION="Bearer " + str(RefreshToken.for_user(user).access_token))
    return c

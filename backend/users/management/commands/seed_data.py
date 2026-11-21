"""
python manage.py seed_data [--password PW] [--reset]

Creates realistic DEVELOPMENT data mirroring the React frontend's mock dataset.
No password is hard-coded: pass --password or set SEED_PASSWORD, otherwise a random one is
generated and printed once. NEVER run against a production database.
"""
import os
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from bookings.models import Booking, BookingEvent
from favorites.models import Favorite
from messaging.models import Conversation, Message
from notifications.models import Notification, NotificationType
from providers.models import ProviderProfile
from reviews.models import Review
from services.models import Service, ServiceCategory
from users.models import User

CATEGORIES = [
    ("Plumbing", "Wrench", "Leaks, installs, drainage & water systems"),
    ("Electrical", "Lightning", "Wiring, fixtures, panels & smart setups"),
    ("Cleaning", "Sparkle", "Deep, recurring & move-out cleaning"),
    ("Painting", "PaintBucket", "Interior, exterior & decorative finishes"),
    ("Carpentry", "Scissors", "Furniture, shelving & custom builds"),
    ("HVAC", "Fan", "Heating, cooling, vents & air quality"),
    ("Landscaping", "Drop", "Lawns, gardens, decks & outdoor design"),
    ("Appliance Repair", "FirstAid", "Fridges, washers, ovens & dryers"),
    ("Handyman", "Wrench", "Mounting, assembly & small fixes"),
    ("Pest Control", "ShieldCheck", "Inspection, treatment & prevention"),
    # extra categories from the product brief
    ("Computer Repair", "Laptop", "Laptops, desktops, data recovery & networking"),
    ("Phone Repair", "DeviceMobile", "Screens, batteries & diagnostics"),
    ("Mechanic", "Car", "Servicing, brakes & roadside repairs"),
    ("Tutor", "GraduationCap", "School subjects, languages & exam prep"),
]

# name, title, [category names], city, rating, hourly, minJob, instant, available, years, response, skills
PROVIDERS = [
    ("Alex Rivera", "Master Plumber", ["Plumbing", "Handyman"], "Austin", 4.9, 95, 120, True, True, 12, 14, "Leak repair,Water heaters,Drainage,Pipe relining"),
    ("Maya Chen", "Licensed Electrician", ["Electrical", "Handyman"], "Round Rock", 4.8, 110, 140, True, False, 9, 22, "Panel upgrade,EV chargers,Smart home,Rewire"),
    ("Diego Santos", "Pro Cleaner", ["Cleaning"], "Austin", 4.9, 48, 80, True, True, 6, 9, "Deep clean,Move-out,Eco products,Post-build"),
    ("Priya Nair", "Interior Painter", ["Painting", "Carpentry"], "Cedar Park", 4.7, 72, 200, False, False, 8, 31, "Wall finish,Cabinet spray,Faux texture,Trim"),
    ("Sam Okafor", "HVAC Specialist", ["HVAC", "Appliance Repair"], "Pflugerville", 4.8, 125, 180, True, True, 14, 18, "AC repair,Furnace,Ductwork,Thermostats"),
    ("Lena Park", "Carpentry & Builds", ["Carpentry", "Handyman"], "Austin", 4.9, 88, 150, False, True, 11, 27, "Custom shelving,Decks,Doors,Furniture"),
    ("Marcus Bell", "Landscape Designer", ["Landscaping", "Handyman"], "Georgetown", 4.6, 70, 250, False, False, 10, 40, "Xeriscaping,Patios,Irrigation,Lighting"),
    ("Sofia Rossi", "Appliance Technician", ["Appliance Repair", "HVAC"], "Round Rock", 4.8, 98, 110, True, True, 13, 16, "Fridges,Washers,Ovens,Dryers"),
    ("Tariq Hassan", "Handyman Hero", ["Handyman", "Carpentry", "Cleaning"], "Austin", 4.7, 58, 60, True, True, 7, 11, "TV mounting,Assembly,Fixes,Caulking"),
    ("Grace Liu", "Pest Control Pro", ["Pest Control", "Cleaning"], "Cedar Park", 4.9, 82, 95, True, False, 9, 20, "Inspection,Termite,Rodent,Eco-safe"),
    ("Noah Kim", "Electrical & Solar", ["Electrical", "HVAC"], "Pflugerville", 4.7, 118, 160, False, True, 12, 25, "Solar install,Inverters,Backup,Meter"),
    ("Isabella Cruz", "Deep Clean Studio", ["Cleaning", "Painting"], "Austin", 5.0, 52, 90, True, True, 5, 8, "Steam clean,Odor removal,Windows,Carpet"),
    ("Daniel Bekele", "Computer & Phone Repair", ["Computer Repair", "Phone Repair"], "Austin", 4.8, 45, 40, True, True, 8, 12, "Laptop repair,Screen replacement,Data recovery,Virus removal"),
]

CUSTOMERS = ["Sarah Jenkins", "Tom Reyes", "Nina Foster", "Owen Blake", "Emily Watson", "David Park", "Rachel Adams"]

COMMENTS = {
    5: ["Absolutely flawless. Showed up on time and the result exceeded expectations.",
        "Professional, tidy, and fairly priced. Already booked a follow-up.",
        "Trustworthy and skilled. Cleaned up perfectly after the job."],
    4: ["Great work overall. Communication was solid and they finished ahead of schedule.",
        "Good job, slightly late but kept me informed the whole time."],
}

SERVICE_TEMPLATES = {
    "Plumbing": [("Leak repair", 120, 90), ("Water heater flush", 130, 60)],
    "Electrical": [("EV charger install", 520, 180), ("Outlet & switch repair", 140, 60)],
    "Cleaning": [("Deep clean (2 bed)", 240, 240), ("Move-out cleaning", 200, 180)],
    "Painting": [("Interior room painting", 300, 300)],
    "Carpentry": [("Custom shelving", 250, 240)],
    "HVAC": [("AC tune-up", 160, 90)],
    "Landscaping": [("Garden design consult", 250, 120)],
    "Appliance Repair": [("Appliance diagnostic", 110, 60)],
    "Handyman": [("TV mounting", 60, 60), ("Furniture assembly", 80, 90)],
    "Pest Control": [("Pest inspection", 95, 60)],
    "Computer Repair": [("Laptop diagnostic & repair", 60, 90)],
    "Phone Repair": [("Screen replacement", 80, 45)],
}


def email_for(name):
    return name.lower().replace(" ", ".") + "@fixmate.test"


class Command(BaseCommand):
    help = "Seed the database with realistic development data."

    def add_arguments(self, parser):
        parser.add_argument("--password", help="Password for all seeded accounts (default: $SEED_PASSWORD or random).")
        parser.add_argument("--reset", action="store_true", help="Delete existing seeded (@fixmate.test) data first.")

    @transaction.atomic
    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("seed_data only runs with DEBUG=True (development).")
        password = opts["password"] or os.environ.get("SEED_PASSWORD") or secrets.token_urlsafe(12)
        generated = not (opts["password"] or os.environ.get("SEED_PASSWORD"))

        if opts["reset"]:
            User.objects.filter(email__endswith="@fixmate.test").delete()
            self.stdout.write("Removed previous seeded users (and their data).")

        now = timezone.now()
        today = timezone.localdate()

        # ---- admin
        admin, created = User.objects.get_or_create(
            email="admin@fixmate.test",
            defaults=dict(first_name="FixMate", last_name="Admin", role="ADMIN", is_staff=True, is_superuser=True, is_verified=True),
        )
        if created:
            admin.set_password(password)
            admin.save()

        # ---- categories
        cats = {}
        for name, icon, desc in CATEGORIES:
            # slugs for the original 10 categories match the React frontend's category ids
            slug = {"Appliance Repair": "appliance", "Pest Control": "pest"}.get(name)
            defaults = dict(icon=icon, description=desc)
            if slug:
                defaults["slug"] = slug
            cats[name], _ = ServiceCategory.objects.get_or_create(name=name, defaults=defaults)

        # ---- customers
        customers = {}
        for i, name in enumerate(CUSTOMERS):
            first, last = name.split(" ", 1)
            u, created = User.objects.get_or_create(
                email=email_for(name),
                defaults=dict(first_name=first, last_name=last, role="CUSTOMER", phone=f"(512) 555-01{40 + i}",
                              location="Austin", is_verified=True),
            )
            if created:
                u.set_password(password)
                u.save()
            customers[name] = u

        # ---- providers + services
        providers = {}
        for (name, title, cat_names, city, rating, rate, min_job, instant, avail, yrs, resp, skills) in PROVIDERS:
            first, last = name.split(" ", 1)
            u, created = User.objects.get_or_create(
                email=email_for(name),
                defaults=dict(first_name=first, last_name=last, role="PROVIDER", location=city, is_verified=True,
                              phone="(512) 555-0199"),
            )
            if created:
                u.set_password(password)
                u.save()
            prof, _ = ProviderProfile.objects.get_or_create(
                user=u,
                defaults=dict(
                    profession=title, location=city, years_of_experience=yrs, hourly_rate=rate, starting_price=min_job,
                    description=f"{name} is a {title.lower()} serving {city} with {yrs}+ years of hands-on experience. "
                                "Known for transparent pricing, punctual arrivals and a spotless finish.",
                    verification_status="VERIFIED", availability="AVAILABLE" if avail else "BUSY",
                    instant_book=instant, response_time_mins=resp, skills=skills,
                ),
            )
            prof.categories.set([cats[c] for c in cat_names])
            for c in cat_names:
                for title_s, price, minutes in SERVICE_TEMPLATES.get(c, []):
                    Service.objects.get_or_create(
                        provider=prof, category=cats[c], title=title_s,
                        defaults=dict(description=f"{title_s} by {name}.", starting_price=price, duration_minutes=minutes),
                    )
            providers[name] = (prof, rating)

        # One provider awaiting verification so admin moderation can be demoed.
        pend_user, created = User.objects.get_or_create(
            email="kofi.mensah@fixmate.test",
            defaults=dict(first_name="Kofi", last_name="Mensah", role="PROVIDER", location="Austin"),
        )
        if created:
            pend_user.set_password(password)
            pend_user.save()
            pp = ProviderProfile.objects.create(user=pend_user, profession="Mechanic", location="Austin", hourly_rate=65,
                                                starting_price=70, years_of_experience=6,
                                                description="Mobile mechanic.", skills="Brakes,Oil change")
            pp.categories.add(cats["Mechanic"])

        if Booking.objects.filter(customer__email__endswith="@fixmate.test").exists():
            self.stdout.write(self.style.WARNING("Bookings already seeded; skipping bookings/reviews/messages."))
            self._summary(password, generated)
            return

        # ---- historical completed bookings + reviews (drives real ratings)
        cust_list = list(customers.values())
        for pi, (name, (prof, target)) in enumerate(providers.items()):
            n = 4
            n_fours = round((5 - target) * n)  # approximate the mock rating
            ratings = [5] * (n - n_fours) + [4] * n_fours
            for j, r in enumerate(ratings):
                cust = cust_list[(pi + j) % len(cust_list)]
                days_ago = 10 + j * 9 + pi
                d = today - timedelta(days=days_ago)
                svc = prof.services.first()
                b = Booking.objects.create(
                    customer=cust, provider=prof, service=svc, category=svc.category if svc else None,
                    title=svc.title if svc else prof.profession, description="Completed job (seed data).",
                    scheduled_date=d, scheduled_time="10:00", time_slot="10:00 - 12:00",
                    location=f"{100 + pi * 7} Seed St, {prof.location}",
                    contact_name=cust.full_name, contact_phone=cust.phone, contact_email=cust.email,
                    estimated_price=svc.starting_price if svc else prof.hourly_rate * 2, status="COMPLETED",
                )
                b.final_price = b.estimated_price
                b.save()
                for st, label in (("PENDING", "Request sent"), ("ACCEPTED", "Accepted by provider"),
                                  ("IN_PROGRESS", "Job in progress"), ("COMPLETED", "Completed")):
                    BookingEvent.objects.create(booking=b, status=st, label=label)
                Review.objects.create(customer=cust, provider=prof, booking=b, rating=r,
                                      comment=COMMENTS[r][(pi + j) % len(COMMENTS[r])])
                Booking.objects.filter(pk=b.pk).update(created_at=now - timedelta(days=days_ago + 2))

        # ---- the demo bookings from the frontend mock (b1..b6)
        P = lambda n: providers[n][0]
        C = customers
        demo = [
            ("Alex Rivera", "Sarah Jenkins", "Plumbing", "Kitchen sink leak", "Water pooling under the sink cabinet, slow drip from the P-trap.", 2, "09:00 - 11:00", "1420 Oak Hollow Ln, Austin", "IN_PROGRESS", 165),
            ("Diego Santos", "Sarah Jenkins", "Cleaning", "Deep clean (2 bed)", "Full deep clean before moving in, appliances and windows included.", 5, "13:00 - 17:00", "88 Cedar Ridge Dr, Austin", "ACCEPTED", 240),
            ("Maya Chen", "Tom Reyes", "Electrical", "EV charger install", "Install a Level 2 charger in the garage, dedicated 240V circuit.", -2, "10:00 - 12:00", "512 Summit Ave, Round Rock", "COMPLETED", 520),
            ("Alex Rivera", "Nina Foster", "Plumbing", "Water heater flush", "Annual flush and inspection of a 50-gal tank heater.", 7, "15:00 - 16:00", "77 Willow Bend, Austin", "PENDING", 130),
            ("Alex Rivera", "Owen Blake", "Plumbing", "Bathroom remodel leak", "Suspected slab leak, need camera inspection and quote.", 10, "08:00 - 10:00", "9 Maple Court, Pflugerville", "PENDING", 280),
            ("Alex Rivera", "Emily Watson", "Handyman", "Faucet replacement", "Swap two worn kitchen faucets, bring new units.", -4, "11:00 - 12:00", "340 Birch St, Austin", "DECLINED", 90),
        ]
        order = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"]
        labels = {"PENDING": "Request sent", "ACCEPTED": "Accepted by provider", "IN_PROGRESS": "Job in progress",
                  "COMPLETED": "Completed", "DECLINED": "Declined by provider"}
        demo_bookings = []
        for pn, cn, cat, title, desc, off, slot, addr, st, est in demo:
            b = Booking.objects.create(
                customer=C[cn], provider=P(pn), category=cats[cat], title=title, description=desc,
                scheduled_date=today + timedelta(days=off), scheduled_time=slot.split(" - ")[0], time_slot=slot,
                location=addr, contact_name=cn, contact_phone=C[cn].phone, contact_email=C[cn].email,
                estimated_price=Decimal(est), status=st, final_price=Decimal(est) if st == "COMPLETED" else None,
            )
            path = ["PENDING", "DECLINED"] if st == "DECLINED" else order[: order.index(st) + 1]
            for s in path:
                BookingEvent.objects.create(booking=b, status=s, label=labels[s])
            demo_bookings.append(b)

        # ---- favourites
        for pn in ("Diego Santos", "Tariq Hassan"):
            Favorite.objects.get_or_create(customer=C["Sarah Jenkins"], provider=P(pn))

        # ---- conversations + messages
        convs = [
            ("Alex Rivera", [("me", "Hi Alex, the leak under the kitchen sink is getting worse. Can you take a look today?"),
                             ("them", "Morning Sarah! Yes, I can be there between 9 and 11. Is the cabinet empty?"),
                             ("me", "Just cleared it out. The drip is near the back pipe."),
                             ("them", "Perfect. I'll bring a replacement P-trap too.")]),
            ("Diego Santos", [("me", "Hey Diego, do you handle inside the oven and fridge for a deep clean?"),
                              ("them", "Absolutely, both are included in the deep clean package."),
                              ("me", "Great, I'll keep the 1pm slot then."),
                              ("them", "Sounds good, see you then!")]),
            ("Maya Chen", [("them", "Hi! Just finished the EV charger install and tested the circuit. All green."),
                           ("me", "Awesome, thank you! Can you send the invoice?"),
                           ("them", "Invoice sent, thanks again!")]),
        ]
        sarah = C["Sarah Jenkins"]
        conv_by_provider = {}
        for ci, (pn, msgs) in enumerate(convs):
            pu = P(pn).user
            conv = Conversation.objects.create(participant_key="-".join(str(i) for i in sorted([sarah.id, pu.id])))
            conv.participants.add(sarah, pu)
            conv_by_provider[pn] = conv
            base = now - timedelta(hours=5 * (ci + 1))
            last = None
            for k, (who, text) in enumerate(msgs):
                m = Message.objects.create(conversation=conv, sender=sarah if who == "me" else pu, text=text, is_read=(k < len(msgs) - 1 or who == "me"))
                last = base + timedelta(minutes=2 * k)
                Message.objects.filter(pk=m.pk).update(created_at=last)
            Conversation.objects.filter(pk=conv.pk).update(last_message_at=last)

        # ---- notifications
        alex = P("Alex Rivera").user
        N = NotificationType
        booking = lambda i: {"booking_id": demo_bookings[i].id}
        maya_job = Booking.objects.filter(customer=sarah, provider=P("Maya Chen"), status="COMPLETED").first()
        for rec, typ, title, msg, read, data in [
            (sarah, N.BOOKING_ACCEPTED, "Alex accepted your request", "Kitchen sink leak is confirmed.", False, booking(0)),
            (sarah, N.NEW_MESSAGE, "New message from Diego", "Sounds good, see you then!", False,
             {"conversation_id": conv_by_provider["Diego Santos"].id}),
            (sarah, N.REVIEW_REMINDER, "How was Maya?", "Leave a review to help others choose.", True,
             {"booking_id": maya_job.id} if maya_job else {}),
            (alex, N.NEW_BOOKING, "New booking request", "Nina Foster requested Water heater flush.", False, booking(3)),
            (alex, N.NEW_BOOKING, "New booking request", "Owen Blake requested Bathroom remodel leak.", False, booking(4)),
            (alex, N.PROVIDER_VERIFICATION, "Verification complete", "Your FixMate pro badge is now active.", True, {}),
        ]:
            Notification.objects.create(recipient=rec, notification_type=typ, title=title, message=msg,
                                        is_read=read, data=data)

        self._summary(password, generated)

    def _summary(self, password, generated):
        self.stdout.write(self.style.SUCCESS("Seed data ready."))
        self.stdout.write("Logins (all seeded accounts share one password):")
        for e in ("admin@fixmate.test", "sarah.jenkins@fixmate.test (customer)", "alex.rivera@fixmate.test (provider)",
                  "kofi.mensah@fixmate.test (provider, pending verification)"):
            self.stdout.write(f"  {e}")
        if generated:
            self.stdout.write(self.style.WARNING(f"Generated password (shown once): {password}"))
        else:
            self.stdout.write("Password: the one you supplied via --password / SEED_PASSWORD.")

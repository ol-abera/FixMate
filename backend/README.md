# FixMate Backend

Django REST API for the FixMate local-services marketplace (customers ⇄ providers: bookings, reviews,
favorites, messaging, notifications, dashboards). The React frontend lives one level up.

**Stack:** Python 3.11+, Django 5.2, Django REST Framework, SimpleJWT, PostgreSQL, django-cors-headers, Pillow.

## 1. PostgreSQL
```sql
CREATE USER fixmate WITH PASSWORD 'choose-a-password' CREATEDB;  -- CREATEDB is needed by `manage.py test`
CREATE DATABASE fixmate OWNER fixmate;
```

## 2. Install & configure
```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows   (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env  -> then edit the values
```
Environment variables (`.env`): `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_NAME`, `DATABASE_USER`,
`DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
(+ optional `MEDIA_ROOT`, `SECURE_SSL_REDIRECT`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`).
Generate a key: `python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"`.

## 3. Migrations, seed data, run
```bash
python manage.py migrate
python manage.py seed_data            # DEBUG=True only; prints a random password once (or use --password / SEED_PASSWORD)
python manage.py runserver            # http://localhost:8000
```
Seeded logins (shared password printed by the command): `admin@fixmate.test`, `sarah.jenkins@fixmate.test`
(customer), `alex.rivera@fixmate.test` (provider), `kofi.mensah@fixmate.test` (provider awaiting verification).
Admin site: http://localhost:8000/admin/ (create your own superuser with `createsuperuser` if you prefer).

## 4. Frontend
```bash
cd ..            # project root
cp .env.example .env     # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev              # this repo's dev server runs on :3000 (both :3000 and :5173 are allowed by CORS)
```

## 5. API overview (`/api`)
| Area | Endpoints |
|---|---|
| Auth | `POST auth/register/`, `POST auth/login/`, `POST auth/token/refresh/`, `POST auth/logout/` (blacklists the refresh token), `GET/PATCH auth/me/`, `POST auth/password/change/`, `POST auth/password/reset/`, `POST auth/password/reset/confirm/` |
| Categories | `GET categories/` (with provider_count, avg_price) |
| Providers | `GET providers/` (verified only; `search, category, location, min_price, max_price, min_rate, max_rate, rating, available_now, instant_book, lat, lng, radius_km, ordering, page, page_size`; with `lat`/`lng` each result has `distance_km` and results sort nearest first unless another `ordering` is given), `GET providers/{id}/`, `POST providers/`, `GET/PATCH providers/me/` (`latitude`/`longitude` pin the base; `null` for both falls back to the city centre; the exact `pin` is only returned to the owner), `PATCH providers/{id}/` (owner), `POST providers/me/portfolio/`, `DELETE providers/me/portfolio/{id}/`, `POST providers/{id}/verify|reject/` (admin; reject takes an optional `reason`), `GET providers/{id}/reviews/` |
| Services | `GET/POST services/` (`?mine=1` for the signed-in provider, incl. hidden), `GET/PATCH/DELETE services/{id}/` (owner provider only) |
| Bookings | `GET/POST bookings/`, `GET bookings/{id}/`, `POST bookings/{id}/accept|decline|start|complete|cancel/`, `POST bookings/{id}/photos/` (customer, multipart `image`, max 6), `DELETE bookings/{id}/photos/{photo_id}/`, `GET bookings/busy/?provider=<id>` (committed slots, next 30 days) |
| Reviews | `GET/POST reviews/`, `PATCH/DELETE reviews/{id}/` (author), `GET reviews/moderation/` (admin; `state=hidden|published`, `max_rating`), `POST reviews/{id}/hide|publish/` (admin) |
| Favorites | `GET/POST favorites/`, `DELETE favorites/{provider_id}/` |
| Messaging | `GET/POST conversations/`, `GET conversations/{id}/`, `GET/POST conversations/{id}/messages/` (`?after=<id>` for polling) |
| Notifications | `GET notifications/`, `PATCH notifications/{id}/read/`, `POST notifications/read-all/`, `DELETE notifications/` |
| Payments | `GET payments/config/` (active gateway), `POST payments/checkout/` (`{booking}`, customer, COMPLETED only; returns `checkout_url`), `GET payments/session/{session_id}/`, `POST payments/sync/` (`{session_id}`, re-checks with Stripe), `POST payments/mock/confirm/` (mock gateway only), `POST payments/webhook/` (Stripe, signature-verified) |
| Dashboards | `GET dashboard/customer/`, `GET dashboard/provider/`, `GET dashboard/admin/` (totals, bookings by status, 14-day trend, newest accounts), `GET dashboard/public/` (anonymous landing-page stats) |

Errors are `{"detail": "...", "errors": {field: [..]}}`. Lists are paginated `{count, next, previous, results}`.

**Booking workflow:** PENDING → ACCEPTED (provider) / DECLINED (provider) / CANCELLED (either); ACCEPTED → IN_PROGRESS
(provider) / CANCELLED; IN_PROGRESS → COMPLETED (provider or customer). Status changes only happen through the action
endpoints above; prices are computed server-side. A provider can't hold two ACCEPTED/IN_PROGRESS bookings with
overlapping slots: new requests for a committed slot are rejected, and so is accepting a clashing request. Reviews require a COMPLETED booking owned by the reviewer (one per booking).

## 6. Payments
Customers pay after a job is COMPLETED: the amount is the booking's `final_price`. Bookings include `payment`
(`status`, `amount`, `paid_at`) and `can_pay`. One `Payment` row per booking; a failed or abandoned checkout is replaced
by the next attempt, and a paid booking can't be charged again.

* **Stripe:** set `STRIPE_SECRET_KEY` (and `PAYMENTS_CURRENCY`, default `usd`). Checkout redirects to Stripe-hosted
  Checkout and back to `FRONTEND_URL/checkout/return`, which confirms with Stripe directly. Set `STRIPE_WEBHOOK_SECRET`
  so `payments/webhook/` accepts `checkout.session.*` events; unsigned, stale or wrongly signed requests get 400. Locally:
  `stripe listen --forward-to localhost:8000/api/payments/webhook/` prints the secret to use.
* **Mock (development):** with no Stripe key and `PAYMENTS_MOCK` on (the default when `DEBUG=True`), checkout opens a
  test page in the app. Card `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined. With neither configured,
  checkout returns 503 and the Pay button is hidden.

Seed data marks past jobs as paid and leaves each customer's latest completed job unpaid, so the flow can be tried at once.

## 7. Realtime (WebSockets)
`runserver` serves ASGI (Daphne), so `ws://localhost:8000/ws/` works in development with no extra process. In production
run `daphne -b 0.0.0.0 -p 8000 config.asgi:application` (or uvicorn) and set `REDIS_URL` so every backend process shares
one channel layer; without it an in-memory layer is used, which only reaches sockets in the same process.

* The client connects to `/ws/` and sends `{"type": "auth", "token": "<access token>"}` as its first message (tokens are
  kept out of URLs and logs). The server answers `{"type": "ready"}`, or closes with code `4001` for a missing,
  invalid or expired token; it also closes with `4001` when the token expires mid-session, and the client refreshes and
  reconnects. Unauthenticated sockets are closed after 10 s; `{"type": "ping"}` gets `{"type": "pong"}`.
* The `Origin` header must match `CORS_ALLOWED_ORIGINS` or `ALLOWED_HOSTS`.
* Events, sent only after the database transaction commits:
  `{"type": "notification", "notification": {...}}` (same shape as `GET notifications/`),
  `{"type": "message", "conversation_id", "message_id", "sender_id"}` and `{"type": "booking", "booking_id", "status"}`.
  Messages and bookings are signals; the client re-fetches over REST so viewer-specific fields stay correct.
* Realtime is best-effort: if the channel layer is down, requests still succeed and the frontend keeps polling
  (every 15 s, or 60 s while the socket is live).

## 8. Authentication
Send `Authorization: Bearer <access>`. Access tokens last 30 min, refresh tokens 7 days (rotating). Passwords are hashed
by Django. Roles: `CUSTOMER`, `PROVIDER`, `ADMIN` (admins are created via `createsuperuser`/admin only; register rejects `ADMIN`).

Refresh tokens are single-use: rotation blacklists the old one, `auth/logout/` blacklists the current one, and changing or
resetting a password revokes every refresh token for that user. Access tokens are stateless and stay valid until they expire.

Password reset emails link to `FRONTEND_URL/reset-password?uid=…&token=…`. With no SMTP settings, the email is printed to
the `runserver` console, so in development you copy the link from there.

## 9. Testing
```bash
python manage.py test        # needs a reachable PostgreSQL where the DB user may CREATE DATABASE
```

## Notes
* Reminders: schedule `python manage.py send_reminders` daily (cron) for "upcoming booking" notifications.
* Uploads go to `MEDIA_ROOT` (default `backend/media/`, git-ignored); images only (JPG/PNG/WEBP, ≤5 MB, content-verified). Serve media via your web server in production.

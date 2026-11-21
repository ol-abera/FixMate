# FixMate

FixMate is a local-services marketplace: customers find verified pros (plumbers, electricians, cleaners, …),
book them through a 6-step wizard, chat, and leave reviews. Providers manage requests, jobs and earnings
from their dashboard; admins verify providers.

| Part | Stack | Location |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, framer-motion, Phosphor icons | `src/` |
| Backend | Django 5.2, Django REST Framework, SimpleJWT, Django Channels, PostgreSQL, Redis (optional) | `backend/` |

## Run everything with Docker

Prerequisites: Docker with Compose v2.

```bash
cp .env.example .env     # set SECRET_KEY and DATABASE_PASSWORD (see the docker compose section at the bottom)
docker compose up --build
```

Open http://localhost:8080. Compose starts PostgreSQL, Redis, the Django API on Daphne (HTTP + WebSockets) and nginx,
which serves the built React app and proxies `/api`, `/ws/`, `/admin` and `/media` to the backend, so the browser
only ever talks to one origin. The backend runs migrations and `collectstatic` on start; uploads and the database
live in named volumes (`media`, `pgdata`).

* **Demo data:** add `SEED_DEMO=1` and `SEED_PASSWORD=…` to `.env` to load the seed accounts (throwaway demos only).
  Add `PAYMENTS_MOCK=True` to try checkout without Stripe.
* **Admin user:** `docker compose exec backend python manage.py createsuperuser`, then sign in at `/admin/`.
* **Production:** put TLS in front of the `web` service, set `APP_URL=https://your.domain`,
  `ALLOWED_HOSTS=your.domain`, `SECURE_SSL_REDIRECT=True`, real SMTP settings and Stripe keys.
  Health check: `GET /api/health/`.
* **Reset:** `docker compose down -v` deletes the containers and the volumes.

## Quick start (local)

Prerequisites: Node.js 20+, Python 3.11+, PostgreSQL 14+.

```bash
# 1. Backend (see backend/README.md for details)
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # then edit DATABASE_PASSWORD / SECRET_KEY
python manage.py migrate
python manage.py seed_data --password 'choose-a-dev-password'
python manage.py runserver                         # http://localhost:8000

# 2. Frontend (in a second terminal, from the repo root)
cp .env.example .env                               # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev                                        # http://localhost:3000
```

Seeded logins (all share the password you passed to `seed_data`):

| Email | Role |
|---|---|
| `sarah.jenkins@fixmate.test` | Customer |
| `alex.rivera@fixmate.test` | Provider (verified) |
| `kofi.mensah@fixmate.test` | Provider (pending verification) |
| `admin@fixmate.test` | Admin |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |
| `npm test` | Frontend unit and component tests (Vitest + Testing Library, jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `cd backend && python manage.py test` | Backend test suite (needs PostgreSQL with `CREATEDB`) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, frontend tests and the production build, plus the Django
tests against PostgreSQL 16 and a check that no model change is missing a migration, on every pull request.

## Project layout

```
src/
  components/Layout.tsx   navbar, footer and shared UI primitives
  components/ui/          shadcn/ui primitives
  context/AppContext.tsx  app-wide state (session, bookings, chats, notifications)
  services/api.ts         REST client + mappers from API shapes to UI types
  data/mockData.ts        domain types and static marketing content
  pages/                  route components
backend/
  config/                 settings, root URLs
  users/ providers/ services/ bookings/ reviews/ favorites/
  messaging/ notifications/ dashboard/ common/
```

API reference, booking workflow and auth details live in [`backend/README.md`](backend/README.md).

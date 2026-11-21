# FixMate

FixMate is a local-services marketplace: customers find verified pros (plumbers, electricians, cleaners, …),
book them through a 6-step wizard, chat, and leave reviews. Providers manage requests, jobs and earnings
from their dashboard; admins verify providers.

| Part | Stack | Location |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, framer-motion, Phosphor icons | `src/` |
| Backend | Django 5.2, Django REST Framework, SimpleJWT, PostgreSQL | `backend/` |

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

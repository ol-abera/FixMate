# CampusBridge

**Your bridge to academic excellence and career opportunities.**

CampusBridge is a university learning and internship platform for students, especially in South West Ethiopia. Students take courses, complete graded assignments, earn points and badges, and apply for **internships, scholarships and research opportunities**. Instructors teach and grade. Internship coordinators post opportunities and review applicants. Everyone gets in-app notifications.

> **Sample data notice:** every course, instructor, organisation, scholarship and opportunity that ships with the project is **sample data for demonstration** (`backend/src/data/seed.js`). Replace it with real listings before real use, then set `SHOW_SAMPLE_DATA_NOTICE = false` in `src/config.js`.

## Features

**Four kinds of account.** Public sign-up creates a *student* or an *organisation* (the sign-up page asks which). Instructor and coordinator accounts are given by an administrator (see *Roles and demo accounts*).

| Role | What they can do |
|---|---|
| **Student** | Browse and search opportunities and courses. **Enrol** in courses, open assignments, **submit work**, see grades and feedback. Track **progress per course**, **points**, **badges** and a **leaderboard**. Apply for opportunities (one application each), see the status, **withdraw** before a decision. Edit their profile. |
| **Instructor** | See their courses (students, assignments, work waiting to be graded). **Create assignments** (students are notified). Read submissions, **grade them with feedback** (the student is notified). |
| **Internship coordinator** | **Post opportunities** (internship, scholarship, fellowship, competition, research). See every applicant with their cover letter. **Accept, reject or mark under review** (the student is notified). |
| **Organisation** | Everything a coordinator can do, plus a public **organisation profile**, **editing** their own listings, and applicant details (field of study, skills). Listings carry the organisation's name; the verified mark is set only by an administrator. |

**Ethiopian opportunity hub.** Internships, scholarships, fellowships and competitions with search; filters for type, category, where (Ethiopia / international), and deadline (open now, closing in 30 days); who can apply (years, fields, universities, skills); and an **official source link**. Programmes run by outside bodies link to their own site to apply; listings posted by organisations on CampusBridge are applied for in the app.

**Opportunity matching.** Students get *Recommended for you* on their dashboard, scored from university, field of study (department), year of study and skills. Every card says **why** it matches. Listings restricted to other universities or years are never shown. Students add skills on their profile.

**AI learning assistant.** Students ask questions, get explanations, summarise pasted notes or the course outline, and generate practice questions with an answer key, for courses they are enrolled in. The AI provider is called only by the backend.

Also: JWT login that survives a refresh; protected pages by role; search and filters; in-app **notifications** with an unread bell; responsive layout (desktop, tablet, mobile menu); loading, empty and error states.

## Technology stack
| Part | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, plain CSS, Lucide icons |
| Backend | Node.js 18+, Express 4, `pg`, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv` |
| Database | PostgreSQL 14+ |
| Tests | Node's built-in test runner (backend); Puppeteer (optional real-browser tests) |

## Folder structure
```
CampusBridge/
├── src/                      React frontend
│   ├── components/           Navbar, Footer, cards, form helpers
│   ├── context/AuthContext   Login state for the whole app
│   ├── hooks/                Filter options, URL-based filters
│   ├── pages/                One file per page
│   └── services/api.js       Every call to the backend
├── backend/
│   ├── server.js             Starts the API
│   ├── .env.example          Settings template (copy to .env)
│   ├── src/
│   │   ├── app.js            Express setup (CORS, headers, routes)
│   │   ├── config.js         Reads and validates environment variables
│   │   ├── db/schema.sql     Database tables
│   │   ├── db/index.js       Connects, creates tables, loads sample data
│   │   ├── data/seed.js      Sample courses, opportunities and scholarships
│   │   ├── data/learning.js  Sample assignments and the three demo accounts
│   │   ├── middleware/       Auth check, error handling, input guards
│   │   ├── routes/           auth, catalog, applications, learning (courses, assignments, grading),
│   │   │                     staff (coordinator), notifications
│   │   └── utils/            Validation, rate limiting, mappers
│   ├── scripts/              reset-demo.js, set-role.js (see below)
│   └── tests/                Unit tests + API integration tests (incl. roles and grading)
├── e2e/                      Optional real-browser test of the whole student journey
├── .env.example              Optional frontend settings
└── PRESENTATION.md           Notes for a university demonstration
```

## Prerequisites
1. **Node.js 18 or newer**: https://nodejs.org (check with `node -v`).
2. **PostgreSQL 14 or newer**: https://www.postgresql.org/download/ (remember the password you set for the `postgres` user).

## Installation

Open a terminal in the project folder (the one that contains this README).

**1. Install dependencies**
```bash
npm install
cd backend
npm install
cd ..
```

**2. Create the empty database**

*Windows (PowerShell).* Adjust the version number in the path if yours differs; it asks for your postgres password:
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -d postgres -c "CREATE DATABASE campusbridge;"
```
*macOS / Linux:*
```bash
psql -U postgres -h localhost -c "CREATE DATABASE campusbridge;"
```
("already exists" is fine). **You do not create tables by hand**: the API creates all tables and loads the sample data automatically the first time it starts (see *Database setup* below).

**3. Configure the backend**
```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```
Open `backend/.env` and set:
- `DATABASE_URL`: replace `YOUR_POSTGRES_PASSWORD` with your password (URL-encode special characters, e.g. `@` becomes `%40`).
- `JWT_SECRET`: a long random string. Generate one with
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Never share or commit `.env`.

**4. Start the backend** (keep this terminal open)
```bash
npm run dev
```
Open http://localhost:5000/api/health. You should see `{"status":"ok", ...}`.

**5. Start the frontend** (a second terminal, in the project root)
```bash
npm run dev
```
Open http://localhost:5173.

## Environment variables
| File | Variable | Purpose |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection string (**required**) |
| | `JWT_SECRET` | Signs login tokens, at least 32 characters (**required**) |
| | `CLIENT_ORIGIN` | Browser address(es) allowed to call the API, comma separated (default `http://localhost:5173,http://127.0.0.1:5173`) |
| | `PORT` | API port (default `5000`) |
| | `JWT_EXPIRES_IN` | Login lifetime (default `7d`) |
| | `TRUST_PROXY` | Only if the API runs behind a reverse proxy, e.g. `1` |
| | `SEED_DEMO_ACCOUNTS` | `true` creates the four demo accounts (see below). Ignored in production. |
| | `LLM_API_KEY` | Key for the AI assistant. **Without it the assistant is switched off** and says so. Never commit it. |
| | `LLM_PROVIDER` | `anthropic` (default) or `openai` (any OpenAI-compatible chat API) |
| | `LLM_MODEL` | Model name (default `claude-haiku-5-5`; use one your account can access) |
| | `LLM_BASE_URL` | Only for a proxy or a compatible server (default: the provider's own address) |
| | `LLM_TIMEOUT_MS` | How long to wait for the AI (default `30000`) |
| `.env` (root, optional) | `VITE_API_BASE_URL` | API address if not `http://localhost:5000/api` |
| | `VITE_CONTACT_EMAIL` | Contact email shown in the footer |

## Database setup, initialisation and seed data
- Tables (`users`, `courses`, `opportunities`, `applications`, `enrollments`, `assignments`, `submissions`, `notifications`, `organizations`, `saved_opportunities`, `application_events`) are defined in `backend/src/db/schema.sql`. Foreign keys, a **unique (user, opportunity)** rule and a status check keep the data consistent.
- On every API start, `initializeDatabase()` (in `backend/src/db/index.js`) creates missing tables and **upserts the sample catalogue** from `backend/src/data/seed.js`. Running it again is safe.
- Sample deadlines are defined as "N days from today". A deadline that is still open is **kept as it is** on restart; a deadline that has passed is renewed, so the demo never goes stale.
- To change the listings, edit `seed.js` and restart the API. (There is no admin screen yet.)
- Upgrading from an older version: users and applications are kept. Old JSON-style `courses` / `opportunities` tables are **renamed** to `*_legacy_backup`, never deleted.

## Roles and demo accounts
Set `SEED_DEMO_ACCOUNTS=true` in `backend/.env` and restart the API. Four accounts are created, all with the **public demo password `Demo12345`** (so this switch is ignored when `NODE_ENV=production`):

| Role | Email | Starts at |
|---|---|---|
| Student | `student@demo.campusbridge.local` | `/dashboard` (already enrolled, one graded assignment) |
| Instructor | `instructor@demo.campusbridge.local` | `/instructor` (teaches all six sample courses) |
| Coordinator | `coordinator@demo.campusbridge.local` | `/coordinator` (owns the sample opportunities) |
| Organisation | `org@demo.campusbridge.local` | `/organization` (owns two sample listings: a fellowship and a hackathon) |

**Before a presentation**, put the data in a clean state:
```bash
cd backend
npm run demo:reset
```
It deletes automated-test accounts and listings and the demo accounts' activity, then restores the demo history. Real accounts are not touched.

**Giving a real person a role** (there is no admin screen yet; sign-up can only create students on purpose):
```bash
npm run set-role -- someone@example.com instructor c1   # c1 = the course they will teach
npm run set-role -- someone@example.com coordinator
npm run set-role -- someone@example.com organization
```
**Verifying an organisation** (the verified mark) is done in the database by an administrator, on purpose: `UPDATE organizations SET is_verified = true WHERE name = 'Org name';`

## API endpoints
Errors always look like `{ "message": "...", "errors": { "field": "..." } }`. Status codes: `200` OK, `201` created, `400` invalid input, `401` not logged in / bad token, `403` logged in but your role may not do this, `404` not found, `409` duplicate, `413` body too large, `429` too many requests, `503` database unavailable, `500` unexpected error.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | no | API and database status |
| POST | `/api/auth/register` | no | `fullName, email, university, password` → `201 {token, user}` (`409` email taken) |
| POST | `/api/auth/login` | no | `email, password` → `{token, user}` (`401` wrong credentials; rate limited) |
| GET | `/api/auth/me` | yes | Current user |
| PATCH | `/api/auth/me` | yes | Update `fullName, university, yearOfStudy, field, phone, bio` |
| GET | `/api/courses` | no | `?search=&category=&level=` |
| GET | `/api/courses/:id` | no | One course (`404` if missing) |
| GET | `/api/opportunities` | optional | `?search=&category=&type=&scope=&deadline=&location=&workMode=&sort=newest\|deadline\|relevance&page=&pageSize=` (default 12, max 50). A student token adds `saved` and `applicationStatus`. |
| GET | `/api/opportunities/:id` | no | One opportunity |
| GET | `/api/meta/filters` | no | Real categories, levels and types for the filter chips |
| GET | `/api/stats` | no | Real counts for the homepage |
| POST | `/api/applications` | yes | Submit an application (`409` duplicate, `400` deadline passed or invalid) |
| GET | `/api/applications` | yes | Your applications |
| GET | `/api/applications/:id` | yes | One of *your* applications (someone else's returns `404`) |
| PATCH | `/api/applications/:id/withdraw` | student | Withdraw your own application (`409` once a decision was made) |
| PATCH | `/api/applications/:id/status` | coordinator | `status`: Under Review / Shortlisted / Accepted / Rejected, only for opportunities they posted. The student is notified once per status. |
| POST | `/api/opportunities` | coordinator | Post an opportunity (validated; deadline cannot be in the past) |
| GET | `/api/coordinator/opportunities` | coordinator | Opportunities you posted, with applicant counts |
| GET | `/api/opportunities/:id/applications` | coordinator | Applicants for an opportunity you posted (`403` otherwise) |
| GET | `/api/courses/:id/enrollment` | yes | `{enrolled, manages}` for the current user |
| POST | `/api/courses/:id/enroll` | student | Enrol (`409` if already enrolled) |
| GET | `/api/enrollments`, `/api/progress` | student | Courses with progress %, points and badges |
| GET | `/api/leaderboard` | yes | Top 10 students: short name, university, points (no emails) |
| GET | `/api/courses/:id/assignments` | student / instructor | Students must be enrolled (`403`); instructors must own the course |
| GET | `/api/assignments/:id` | student / instructor | One assignment (+ your submission and grade) |
| POST | `/api/assignments/:id/submissions` | student | Submit work as JSON or multipart (`file` up to 5 MB: pdf, png, jpg, txt, doc, docx). Late work is accepted and marked late. An ungraded submission can be replaced (`200`); a graded one returns `409`. |
| GET | `/api/submissions/:id/file` | student or that course's instructor | Download a submission file (`404` for everyone else) |
| GET | `/api/instructor/courses` | instructor | Your courses with student and pending counts |
| POST | `/api/courses/:id/assignments` | instructor | Create an assignment for your course |
| GET | `/api/assignments/:id/submissions` | instructor | Submissions for your assignment |
| PATCH | `/api/submissions/:id/grade` | instructor | `grade` (0..max points), `feedback` |
| GET | `/api/notifications` | yes | Your notifications and `unread` count. Students also receive deadline reminders and new matches, stored once each. |
| POST | `/api/opportunities/:id/save` | student | Save an opportunity |
| DELETE | `/api/opportunities/:id/save` | student | Remove a saved opportunity |
| GET | `/api/saved-opportunities` | student | Opportunities you saved |
| GET | `/api/dashboard` | student | Courses, upcoming work, recent grades, applications, saved opportunities, and notifications |
| PATCH | `/api/notifications/:id/read`, POST `/api/notifications/read-all` | yes | Mark as read |

Protected routes expect the header `Authorization: Bearer <token>`.

### Hub, organisation, matching and assistant endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/opportunities?type=&category=&scope=&deadline=&search=` | no | Also filters by `scope` (`Ethiopia`/`International`) and `deadline` (`open`/`soon`) |
| PATCH | `/api/opportunities/:id` | coordinator, organisation | Edit a listing **you posted** (403 otherwise) |
| GET / PUT | `/api/organization/profile` | organisation | Read / save the organisation profile (`is_verified` cannot be set here) |
| GET | `/api/recommendations?limit=` | student | Matched open listings with `match.score` and `match.reasons` |
| GET | `/api/assistant/status` | student | `{ "enabled": true/false }` (never the key) |
| POST | `/api/assistant/chat` | student | `{ courseId, mode: ask/explain/summarize/practice, message, material?, level?, count?, history? }`. Enrolled courses only; 20 requests per 10 minutes per student |

## How security works
- Passwords are hashed with bcrypt (cost 12); the hash is never returned by any endpoint.
- **Roles are enforced on the server** (`requireRole`). Hiding a page in the browser is only for convenience. Public sign-up can never create a privileged account, and `PATCH /auth/me` ignores any `role` field.
- **Ownership is verified in SQL**: an instructor can only touch their own courses, a coordinator only their own opportunities, and someone else's records answer `404`, so ids cannot be probed.
- Login tokens are signed JWTs (HS256) with an expiry. The server identifies the user **only from the verified token**, so students can only read or change their own data.
- All SQL is parameterised. Search text is escaped so `%` and `_` are treated literally. Inputs containing the NUL character are rejected with `400`.
- Application title and company are looked up in the database, never trusted from the browser.
- Rate limits per IP: login (20 **failed** attempts / 15 min, successful logins are not counted so a shared campus network is not locked out), registration (20 / hour), application submissions (30 / 15 min). They are in memory and reset when the server restarts.
- CORS only allows the origins in `CLIENT_ORIGIN`. Error responses contain no stack traces, SQL or secrets.
- Known trade-off: the token is kept in `localStorage`, which scripts on the page could read if the site ever had an XSS bug. React escapes output by default and no user HTML is rendered.

## Testing

**Backend** (needs PostgreSQL running and `backend/.env` filled in; add `SEED_DEMO_ACCOUNTS=true` to also run the role tests; `hub.test.js` covers the hub, organisations, matching and the assistant against a *fake* AI server, so it needs no API key):
```bash
cd backend
npm run test:unit   # no database needed: validation and rate-limiter tests
npm run test:api    # starts its own API on a free port and tests it against your real database
npm test            # both
```
`test:api` creates throw-away users (`@test.campusbridge.local`) and removes them when it finishes. The role tests (`learning.test.js`) cover enrolment, submissions, grading, ownership rules, privilege-escalation attempts, notifications, badges, the coordinator review flow and withdrawal. To test a server that is already running, use `API_URL=http://localhost:5000/api npm run test:api` (that mode skips tests that need direct database access).

**Browser tests (optional).** They drive a real Chrome: `workflow.test.mjs` is the student journey, `roles.test.mjs` covers all three roles working together (student submits, instructor grades, coordinator accepts, notifications, withdrawal, access denied for the wrong role, mobile menu). Start PostgreSQL, the API (with `SEED_DEMO_ACCOUNTS=true`) and the frontend first, then:
```bash
cd e2e
npm install      # downloads Chrome for Puppeteer (large download, one time)
npm test
```
The browser tests leave test data behind (accounts, "ZZ ..." listings, notifications for the demo accounts). **Run `npm run demo:reset` in `backend` afterwards**, and always before a presentation. To remove only the test accounts by hand:
```bash
psql -U postgres -h localhost -d campusbridge -c "DELETE FROM users WHERE email LIKE '%@test.campusbridge.local';"
```
**Production build check:** `npm run build` in the project root.

## Troubleshooting
| Problem | What to do |
|---|---|
| `CampusBridge API cannot start: DATABASE_URL is missing` | You have no `backend/.env`. Copy `backend/.env.example` to `backend/.env` and fill it in. |
| `JWT_SECRET is still the placeholder` | Generate a real secret (command above) and paste it into `.env`. |
| `password authentication failed` | The password in `DATABASE_URL` is wrong. URL-encode special characters (`@` → `%40`, `#` → `%23`). |
| `database "campusbridge" does not exist` | Run the *Create the empty database* step. |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Start the PostgreSQL service. |
| `Port 5000 is already in use` | Another program uses it (on macOS, AirPlay uses 5000). Set `PORT=5001` in `backend/.env` and `VITE_API_BASE_URL=http://localhost:5001/api` in the root `.env`, then restart both. |
| Browser shows "Cannot reach the CampusBridge server" | Start the backend, and check that `CLIENT_ORIGIN` contains the address in your browser's address bar (for example `http://localhost:5173`). |
| Frontend opens on port 5174 instead of 5173 | Port 5173 was busy. Add `http://localhost:5174` to `CLIENT_ORIGIN` and restart the API. |
| Login works then "session expired" appears | The token expired or `JWT_SECRET` changed. Log in again. |
| `429 Too many requests` | Rate limit reached; wait for the time shown, or restart the API in development. |
| Hero photo is missing | It loads from Unsplash and needs internet. The page hides it automatically if it fails. |

## Known limitations
- **No admin screen.** Instructor and coordinator accounts and course ownership are set with `npm run set-role` (or the demo accounts). Courses themselves and their lessons are still defined in `backend/src/data/seed.js`. Instructors can create assignments but not new courses.
- Courses have no video or lesson content: learning is assignment-based (enrol, submit, get graded). No certificates.
- Assignment submissions are text, an optional link, and an optional file (pdf, png, jpg, txt, doc, or docx, up to 5 MB). A student can replace an ungraded submission, including after the deadline (it is marked late). A graded submission cannot be replaced.
- Notifications are in-app only (no email or SMS). They refresh when you change page, not live. The same deadline or matching opportunity is stored only once.
- No password reset or email verification. Rate limiting is in memory (one server only).
- **AI assistant:** needs your own `LLM_API_KEY`. It is stateless (nothing is stored), answers can be wrong (the page says so), and students cannot upload files: they paste text. Each question costs money at your provider, so the per-student limit is deliberately low.
- **Hub content:** the real programmes in the seed (Mastercard Foundation Scholars, Chevening, Tony Elumelu Programme, ICPC, Africa Prize) link only to the organisation's home page and have **no deadline**: their dates and rules change yearly, so students must confirm them on the official page. Entries marked "(sample)" are made up. Nothing checks links or updates deadlines automatically. Restarting the API resets the seeded sample listings to their seed values.
- **Organisations:** anyone can sign up as an organisation, and there is no admin screen to approve or remove them. Unverified organisations can publish (their listings just lack the verified mark). "Department" means the existing *Field of study* profile field. Matching is rule-based (words and a small list of related fields), not machine learning.
- The old browser tests in `e2e/` were written for the original design and have not been run against the new interface.
- Dependency notes: `npm audit` reports advisories in Vite/esbuild (development server only) and React Router 6 (open-redirect advisory that needs user-supplied URLs; CampusBridge only navigates to fixed internal paths). Fixing them needs major upgrades (Vite 8, React Router 7), which have not been done or tested here. Do not expose the Vite dev server to the internet.
- Not deployed anywhere; no Docker, HTTPS or CI. Treat it as a demonstration-quality MVP, not a hardened production system.

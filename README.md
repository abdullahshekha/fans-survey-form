# Fan Retailer Survey

A mobile-first web app for field teams surveying fan retailers across 12 markets in Karachi. Each visit produces one "Fan Quote Form" with shop details, GPS location, photos, customer contact info, fan brand preferences, and optional voice notes. Field reps have their own dashboard to start surveys and review submissions; an admin dashboard provides comprehensive analytics, filtering, export, and geographic visualization across all surveys.

**Full design specification:** [docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md](docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md)

**Repository guidance:** [CLAUDE.md](CLAUDE.md)

## Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (for the local Supabase stack)
- **Supabase CLI** (`npm install -g supabase`)

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the local Supabase stack

```bash
npx supabase start
```

This will output the local API URL, anon key, and service-role key. Copy these values.

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update `.env.local` with the values from step 2:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
REP_EMAIL_DOMAIN=survey.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=test-pass-123
```

### 4. Seed the admin account

```bash
npm run seed:admin
```

This creates the initial admin account using the credentials in `.env.local`. (Seed logins also include `rep.one` and `rep.two`, both with password `test-pass-123`, created by `supabase/seed.sql` and applied automatically.)

### 5. Start the development server

```bash
npm run dev
```

The app is now available at `http://localhost:3000`.

## Seed Logins (Local)

The following accounts are seeded in the local database via `supabase/seed.sql`:

| Username | Password | Role |
|---|---|---|
| `admin` | `test-pass-123` | Admin |
| `rep.one` | `test-pass-123` | Sales Rep |
| `rep.two` | `test-pass-123` | Sales Rep |

Login uses username + password. (Internally, each username maps to a synthetic email `<username>@survey.local` for the Supabase Auth system; no email is ever sent.)

## Testing

### Unit and integration tests

```bash
npm test
```

Runs Vitest tests for validation, form state, image compression, audio handling, and Supabase RLS/RPC integration (requires the local stack).

### Watch mode

```bash
npm test:watch
```

### End-to-end tests

```bash
npm run e2e
```

Runs Playwright tests against the local dev server. Requires:
- Local Supabase stack running (`npm run db:start`)
- Dev server running (`npm run dev` in another terminal)

Tests mock geolocation and file inputs to simulate rep and admin workflows.

## Available npm scripts

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm test                 # Run unit/integration tests
npm run test:watch       # Watch mode for tests
npm run e2e              # Run Playwright E2E tests
npm run db:start         # Start local Supabase (alias: supabase start)
npm run db:reset         # Reset local Supabase database
npm run seed:admin       # Seed the admin account
```

## Repository Structure

```
app/                     Next.js App Router pages and layouts
  login/                 Login page
  dashboard/             Rep dashboard
  survey/                Survey form (new and detail views)
  admin/                 Admin dashboard (overview, surveys, map, users)

components/              Shared UI components

lib/                     Utilities and clients
  supabase/              Server and browser Supabase clients
  constants.ts           Fixed lists (markets, brands, sizes)
  validation.ts          Phone normalization and survey validation rules
  geo.ts                 Geolocation wrapper
  compression.ts         Image compression wrapper
  audio.ts               Voice recording wrapper

supabase/                Database and storage
  migrations/            Database schema, RLS policies, RPC functions
  seed.sql               Development seed data

scripts/                 Build and utility scripts
  seed-admin.ts          Admin account seeding script

tests/                   Test suites
  unit/                  Vitest unit tests
  integration/           Supabase integration tests
  e2e/                   Playwright E2E tests

CLAUDE.md                Repository conventions and guidance
```

For a complete breakdown, see [the design specification §10](docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md#10-repository-layout).

## Environment Variables

All environment variables are defined in `.env.example`:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (secret) |
| `REP_EMAIL_DOMAIN` | Server | Domain for synthetic rep email addresses |
| `ADMIN_USERNAME` | Seed script | Admin account username |
| `ADMIN_PASSWORD` | Seed script | Admin account password |

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` is used only in server actions and route handlers. It is never sent to the browser.

## Key Features

- **Rep dashboard:** View survey count and read-only list of own submissions
- **Admin dashboard:** View all surveys with filters, search, per-rep analytics, and charts
- **Export:** CSV and XLSX export with signed URLs (6-hour expiry)
- **Map:** Geographic visualization of all surveys on OpenStreetMap
- **Form validation:** Phone number normalization, required field validation, photo counts
- **Media handling:** Photo compression in the browser, optional voice note recording
- **Role-based access:** Row-level security (RLS) enforces rep/admin boundaries

## Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for step-by-step deployment instructions to Vercel and Supabase.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript, React)
- **Styling:** Tailwind CSS (mobile-first)
- **Auth:** Supabase Auth (email/password)
- **Database:** Supabase Postgres with RLS
- **File storage:** Supabase Storage (private buckets)
- **Hosting:** Vercel (auto-deploy on Git push)
- **Key libraries:** `@supabase/ssr`, `browser-image-compression`, `react-leaflet`, `recharts`, `xlsx`
- **Testing:** Vitest, Playwright

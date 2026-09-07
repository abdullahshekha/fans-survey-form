# CLAUDE.md

Guidance for working in this repository.

## What this project is

**Fan Retailer Survey** — a mobile-first web app for a field team surveying fan
retailers across 12 markets in Karachi. Each visit produces one "Fan Quote Form"
(shop details, GPS, photos, customer contact, most-selling fan brand, 30W/50W
recommendations, optional voice note). Field reps have a dashboard to start
surveys and review their own submissions; an admin has a dashboard with all
surveys, per-rep counts, filters, export, a map, and comparison charts.

Full design: `docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md`.

## Stack

- **Next.js (App Router, TypeScript, React)** + Tailwind CSS. Mobile-first,
  single-column layouts.
- **Supabase** — Postgres, Auth (email/password), Storage (private buckets
  `survey-photos`, `survey-audio`).
- **Vercel** — deploys from Git; push to `main` auto-deploys.
- Key libs: `@supabase/ssr`, `browser-image-compression`, `react-leaflet` +
  OpenStreetMap, `recharts`, `xlsx`.

## Hard rules

- **Never ship the service-role key to the browser.** `SUPABASE_SERVICE_ROLE_KEY`
  is used only in server actions / route handlers (creating rep accounts, signing
  media URLs, building exports). Client code uses the anon key only.
- **Reps cannot update or delete surveys.** Enforced by RLS, not just UI. Only the
  admin edits or deletes. New rep accounts are created only by the admin.
- **Storage buckets are private.** Media reaches the browser only through
  short-lived signed URLs generated server-side.
- **Fixed lists live in one place** (`lib/constants.ts`) and are mirrored by
  Postgres `CHECK` constraints. Markets: Arambagh, MA Jinnah, Waterpump,
  Bohrapir, Johar Mor, UP, Liaquatabad, Shah Faisal Colony, Orangi Town, Baldia
  Town, Malir, Landhi/Korangi. Brands: Tamoor, Khurshid, SK, GFC, Royal, Pak
  Fans, Lahore Fans.
- **Required survey fields:** shop name, market, shop size, customer name,
  customer number (Pakistani mobile), GPS, front photo, at least one inner photo,
  most-selling fan, `rec_30w_1`, `rec_50w_1`. Everything else is optional.
- **No offline support and no draft autosave.** Submitting needs a live
  connection; a failed submit writes nothing and the rep retries.
- Login is **username + password**. Each rep maps to a synthetic email
  `‹username›@${REP_EMAIL_DOMAIN}` internally.

## Layout

```
app/        login, dashboard, survey/new, survey/[id],
            admin/{overview,surveys,map,users}
components/  shared UI
lib/         supabase clients, constants, validation, geo, compression, audio
supabase/    migrations/, seed.sql
scripts/     seed-admin.ts
tests/       vitest + playwright
```

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | admin API, signed URLs, exports |
| `REP_EMAIL_DOMAIN` | server | synthetic email domain for usernames |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | seed script only | first admin account |

## Development

- Local Supabase: `supabase start` (Docker). Migrations in `supabase/migrations/`.
- Seed the admin: `npx tsx scripts/seed-admin.ts`.
- `npm run dev` — app on `http://localhost:3000`.

## Testing

- **Vitest + React Testing Library** — validation, form state, compression
  wrapper (mocked).
- **Supabase local stack** — RLS policies and the `create_survey` RPC.
- **Playwright** — end-to-end rep and admin flows (mock geolocation + file
  inputs).
- Practise TDD: write the failing test first, then the implementation.

## Conventions

- Match the surrounding code's style, naming, and comment density.
- Keep files focused; a file that has grown large is usually doing too much.
- Server actions and route handlers are the only place secrets or the
  service-role client appear.

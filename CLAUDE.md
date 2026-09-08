# CLAUDE.md

Guidance for working in this repository.

## What this project is

**Fan Retailer Survey** — a mobile-first web app for a field team surveying fan
retailers across 12 markets in Karachi. Each visit produces one "Fan Quote Form"
(shop details, GPS, photos, customer contact, most-selling fan brand, 30W/50W
recommendations, optional voice note). Field reps have a dashboard to start
surveys and review their own submissions; an admin has a dashboard with all
surveys, per-rep counts, filters, CSV/XLSX export, a map, and comparison charts.

- Design spec: `docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md`
- Build plan (28 tasks): `docs/superpowers/plans/2026-09-07-fan-retailer-survey.md`
- Deploy / first-run guide: `docs/DEPLOYMENT.md`

## Status

- **Live on Vercel**, deployed from the `master` branch (every push to `master`
  auto-deploys). Default branch is `master`, not `main`.
- Backed by a hosted Supabase project. Migrations `0001`–`0005` are applied;
  buckets exist and are private; an admin account is seeded.
- **`0006` (rep survey editing) is committed but NOT yet applied to hosted.**
  Apply it via the Supabase SQL Editor (`docs/DEPLOYMENT.md` Step 2c) and
  hand-verify the `update_survey` happy path + a deactivated-rep reject before
  the app code that depends on it ships. The SQL has never run against a real
  Postgres.
- **Verified:** `npm test` (111 unit tests), `npx tsc --noEmit`, `npm run build`,
  and manual end-to-end (rep submits a survey → admin sees it) on the live URL.
- **Not yet run:** `npm run test:integration` and `npm run e2e` — the suites are
  written but have never executed against a real Supabase. Higher value now that
  `0006` adds the `update_survey` RPC and the rep-edit RLS/storage policies.

## Stack

- **Next.js 15.5.x** (App Router, TypeScript, React 19) + Tailwind CSS.
  Mobile-first, single-column layouts. Keep Next on a patched 15.x — Vercel
  blocks deploys of versions with known advisories.
- **Supabase** — Postgres, Auth (email/password), Storage (private buckets
  `survey-photos`, `survey-audio`), the `create_survey` RPC.
- **Vercel** — deploys from Git on push to `master`.
- Key libs: `@supabase/ssr` + `@supabase/supabase-js`, `browser-image-compression`,
  `react-leaflet` **v5** + Leaflet + OpenStreetMap tiles, `recharts`, `xlsx`.
- `.npmrc` sets `legacy-peer-deps=true` (committed on purpose — some transitive
  deps still declare React 18 peers). Safe to drop once they catch up.

## Hard rules

- **Never ship the service-role key to the browser.** `SUPABASE_SERVICE_ROLE_KEY`
  / `createAdminSupabase()` appear only in server-only code: `app/**/actions.ts`,
  `app/admin/**/page.tsx` (server components), `app/admin/surveys/export/route.ts`,
  and `scripts/seed-admin.ts`. Client (`"use client"`) code uses the anon key
  only. `lib/supabase/admin.ts` guards with a `typeof window` throw (no
  `import "server-only"` — it is also imported by the tsx seed script).
- **Reps can edit their own surveys** (all fields, no time limit) at
  `/survey/[id]/edit` → the `update_survey` RPC, which mirrors `create_survey`'s
  guards and stamps `surveys.edited_at`. Enforced at the DB layer:
  `surveys_rep_update` / `survey_photos_rep_{update,delete}` RLS and storage
  `survey_{photos,audio}_rep_{update,delete}` policies, all scoped to
  `rep_id = auth.uid()` / the caller's own object prefix and all re-checking
  `profiles.active`. Reps still **cannot** touch another rep's data, reassign
  `rep_id`, or **delete a survey** — only the admin deletes.
- **Deactivating a rep must bind at the DB layer.** `surveys_rep_insert` checks
  `profiles.active`; `is_admin()` checks `active`; middleware re-checks every
  request. Do not weaken any of these.
- **Storage buckets are private.** Media reaches the browser only through
  short-lived signed URLs (`SIGNED_URL_TTL`, 6h) generated server-side. Never
  build a public storage URL.
- **Fixed lists live in one place** (`lib/constants.ts`) and are mirrored by
  Postgres `CHECK` constraints. Markets: Arambagh, MA Jinnah, Waterpump,
  Bohrapir, Johar Mor, UP, Liaquatabad, Shah Faisal Colony, Orangi Town, Baldia
  Town, Malir, Landhi/Korangi. Brands: Tamoor, Khurshid, SK, GFC, Royal, Pak
  Fans, Lahore Fans, plus the free-text `"Other"` option. A brand field may hold
  the literal `'Other'`, in which case its companion `<field>_other` column
  holds the typed name (trimmed, 1–`MAX_OTHER_BRAND_LEN` = 40 chars, required
  when the field is `'Other'`). Exports: `OTHER_BRAND`, `BRAND_SELECT_OPTIONS`.
  Shop sizes: Small, Medium, Large.
- **Required survey fields:** shop name, market, shop size, customer name,
  customer number (Pakistani mobile `03XXXXXXXXX`), GPS, one front photo, 1–10
  inner photos, most-selling fan, `rec_30w_1`, `rec_50w_1`. Everything else
  (both `rec_*_2`, voice note, quotation photos) is optional. Quotation photos:
  0–`MAX_QUOTATION_PHOTOS` = 2, stored as `survey_photos.kind = 'quotation'`.
  An uploaded voice note (alternative to recording) must be an audio MIME type ≤
  `MAX_AUDIO_UPLOAD_MB` (25 MB); enforced client-side (`validateAudioUpload`) and
  by the `survey-audio` bucket's `file_size_limit` / `allowed_mime_types`.
- **No offline support and no draft autosave.** Submitting needs a live
  connection; a failed submit writes nothing and the rep retries.
- Login is **username + password**. Each account maps to a synthetic email
  `‹username›@${REP_EMAIL_DOMAIN}` internally; no email is ever sent.
- **Admin dashboard queries run unpaged** (`all: true`). The hosted Supabase
  project's **API → Max Rows** must be raised (set to 100000) or export /
  overview / map silently truncate at 1000.

## Layout

```
app/        login, dashboard, survey/new, survey/[id], survey/[id]/edit,
            admin/{overview,surveys,map,users,housekeeping}, admin/surveys/export
components/  shared UI + form/SurveyFields + form/SurveyEditForm + admin/
lib/         supabase clients, constants, validation, geo, compression, audio,
            adminQueries, aggregations, exportSurveys, submitSurvey, updateSurvey,
            uploadEditedMedia, upload,
            format (date + `brandDisplay` — folds an `'Other'` brand's typed name)
middleware.ts  auth + role + active-account route protection
supabase/   migrations/ (0001–0006), seed.sql (local dev only), config.toml
scripts/    seed-admin.ts
tests/      unit/ (vitest, run), integration/ + e2e/ (authored, not yet run)
```

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server (Vercel) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server (Vercel) | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** (Vercel) | admin API, signed URLs, exports, seed script |
| `REP_EMAIL_DOMAIN` | server (Vercel) | synthetic email domain for usernames |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | **local `.env.local` only** — never in Vercel | first admin account, read by `npm run seed:admin` |

Local dev reads `.env.local` (git-ignored). `npm run dev` loads it automatically;
`npm run seed:admin` loads it via `--env-file`.

## Development

- `npm install`, then `npm run dev` — app on `http://localhost:3000`.
- Point `.env.local` at either the hosted Supabase project or a local stack.
- Local stack: `npm run db:start` (`supabase start`, needs Docker) then
  `npm run db:reset` (applies migrations + `supabase/seed.sql` test users
  `admin` / `rep.one` / `rep.two`, password `test-pass-123`).
- Seed a real admin against whatever `.env.local` points to: `npm run seed:admin`
  (idempotent — re-run to reset the password).
- **Migrations `0002`–`0004` were edited in place before first deploy;** `0005`
  (Survey Form v2) is idempotent-guarded (`if [not] exists`). `0006` (rep survey
  editing) is idempotent-guarded (`add column if not exists`, `drop policy if
  exists` before each `create policy`, `create or replace function`). For any
  further schema change add a new numbered migration (e.g., `0007_*.sql`) — do
  not edit an applied file. Migrations are append-only.
- **`0005` was applied to hosted via the Supabase SQL Editor,** which does not
  record it in `supabase_migrations.schema_migrations`. Before ever running
  `supabase db push` against the hosted project, insert that row (see
  `docs/DEPLOYMENT.md` Step 2b) or `db push` will re-run `0005`.

## Testing

- `npm test` — Vitest unit suite (jsdom, mocked). Must stay green. `tests/e2e`
  is excluded from both `npm test` and `tsc`.
- `npm run test:integration` — Vitest against a **running local Supabase**
  (`supabase start` first); covers RLS policies, the `create_survey` RPC, and
  storage-policy behaviour. Run it before `npm run e2e`, and `npm run db:reset`
  between them (a few integration tests wipe `surveys`).
- `npm run e2e` — Playwright, full rep→admin flow (mocked geolocation + file
  inputs); needs the local stack + dev server.
- TDD: write the failing test first, then the implementation.
- `npm run build` must succeed; the only allowed warnings are the two
  `@next/next/no-img-element` on blob/signed-URL `<img>` thumbnails
  (`PhotoCapture.tsx`, `MediaGallery.tsx`) — those are intentional.

## Known follow-ups (non-blocking)

- Run the integration + e2e suites once against a local Supabase. Higher value
  now that `0005` is live — it is the only thing that exercises the `*_other`
  pairing CHECKs and the `create_survey` `v_quotation` guard.
- `resetRepPassword` server action exists but has no UI button in the Users tab.
- Survey Form v2 polish: brand validation errors are generic ("Select a brand" /
  "Invalid brand") rather than field-specific; no test pins that an exactly
  40-char "Other" name passes; `PhotoCapture` shares one notice/`busy` between
  inner and quotation photos.
- react-leaflet was upgraded 4→5; the maps render but a fresh browser check of
  `/admin/map` and `/survey/new` after any Leaflet-related change is worthwhile.
- `supabase/config.toml` is minimal/hand-written; regenerate with `supabase init`
  in a scratch dir if `supabase start` ever rejects it.
- `supabase/seed.sql`'s `auth.users` insert may need more columns on newer
  GoTrue — see `docs/DEPLOYMENT.md`.

## Conventions

- Match the surrounding code's style, naming, and comment density.
- Keep files focused; a file that has grown large is usually doing too much.
- Server actions, route handlers, server components, and `scripts/` are the only
  places the service-role client appears.
- Conventional Commits. Add new schema as numbered migrations, never by editing
  an applied one.

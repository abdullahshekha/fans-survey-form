# Fan Retailer Survey — Design Spec

**Date:** 2026-09-07
**Status:** Approved for planning

## 1. Purpose

A field team visits fan retailers across 12 markets in Karachi. At each shop a
rep fills one "Fan Quote Form" on their phone. The app must:

- Let a rep log in, complete a survey (with one-tap GPS, camera/gallery photos,
  and an optional in-app voice note), and submit it.
- Give each rep a dashboard showing their total survey count and a read-only list
  of their own submissions.
- Give an admin a dashboard with every survey, per-rep counts, filtering, search,
  spreadsheet export, a map of all surveys, and comparison charts.
- Deploy to Vercel from a Git repository, using Supabase for auth, database, and
  file storage.

## 2. Scope

### In scope

- Username/password login, no public sign-up.
- One admin account seeded at deploy; admin creates all rep accounts.
- Survey form with all fields from the source document.
- Rep dashboard and admin dashboard as described below.
- CSV + XLSX export, Leaflet map, Recharts bar charts.
- Row Level Security enforcing the rep/admin boundary.

### Out of scope

- Offline use and draft autosave. Submitting requires connectivity; a failed
  submit writes nothing.
- Editing or deleting surveys by reps (admin only).
- Multi-admin management UI (additional admins are added in code/seed).
- Push notifications, in-app messaging, and localization (English only for now).
- Duplicate-shop detection.

## 3. Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript, React) |
| Styling | Tailwind CSS, mobile-first single-column |
| Auth | Supabase Auth (email/password) via `@supabase/ssr` |
| Database | Supabase Postgres |
| File storage | Supabase Storage — private buckets `survey-photos`, `survey-audio` |
| Hosting | Vercel, auto-deploy on push to `main` |
| Photo compression | `browser-image-compression` |
| Voice notes | `MediaRecorder` API (no library) |
| Maps | `react-leaflet` + OpenStreetMap tiles (no API key) |
| Charts | `recharts` |
| Export | `xlsx` for Excel, native string build for CSV |

### Security boundary

- The browser receives only `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is used exclusively in server actions / route
  handlers: creating rep auth accounts, generating signed media URLs, and
  building exports.
- Storage buckets are private. Media is shown in the browser only through
  short-lived signed URLs created server-side.

## 4. Data model

Fixed lists are defined once in `lib/constants.ts` and mirrored by Postgres
`CHECK` constraints.

- **Markets (12):** Arambagh, MA Jinnah, Waterpump, Bohrapir, Johar Mor, UP,
  Liaquatabad, Shah Faisal Colony, Orangi Town, Baldia Town, Malir,
  Landhi/Korangi.
- **Brands (7):** Tamoor, Khurshid, SK, GFC, Royal, Pak Fans, Lahore Fans.
- **Shop sizes (3):** Small, Medium, Large.

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | references `auth.users(id)` on delete cascade |
| `username` | text unique not null | rep's login name |
| `full_name` | text not null | |
| `role` | text not null | `CHECK (role IN ('admin','rep'))`, default `'rep'` |
| `active` | boolean not null | default `true`; inactive reps cannot log in |
| `created_at` | timestamptz | default `now()` |

### `surveys`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | generated client-side; default `gen_random_uuid()` |
| `rep_id` | uuid not null | references `profiles(id)` |
| `shop_name` | text not null | |
| `market` | text not null | `CHECK` against the 12 markets |
| `shop_size` | text not null | `CHECK` against the 3 sizes |
| `customer_name` | text not null | |
| `customer_number` | text not null | normalized Pakistani mobile `03XXXXXXXXX` |
| `gps_lat` | double precision not null | |
| `gps_lng` | double precision not null | |
| `gps_accuracy` | double precision | metres, as reported by the device |
| `most_selling_fan` | text not null | `CHECK` against the 7 brands |
| `rec_30w_1` | text not null | `CHECK` against the 7 brands |
| `rec_30w_2` | text | nullable; `CHECK` against the 7 brands |
| `rec_50w_1` | text not null | `CHECK` against the 7 brands |
| `rec_50w_2` | text | nullable; `CHECK` against the 7 brands |
| `audio_path` | text | nullable; storage path of the voice note |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()`; set on admin edit |

### `survey_photos`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `survey_id` | uuid not null | references `surveys(id)` on delete cascade |
| `kind` | text not null | `CHECK (kind IN ('front','inner'))` |
| `storage_path` | text not null | path in `survey-photos` |
| `sort_order` | int not null | default `0`; display order for inner photos |

Constraint: exactly one `front` row and 1–10 `inner` rows per survey (enforced in
the `create_survey` RPC and re-checked in the form).

## 5. Authentication and roles

- **Login screen:** Username + Password. The client resolves username to the
  synthetic email `‹username›@${REP_EMAIL_DOMAIN}` before calling Supabase Auth.
- **Admin seed:** `scripts/seed-admin.ts` uses the service-role key to create the
  auth user from `ADMIN_USERNAME` / `ADMIN_PASSWORD` and insert a `profiles` row
  with `role = 'admin'`. Idempotent (safe to re-run).
- **Rep creation:** admin submits username + full name + password in the Users
  tab. A server action creates the auth user (service role), then the `profiles`
  row with `role = 'rep'`.
- **Inactive reps:** setting `active = false` blocks login (checked in middleware
  after session load) and hides the rep from the "Add survey as" flows; their
  existing surveys remain.
- **Route protection (Next.js middleware):**
  - No session → redirect to `/login`.
  - Session with `role = 'rep'` → may access `/dashboard`, `/survey/*`.
  - `/admin/*` → requires `role = 'admin'`; reps get 403 → redirect to
    `/dashboard`.

### Row Level Security

| Table | Rep | Admin |
|---|---|---|
| `profiles` | select own row | select / insert / update all |
| `surveys` | `insert` where `rep_id = auth.uid()`; `select` own | select / update / delete all |
| `survey_photos` | `insert` / `select` where parent survey is theirs | select / update / delete all |

- Reps have **no** `update` or `delete` policy on `surveys` or `survey_photos`.
- `storage.objects` policies: a rep may write and read objects whose path begins
  `‹their uid›/`; admin may read all. All client reads of media still go through
  server-generated signed URLs (the bucket is private).

### `create_survey` RPC

`create_survey(payload jsonb) returns uuid`, `SECURITY INVOKER` (RLS applies).
Inserts the `surveys` row and all `survey_photos` rows in one transaction,
validating: required fields present, `market` / `shop_size` / brand values in
range, exactly one `front` photo, 1–10 `inner` photos, phone matches the
normalized pattern. Any failure rolls back the whole insert.

## 6. Survey form (`/survey/new`)

One scrollable mobile form with grouped sections and a sticky Submit bar. A
`beforeunload` / route-change guard warns when the form is dirty. No offline
handling, no draft persistence.

### Fields

| Field | Control | Required | Validation |
|---|---|---|---|
| Shop name | text | yes | non-empty |
| Location (GPS) | "Capture location" button | yes | `navigator.geolocation`; stores lat, lng, accuracy; shows a map preview + "Recapture" |
| Market | native `<select>` | yes | one of 12 |
| Shop size | native `<select>` | yes | Small / Medium / Large |
| Customer name | text | yes | non-empty |
| Customer number | tel | yes | Pakistani mobile: accepts `03XXXXXXXXX` or `+923XXXXXXXXX`, stored as `03XXXXXXXXX` |
| Picture (front) | file input, `capture="environment"` + "Choose from gallery" | yes | exactly 1 image |
| Pictures (inner) | file input (multi), camera + gallery | yes | 1–10 images |
| Most selling fan | native `<select>` | yes | one of 7 brands |
| 30W — Recommend 1 | native `<select>` | yes | one of 7 brands |
| 30W — Recommend 2 | native `<select>` | no | one of 7 brands |
| 50W — Recommend 1 | native `<select>` | yes | one of 7 brands |
| 50W — Recommend 2 | native `<select>` | no | one of 7 brands |
| Pak Fan Comments | voice recorder | no | record / stop / playback / re-record / delete; ~120 s cap |

### Photo handling

- Two entry points per photo slot: "Take photo" (`capture="environment"`) and
  "Choose from gallery" (no `capture`).
- Each selected image is compressed with `browser-image-compression` to
  ~1600 px longest edge / ~500 KB before upload.
- Thumbnail grid with per-image remove. Inner photos are reorderable
  (`sort_order`).

### Voice note

- `MediaRecorder` with `audio/webm` (fallback `audio/mp4` on Safari). Shows a
  running timer, hard stop at ~120 s. Playback element + "Record again" and
  "Delete".

### Submit flow

1. Client validates all required fields and counts.
2. Generate the survey `id` (uuid v4) client-side.
3. Compress photos; upload every photo to
   `survey-photos/‹repUid›/‹surveyId›/front-*.jpg | inner-‹n›.jpg` and, if
   present, the audio to `survey-audio/‹repUid›/‹surveyId›/comment.webm`.
4. Call `create_survey(payload)` with the survey fields + photo path list +
   audio path.
5. On any upload or RPC failure: show an error, keep the form populated, write
   nothing to the database. The rep retries. (Orphaned storage objects from a
   failed attempt are overwritten on retry — same deterministic paths — and
   swept by a periodic admin cleanup, see §9.)
6. On success → redirect to `/dashboard` with a confirmation toast.

## 7. Rep dashboard (`/dashboard`)

- Header: greeting with `full_name`.
- **Total survey count** shown large.
- Primary **"New Survey"** button → `/survey/new`.
- **"My submissions"**: list of the rep's own surveys (shop name, market,
  relative date, front-photo thumbnail), newest first, paginated. Row →
  `/survey/[id]`.
- **`/survey/[id]` (read-only):** all fields, photo gallery (signed URLs), audio
  player if present, and a Leaflet mini-map with the captured pin. A rep may open
  only their own survey; the admin may open any.

## 8. Admin dashboard (`/admin`)

Tabbed: Overview, Surveys, Map, Users.

### Overview

- Stat tiles: total surveys, active reps, markets covered (distinct markets with
  ≥1 survey).
- Bar chart — **shop count by market** (x: 12 markets, y: survey count).
- Bar chart — **survey count by rep**.
- Bar chart — **most-selling-fan counts** (x: 7 brands, y: number of surveys
  naming that brand as most-selling).
- Bar chart — **recommended-brand counts**: for each of the 7 brands, the number
  of times it appears across `rec_30w_1`, `rec_30w_2`, `rec_50w_1`, `rec_50w_2`
  (all four columns combined, nulls ignored).
- All charts respect the same filter bar as the Surveys tab (see below) when the
  admin sets one; default is all-time, all markets, all reps.

### Surveys

- Filter bar: market (select), rep (select), date range (from / to); text search
  over shop name and customer name.
- Table: date, rep, shop, market, size, most-selling fan, thumbnail. Sortable by
  date and rep. Paginated. Row → `/survey/[id]`.
- **Export** (current filtered set) → CSV and XLSX. Columns: every survey scalar
  field, `rep username`, `gps_lat`, `gps_lng`, a Google Maps link, and one
  signed-URL column per photo plus the audio URL. Signed URLs are generated in
  the export server action with a multi-hour expiry; the file notes the expiry.

### Map

- Leaflet map centred on Karachi. One marker per survey in the current filter
  set, coloured by market (12-colour legend). Marker popup: shop name, rep, date,
  link to detail. Clusters when markers overlap.

### Users

- Table of reps: username, full name, survey count, `active` toggle.
- **Add user** form: username (unique, lowercase, no spaces), full name,
  password. Server action creates the auth user + `profiles` row.
- Row actions: activate / deactivate, reset password (server action sets a new
  password via the admin API).
- The admin's own row is not listed here.

## 9. Housekeeping

- **Deleting a survey** (admin): a server action deletes the storage objects
  under `‹repUid›/‹surveyId›/` in both buckets, then deletes the `surveys` row
  (`survey_photos` cascade).
- **Orphan sweep:** an admin-only "Clean up orphaned files" action lists storage
  objects whose `‹surveyId›` has no matching `surveys` row and deletes them.
  Covers files left by failed submit attempts.

## 10. Repository layout

```
app/
  login/
  dashboard/
  survey/new/
  survey/[id]/
  admin/
    overview/  surveys/  map/  users/
components/
lib/
  supabase/        server + browser clients, middleware helper
  constants.ts     markets, brands, sizes
  validation.ts    phone, required-field, count rules (shared client + RPC parity)
  geo.ts           geolocation wrapper
  compression.ts   image compression wrapper
  audio.ts         MediaRecorder wrapper
supabase/
  migrations/      schema, RLS policies, create_survey RPC, storage policies
  seed.sql
scripts/
  seed-admin.ts
tests/
  unit/            vitest
  e2e/             playwright
CLAUDE.md
docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md
```

## 11. Environment variables

| Name | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | admin API, signed URLs, exports |
| `REP_EMAIL_DOMAIN` | server | synthetic email domain for usernames |
| `ADMIN_USERNAME` | seed script | first admin username |
| `ADMIN_PASSWORD` | seed script | first admin password |

## 12. Testing strategy

- **Vitest + React Testing Library** — `validation.ts` (phone normalization,
  required-field and photo-count rules), form state machine, compression and
  audio wrappers (mocked browser APIs).
- **Supabase local stack** (`supabase start`) — RLS policy tests (rep cannot
  update/delete, rep cannot read another rep's survey, admin can), and
  `create_survey` RPC success + rollback cases.
- **Playwright E2E** — rep logs in, completes a survey with mocked geolocation
  and file inputs, sees it on `/dashboard`; admin logs in, sees it in the table,
  filters by market, opens the detail view, runs an export; admin creates and
  deactivates a rep.
- TDD: failing test first, then implementation, per feature.

## 13. Deployment

1. Create the Supabase project; apply `supabase/migrations/`.
2. Create the two private storage buckets and their policies (in migrations).
3. Set env vars in Vercel (all except the two seed vars) and run
   `scripts/seed-admin.ts` once locally against the production project.
4. Connect the Git repo to Vercel; push to `main` deploys.

## 14. Open items / assumptions

- `REP_EMAIL_DOMAIN` is a non-routable placeholder (e.g. `survey.local`); no
  email is ever sent, so password reset is admin-driven only.
- Signed-URL expiry for exports defaults to 6 hours (revisit if too short for the
  admin's workflow).
- Karachi map default centre/zoom: approx `24.86, 67.02`, zoom 11.

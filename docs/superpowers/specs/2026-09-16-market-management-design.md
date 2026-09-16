# Admin-Managed Markets (Add/Rename) — Design

- **Date:** 2026-09-16
- **Status:** Approved for implementation planning
- **Scope:** Let the admin add new markets and rename existing ones from the
  dashboard, without editing code or shipping a new hardcoded migration every
  time the field team expands into a new market.

## Summary

Markets currently live as a hardcoded 12-entry array (`lib/constants.ts`)
mirrored by an inline Postgres `CHECK` constraint on `surveys.market`. This
design moves markets into a `public.markets` table that the admin can `insert`
(add) and `update` (rename) from a new section on the Housekeeping page.
Renaming is **retroactive** — it updates the one row in `markets`, and every
survey referencing it (past and future) reflects the new name automatically,
via a foreign key with `on update cascade`. **Deleting a market is out of
scope** — there is no delete UI, and the DB itself refuses to delete a market
that's in use (`on delete restrict`).

## Motivation

- The field team is expanding into new Karachi markets faster than the code
  can be redeployed for each one; today adding a market means a new migration,
  a `lib/constants.ts` edit, a redeploy.
- A market name typo or a locally-preferred spelling change (e.g. "UP" →
  "University Road") currently requires either living with it forever or a
  one-off `UPDATE ... WHERE market = 'UP'` run by hand against production,
  with no UI trail.

## Out of scope (YAGNI)

- **Deleting a market.** Not built. The FK's `on delete restrict` means the
  database itself blocks deleting a market with surveys attached, so this is
  safe by construction even without app-level guard rails. An admin who adds a
  market by mistake can rename it to something usable, or (if it truly has
  zero surveys) delete the row directly via the Supabase dashboard.
- **Per-market metadata beyond name/color/order** (e.g. a market description,
  geographic bounds, active/inactive toggle). Not requested.
- **Reordering markets in the UI.** `sort_order` is assigned once at seed time
  and continues incrementing for new markets (append to the end); no drag-to-
  reorder control.
- **Custom color picking.** Colors auto-assign from a fixed palette; no color
  picker in this iteration (see §2).
- **Audit trail for renames.** No history table — same posture as the rest of
  the app (surveys' own edit history is just a timestamp, not a log).

---

## 1. Database — migration `0007_markets_table.sql`

New numbered migration, **append-only**. Every statement idempotent-guarded
(`create table if not exists`, `on conflict do nothing`, `drop constraint /
policy if exists` before recreating), matching the `0005`/`0006` convention.

### 1.1 Table

```sql
create table if not exists public.markets (
  name text primary key,
  color text not null,
  sort_order int not null,
  created_at timestamptz not null default now()
);

insert into public.markets (name, color, sort_order) values
  ('Arambagh', '#e6194b', 1),
  ('MA Jinnah', '#3cb44b', 2),
  ('Waterpump', '#e6a700', 3),
  ('Bohrapir', '#4363d8', 4),
  ('Johar Mor', '#f58231', 5),
  ('UP', '#911eb4', 6),
  ('Liaquatabad', '#009fb0', 7),
  ('Shah Faisal Colony', '#f032e6', 8),
  ('Orangi Town', '#7a9a01', 9),
  ('Baldia Town', '#c26f9d', 10),
  ('Malir', '#469990', 11),
  ('Landhi/Korangi', '#9a6324', 12)
on conflict (name) do nothing;
```

### 1.2 `surveys.market`: CHECK → FK

```sql
alter table public.surveys drop constraint if exists surveys_market_check;

alter table public.surveys drop constraint if exists surveys_market_fkey;
alter table public.surveys
  add constraint surveys_market_fkey
  foreign key (market) references public.markets(name)
  on update cascade
  on delete restrict;
```

`on update cascade` is what makes a rename retroactive: updating
`markets.name` propagates to every `surveys.market` value pointing at it in
the same transaction. `on delete restrict` blocks deleting a market row while
any survey references it — the enforced-in-DB equivalent of "no delete UI."

### 1.3 RLS

```sql
alter table public.markets enable row level security;

drop policy if exists markets_select on public.markets;
create policy markets_select on public.markets
  for select to authenticated
  using (true);

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_write on public.markets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

Any authenticated user (rep or admin) can read the list — reps need it for the
survey-form dropdown. Only `is_admin()` can `insert`/`update`/`delete` (the
`for all` policy covers all three, even though the app never issues a
`delete`; this keeps the policy set simple and the DB-level `on delete
restrict` is the actual delete guard).

### 1.4 `supabase/seed.sql`

Add the same 12 `insert ... on conflict do nothing` rows so `npm run db:reset`
seeds `markets` for local dev and the integration/e2e suites.

---

## 2. Auto-color assignment

`lib/constants.ts` keeps a static, ordered palette (extends the current 12
hex values with a handful more so a couple dozen markets stay visually
distinct before colors repeat):

```ts
export const MARKET_COLOR_PALETTE = [
  "#e6194b", "#3cb44b", "#e6a700", "#4363d8", "#f58231", "#911eb4",
  "#009fb0", "#f032e6", "#7a9a01", "#c26f9d", "#469990", "#9a6324",
  "#000075", "#808000", "#aaffc3", "#ffd8b1", "#808080", "#fabed4",
] as const;
```

When `addMarket` inserts a new row, its color is
`MARKET_COLOR_PALETTE[currentMarketCount % MARKET_COLOR_PALETTE.length]`
(`currentMarketCount` = `select count(*) from markets` at insert time, done
server-side in the same action). Colors may repeat once the palette is
exhausted — acceptable; nothing depends on global color uniqueness.

`MAX_MARKET_NAME_LEN = 40` also lives in `lib/constants.ts` (same convention
as `MAX_OTHER_BRAND_LEN`).

---

## 3. Admin actions — `app/admin/housekeeping/actions.ts`

Same shape as the existing `sweepOrphans` (admin-gated via `assertAdmin()`,
`createAdminSupabase()` service-role client):

```ts
export async function addMarket(name: string): Promise<void> {
  await assertAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Market name is required");
  if (trimmed.length > MAX_MARKET_NAME_LEN)
    throw new Error(`Market name must be ${MAX_MARKET_NAME_LEN} characters or fewer`);

  const db = createAdminSupabase();
  const { count } = await db.from("markets").select("*", { count: "exact", head: true });
  const { data: existing } = await db.from("markets").select("name").ilike("name", trimmed);
  if (existing?.length) throw new Error("A market with that name already exists");

  const color = MARKET_COLOR_PALETTE[(count ?? 0) % MARKET_COLOR_PALETTE.length];
  const { error } = await db.from("markets").insert({ name: trimmed, color, sort_order: (count ?? 0) + 1 });
  if (error) throw new Error("Could not add market");
}

export async function renameMarket(oldName: string, newName: string): Promise<void> {
  await assertAdmin();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Market name is required");
  if (trimmed.length > MAX_MARKET_NAME_LEN)
    throw new Error(`Market name must be ${MAX_MARKET_NAME_LEN} characters or fewer`);

  const db = createAdminSupabase();
  if (trimmed.toLowerCase() !== oldName.toLowerCase()) {
    const { data: existing } = await db.from("markets").select("name").ilike("name", trimmed);
    if (existing?.length) throw new Error("A market with that name already exists");
  }

  const { error } = await db.from("markets").update({ name: trimmed }).eq("name", oldName);
  if (error) throw new Error("Could not rename market");
}
```

The case-insensitive uniqueness check is an application-level courtesy (clear
error message); `markets.name` being the primary key is the DB-level
backstop for exact-match collisions.

---

## 4. Admin UI — Housekeeping page

`app/admin/housekeeping/page.tsx` becomes an **async server component** (it
is currently a static component with no data fetch) and adds a "Markets"
section above or below the existing storage-sweep section:

```tsx
export default async function HousekeepingPage() {
  const db = createAdminSupabase();
  const { data: markets } = await db.from("markets").select("name, color").order("sort_order");
  return (
    <div className="flex flex-col gap-8">
      <MarketsSection markets={markets ?? []} />
      <div>
        <h2 className="text-base font-semibold">Storage housekeeping</h2>
        <p className="text-sm text-slate-500">...</p>
      </div>
      <SweepButton />
    </div>
  );
}
```

New `components/admin/MarketsSection.tsx` (`"use client"`):

- Lists current markets: a color swatch + name per row, in `sort_order`.
- Each row has an inline rename: click "Rename" → row becomes a text input
  pre-filled with the current name + "Save"/"Cancel"; calls `renameMarket`.
- An "Add market" text input + button at the bottom; calls `addMarket`.
- Both actions: disable the control while pending, surface the thrown error
  message via the existing `useToast()` pattern, and `router.refresh()` (or
  local optimistic state) on success so the list updates without a full
  reload.

---

## 5. Threading the dynamic list through the app

`lib/constants.ts`: remove `MARKETS`, `Market` type, `MARKET_COLORS`. Add
`MARKET_COLOR_PALETTE` and `MAX_MARKET_NAME_LEN` (§2).

`lib/types.ts` / `lib/queries.ts`: `Market` type alias becomes `string`
(or the field is typed `string` directly and the alias is dropped — decided
during implementation, whichever reads cleaner at each call site).

Every current static-import consumer switches to taking markets as data:

| File | Change |
|---|---|
| `app/admin/surveys/page.tsx` | Server-fetch `markets` (name only, alphabetical or `sort_order`) alongside the existing `reps` fetch; pass to `SurveyFilterBar`. |
| `components/admin/SurveyFilterBar.tsx` | Take `markets: string[]` prop instead of importing `MARKETS`. |
| `app/admin/map/page.tsx` | Server-fetch `markets` (`name`, `color`); pass to `SurveysMap`. |
| `components/SurveysMap.tsx` | Take `markets: { name: string; color: string }[]` prop; build the color lookup and legend from it instead of `MARKET_COLORS`/`MARKETS`. |
| `app/admin/overview/page.tsx` | Server-fetch `markets` (`name`, ordered); pass market names into `countByMarket(surveys, marketNames)`. |
| `lib/aggregations.ts` | `countByMarket(surveys, markets: string[])` takes the ordered name list as a parameter instead of importing `MARKETS`. |
| `app/admin/housekeeping/page.tsx` | Server-fetch `markets` (`name`, `color`) for `MarketsSection` (§4). |
| `app/survey/new/page.tsx` | Split like `/survey/[id]/edit`: new server `page.tsx` fetches `markets` via `createServerSupabase()` and renders a renamed client component (`NewSurveyClient`) that takes `markets: string[]` as a prop and is otherwise today's `NewSurveyPage` body. |
| `app/survey/[id]/edit/page.tsx` | Server-fetch `markets`; pass through to `EditClient` → `SurveyEditForm`. |
| `components/form/SurveyForm.tsx` / `SurveyEditForm.tsx` | Take `markets: string[]` prop; pass to `SurveyFields` and to `validateSurvey`/`validateSurveyEdit`. |
| `components/form/SurveyFields.tsx` | Take `markets: string[]` prop instead of importing `MARKETS`; pass as `options` to the market `SelectField`. |
| `lib/validation.ts` | `validateSurvey(v, markets: readonly string[])` and `validateSurveyEdit(v, counts, markets: readonly string[])` — the market-membership check uses the passed-in list instead of the static import. |

All of these server-side fetches are small (`select name` / `select name,
color`, ≤ a few dozen rows) and unpaged, consistent with the rest of the
admin dashboard's `all: true` posture.

---

## 6. Testing

### 6.1 Unit (`npm test` — must stay green)

- `constants.test.ts`: drop the `MARKETS`/`MARKET_COLORS` assertions; add
  coverage for `MARKET_COLOR_PALETTE` (non-empty, all valid hex) and
  `MAX_MARKET_NAME_LEN`.
- `aggregations.test.ts`: `countByMarket(surveys, markets)` — update the call
  site to pass an explicit markets array; same ordering/zero-fill behavior.
- New `housekeeping-actions.test.ts` (mocked admin Supabase client, mirroring
  the existing `sweepOrphans` test pattern): `addMarket` trims, rejects blank
  and > 40 chars, rejects a case-insensitive duplicate, assigns the palette
  color at `count % length`; `renameMarket` trims, rejects blank/too-long,
  rejects a duplicate (excluding a no-op rename to the same name in a
  different case), calls `update` with the right `eq`.
- `validateSurvey` / `validateSurveyEdit`: update call sites to pass a markets
  array fixture; unchanged pass/fail behavior otherwise.
- `SurveyFields`, `SurveyFilterBar`: update to pass a `markets` prop fixture.

### 6.2 Integration (`npm run test:integration` — local Supabase; still in the
"authored, not yet run" set per `CLAUDE.md`; not a blocker for merging this
feature, same posture as prior work)

- Renaming a market updates `surveys.market` for existing rows referencing it
  (insert a survey, rename the market as admin, re-select the survey, assert
  the new name).
- A rep (non-admin) `insert`/`update` on `markets` is denied by RLS.
- Deleting a `markets` row that has a survey referencing it fails with a
  foreign-key violation (`on delete restrict`).
- A rep can `select` from `markets` (needed for the form dropdown).

### 6.3 e2e (`npm run e2e` — Playwright, local stack)

- Admin adds a market on Housekeeping, then a rep sees it in the `/survey/new`
  market dropdown.
- Admin renames a market; the admin surveys list filter and an existing
  survey's displayed market both reflect the new name.

### 6.4 Gates

`npm test`, `npx tsc --noEmit`, `npm run build` all pass. No new build
warnings beyond the two existing intentional `@next/next/no-img-element`
waivers.

---

## 7. Docs

### `CLAUDE.md`

- **Hard rules** — rewrite the "Fixed lists live in one place" bullet:
  markets move from `lib/constants.ts` + a Postgres `CHECK` to a
  `public.markets` table (admin-managed via Housekeeping, RLS: any
  authenticated `select`, admin-only write, DB-enforced `on delete restrict`,
  rename cascades via `on update cascade`). Brands and shop sizes are
  unchanged (still the hardcoded-array-plus-`CHECK` pattern).
- **Layout** — add `components/admin/MarketsSection.tsx`; note
  `app/admin/housekeeping/page.tsx` is now an async server component.
- **Migrations** — note `0007_markets_table.sql` (idempotent-guarded);
  update the "Migrations `0001`–`0006` are applied" line to `0001`–`0007`
  once shipped, and note whether `0007` is applied via SQL Editor (like
  `0005`/`0006`) or `supabase db push`, per however it's actually deployed.
- **Testing** — refresh the unit-test count after implementation.
- Leave the existing **Known follow-up** about the `0007` active-check RLS
  gap as-is but renumber it, since this design's migration now claims
  `0007` — that follow-up becomes `0008` (update the note accordingly, or
  fold the active-check fix into this same migration file if it lands
  first; decide at implementation time based on merge order).

### `docs/DEPLOYMENT.md`

- Add `0007` to the migration list, with the same hosted-deploy caveat as
  `0005`/`0006` if it's applied via the SQL Editor rather than `db push`.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `on update cascade` silently rewrites historical data — if that's ever *not* wanted for a specific case, there's no per-rename opt-out | This is the explicitly chosen, approved behavior (§ decision in brainstorming); flagged here so it's not a surprise later. |
| A market name collides case-insensitively but not exactly (`"UP"` vs `"up"`) and slips past the app-level check into a DB-level exact-match allow | `ilike` check in both `addMarket`/`renameMarket` catches this before the insert/update; primary key still blocks exact duplicates as a backstop. |
| Splitting `survey/new/page.tsx` into a server wrapper + client component changes its file structure | Directly mirrors the already-shipped `survey/[id]/edit/page.tsx` + `EditClient` pattern — no new pattern introduced. |
| `on delete restrict` means a market added by mistake with zero surveys still needs manual cleanup (direct SQL/dashboard) since there's no delete UI | Deliberate scope cut (§ Out of scope); low-frequency, admin-only, matches "don't handle deleting" instruction. |
| Number collision: this migration and the previously-noted `0007` active-check follow-up both want to be `0007` | Whichever lands first in `master` takes `0007`; the other becomes `0008`. Called out in §7 so it isn't missed at implementation time. |

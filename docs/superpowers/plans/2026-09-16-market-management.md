# Admin-Managed Markets (Add/Rename) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin add new markets and rename existing ones from the
Housekeeping dashboard, with renames cascading to every survey (past and
future) that references the market.

**Architecture:** Markets move from a hardcoded array (`lib/constants.ts`)
mirrored by a Postgres `CHECK` to a `public.markets` table. `surveys.market`
becomes a foreign key to `markets.name` with `on update cascade` (renames
propagate automatically) and `on delete restrict` (no delete UI is built; the
DB itself blocks deleting a market in use). Every current static-import
consumer of `MARKETS`/`MARKET_COLORS` switches to taking a `markets` list as
data, fetched server-side and threaded down as props — the same pattern the
app already uses for `reps` on the admin surveys/map pages.

**Tech Stack:** Next.js 15.5 App Router (React 19, TypeScript), Tailwind,
Supabase (Postgres + RLS, Auth), Vitest (jsdom unit; Node integration against
a local Supabase), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-09-16-market-management-design.md`

## Global Constraints

- **Deleting a market is out of scope.** No delete UI or action. The DB's
  `on delete restrict` FK is the only delete guard, and that's sufficient.
- **Renames are retroactive.** `on update cascade` on `surveys.market` makes
  this automatic at the DB layer — no application code copies data around.
- **Service-role key never reaches the browser.** `addMarket`/`renameMarket`
  are server actions using `createAdminSupabase()`, admin-gated the same way
  `sweepOrphans` already is.
- **Migrations are append-only.** New file `supabase/migrations/0007_markets_table.sql`;
  never edit `0001`–`0006`. Every statement idempotent-guarded (`create table
  if not exists`, `on conflict do nothing`, `drop constraint/policy if exists`
  before recreating).
- **RLS:** any authenticated user (`select`) can read `markets` (reps need it
  for the survey-form dropdown); only `is_admin()` can write.
- **Max market name length:** 40 characters (`MAX_MARKET_NAME_LEN`), matching
  `MAX_OTHER_BRAND_LEN`'s existing convention. Names are trimmed; duplicate
  check is case-insensitive.
- **Colors auto-assign** from a fixed `MARKET_COLOR_PALETTE` in
  `lib/constants.ts`, at `currentMarketCount % paletteLength` — no color
  picker.
- **Build hygiene:** `npm test`, `npx tsc --noEmit`, `npm run build` must all
  pass. Only allowed build warnings: the two `@next/next/no-img-element` in
  `PhotoCapture.tsx` / `MediaGallery.tsx`.
- **Conventional Commits.** Commit after every task.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `supabase/migrations/0007_markets_table.sql` | `markets` table, seed the 12 current markets, swap `surveys.market`'s `CHECK` for an FK with `on update cascade` / `on delete restrict`, RLS. |
| `lib/markets.ts` | `getMarkets(supabase)` — fetches `{name, color}[]` ordered by `sort_order`. Shared by every page that needs the list. |
| `components/admin/MarketsSection.tsx` | Client. Lists markets with color swatches, inline rename, "Add market" form. |
| `app/survey/new/NewSurveyClient.tsx` | Client. Today's `survey/new/page.tsx` body, renamed, now takes `markets: string[]` as a prop. |
| `tests/unit/markets.test.ts` | `getMarkets` — selects `name, color` ordered by `sort_order`; throws on query error. |
| `tests/unit/housekeeping-actions.test.ts` | `addMarket`/`renameMarket`: admin gate, trimming, length cap, case-insensitive duplicate check, palette color assignment. |
| `tests/integration/markets.test.ts` | RLS (rep read-only, admin write), rename cascades to existing surveys, delete blocked by FK when in use. |
| `tests/e2e/admin-markets.spec.ts` | Admin adds a market → rep sees it in the survey form; admin renames a market → new name shows in the admin filter. |

**Modified:**

| Path | Change |
|---|---|
| `lib/constants.ts` | Remove `MARKETS`, `Market` type, `MARKET_COLORS`. Add `MARKET_COLOR_PALETTE`, `MAX_MARKET_NAME_LEN`. |
| `lib/types.ts` | `Survey.market: Market` → `Survey.market: string`; drop the `Market` import. |
| `lib/queries.ts` | `SurveyListItem.market: Market` → `string`; drop the `Market` import. |
| `lib/validation.ts` | `validateScalarFields`, `validateSurvey`, `validateSurveyEdit` take a `markets: readonly string[]` parameter instead of importing `MARKETS`. |
| `lib/aggregations.ts` | `countByMarket(surveys, markets: readonly string[])` takes the ordered name list as a parameter. |
| `app/admin/housekeeping/actions.ts` | Add `addMarket(name)`, `renameMarket(oldName, newName)`. |
| `app/admin/housekeeping/page.tsx` | Becomes an async server component; fetches markets; renders `MarketsSection` above the existing sweep section. |
| `app/admin/surveys/page.tsx` | Fetch markets; pass names to `SurveyFilterBar`. |
| `app/admin/map/page.tsx` | Fetch markets; pass names to `SurveyFilterBar`, `{name,color}[]` to `SurveysMap`. |
| `app/admin/overview/page.tsx` | Fetch markets; pass names into `countByMarket`; "Markets covered" denominator becomes `markets.length` instead of the hardcoded `12`. |
| `app/survey/new/page.tsx` | Becomes an async server component: fetches markets, renders `NewSurveyClient`. |
| `app/survey/[id]/edit/page.tsx` | Fetch markets; pass names to `EditClient`. |
| `app/survey/[id]/edit/EditClient.tsx` | Take `markets: string[]` prop; pass through to `SurveyEditForm`. |
| `components/admin/SurveyFilterBar.tsx` | Take `markets: string[]` prop instead of importing `MARKETS`. |
| `components/SurveysMap.tsx` | Take `markets: {name,color}[]` prop; build the color lookup and legend from it. |
| `components/form/SurveyFields.tsx` | Take `markets: string[]` prop instead of importing `MARKETS`. |
| `components/form/SurveyForm.tsx` | Take `markets: string[]` prop; pass to `SurveyFields` and `validateSurvey`. |
| `components/form/SurveyEditForm.tsx` | Take `markets: string[]` prop; pass to `SurveyFields` and `validateSurveyEdit`. |
| `tests/unit/constants.test.ts` | Drop `MARKETS`/`MARKET_COLORS` assertions; add `MARKET_COLOR_PALETTE`/`MAX_MARKET_NAME_LEN` coverage. |
| `tests/unit/aggregations.test.ts` | `countByMarket` call passes an explicit markets fixture. |
| `tests/unit/validation.test.ts` | Every `validateSurvey`/`validateScalarFields`/`validateSurveyEdit` call passes a markets fixture. |
| `tests/unit/survey-fields.test.tsx` | Pass a `markets` fixture prop. |
| `tests/unit/survey-form-validation.test.tsx` | Pass a `markets` fixture prop to `<SurveyForm>`. |
| `tests/unit/survey-edit-form.test.tsx` | Pass a `markets` fixture prop to `<SurveyEditForm>`. |
| `CLAUDE.md` | Hard-rule/layout/migration/test-count updates. |
| `docs/DEPLOYMENT.md` | Add `0007` to the migration list + a "Step 2d" section mirroring 2b/2c. |

---

## Notes for the implementer (read once)

- **`getMarkets` always returns `{name, color}[]` ordered by `sort_order`.**
  Callers that only need names do `.map((m) => m.name)` at the call site —
  there's a single fetch helper, not two.
- **Integration tests need a local stack:** `npm run db:start` (Docker) then
  `npm run db:reset`, run with `npm run test:integration`. This suite is in
  the repo's "authored, never run" set (per `CLAUDE.md`) — write and commit
  the test file regardless; note in your task summary whether you were able
  to run it.
- **`ilike` without `%` wildcards is a case-insensitive exact match** — that's
  exactly what the duplicate-name check wants; no need for `%`-wrapping.
- Match surrounding style: 2-space indent, double quotes, Tailwind utility
  classes, `role="alert"` for errors, `useTransition` for pending admin-action
  buttons (see `components/admin/SweepButton.tsx`).

---

### Task 1: Migration `0007_markets_table.sql`

**Files:**
- Create: `supabase/migrations/0007_markets_table.sql`

**Interfaces:**
- Produces: table `public.markets(name text primary key, color text not null,
  sort_order int not null, created_at timestamptz not null default now())`,
  seeded with the 12 current markets; `surveys.market` FK to `markets(name)`
  with `on update cascade on delete restrict`; RLS policies `markets_select`
  (any authenticated, `select`) and `markets_admin_write` (`is_admin()`, all).

- [ ] **Step 1: Write the migration file**

```sql
-- Markets become admin-managed (add/rename) instead of a hardcoded CHECK list.
-- Idempotent: safe to re-run against an already-migrated database.

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

alter table public.surveys drop constraint if exists surveys_market_check;

alter table public.surveys drop constraint if exists surveys_market_fkey;
alter table public.surveys
  add constraint surveys_market_fkey
  foreign key (market) references public.markets(name)
  on update cascade
  on delete restrict;

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

- [ ] **Step 2: Apply locally if a Docker-backed Supabase is available**

Run: `npm run db:reset`
Expected: migrations `0001`–`0007` apply cleanly, no errors. If Docker isn't
available in this environment, skip this step — the migration is validated by
the integration test in Task 15.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_markets_table.sql
git commit -m "feat: add markets table with admin-managed add/rename

Markets move from a hardcoded CHECK list to a public.markets table.
surveys.market is now a FK with on update cascade (renames are
retroactive) and on delete restrict (no delete UI needed)."
```

---

### Task 2: `lib/constants.ts` — replace `MARKETS`/`MARKET_COLORS` with a palette

**Files:**
- Modify: `lib/constants.ts:1-5,29-34`
- Test: `tests/unit/constants.test.ts`

**Interfaces:**
- Produces: `MARKET_COLOR_PALETTE: readonly string[]` (18 hex colors),
  `MAX_MARKET_NAME_LEN = 40`.
- Removes: `MARKETS`, `Market` type, `MARKET_COLORS` (no other task in this
  plan references them after Task 9).

- [ ] **Step 1: Write the failing test**

Replace `tests/unit/constants.test.ts` in full:

```ts
import { describe, it, expect } from "vitest";
import { BRANDS, SHOP_SIZES, MARKET_COLOR_PALETTE, MAX_MARKET_NAME_LEN, MAX_INNER_PHOTOS } from "@/lib/constants";
import { BRAND_SELECT_OPTIONS, OTHER_BRAND, MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN } from "@/lib/constants";

describe("constants", () => {
  it("has 7 brands", () => {
    expect(BRANDS).toEqual(["Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans"]);
  });
  it("has 3 shop sizes", () => {
    expect(SHOP_SIZES).toEqual(["Small", "Medium", "Large"]);
  });
  it("has a non-empty palette of valid, distinct hex colors", () => {
    expect(MARKET_COLOR_PALETTE.length).toBeGreaterThanOrEqual(12);
    for (const c of MARKET_COLOR_PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(MARKET_COLOR_PALETTE).size).toBe(MARKET_COLOR_PALETTE.length);
  });
  it("caps a market name at 40 characters", () => {
    expect(MAX_MARKET_NAME_LEN).toBe(40);
  });
  it("caps inner photos at 10", () => {
    expect(MAX_INNER_PHOTOS).toBe(10);
  });
});

describe("v2 constants", () => {
  it("BRAND_SELECT_OPTIONS is the 7 brands plus Other", () => {
    expect(BRAND_SELECT_OPTIONS).toEqual([...BRANDS, "Other"]);
    expect(OTHER_BRAND).toBe("Other");
  });
  it("quotation cap is 2, other-brand length cap is 40", () => {
    expect(MAX_QUOTATION_PHOTOS).toBe(2);
    expect(MAX_OTHER_BRAND_LEN).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- constants.test.ts`
Expected: FAIL — `MARKET_COLOR_PALETTE`/`MAX_MARKET_NAME_LEN` are not exported yet.

- [ ] **Step 3: Update `lib/constants.ts`**

Replace lines 1–5 (the `MARKETS` block) with nothing (delete it), and replace
lines 29–34 (`MARKET_COLORS`) with `MARKET_COLOR_PALETTE`. Full resulting file:

```ts
export const BRANDS = [
  "Tamoor", "Khurshid", "SK", "GFC", "Royal", "Pak Fans", "Lahore Fans",
] as const;
export type Brand = (typeof BRANDS)[number];

export const OTHER_BRAND = "Other" as const;
export const BRAND_SELECT_OPTIONS = [...BRANDS, OTHER_BRAND] as const;
export const MAX_OTHER_BRAND_LEN = 40;

export const SHOP_SIZES = ["Small", "Medium", "Large"] as const;
export type ShopSize = (typeof SHOP_SIZES)[number];

export const MAX_INNER_PHOTOS = 10;
export const MAX_QUOTATION_PHOTOS = 2;
export const MAX_AUDIO_SECONDS = 120;
export const MAX_AUDIO_UPLOAD_MB = 25;
export const ALLOWED_AUDIO_TYPES = [
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/aac",
  "audio/ogg", "audio/wav", "audio/x-m4a",
] as const;
export const SIGNED_URL_TTL = 21600; // 6 hours

export const MAX_MARKET_NAME_LEN = 40;
export const MARKET_COLOR_PALETTE = [
  "#e6194b", "#3cb44b", "#e6a700", "#4363d8", "#f58231", "#911eb4",
  "#009fb0", "#f032e6", "#7a9a01", "#c26f9d", "#469990", "#9a6324",
  "#000075", "#808000", "#aaffc3", "#ffd8b1", "#808080", "#fabed4",
] as const;

export const KARACHI_CENTER: [number, number] = [24.86, 67.02];
export const KARACHI_ZOOM = 11;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/constants.ts tests/unit/constants.test.ts
git commit -m "refactor: replace hardcoded MARKETS/MARKET_COLORS with a color palette"
```

---

### Task 3: `lib/markets.ts` — fetch helper

**Files:**
- Create: `lib/markets.ts`
- Test: `tests/unit/markets.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getMarkets(supabase: SupabaseClient): Promise<{name: string; color: string}[]>`,
  used by every server page in Tasks 7–13.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/markets.test.ts
import { describe, it, expect, vi } from "vitest";
import { getMarkets } from "@/lib/markets";

describe("getMarkets", () => {
  it("selects name and color ordered by sort_order", async () => {
    const order = vi.fn(async () => ({
      data: [{ name: "B", color: "#111111" }, { name: "A", color: "#222222" }],
      error: null,
    }));
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    const db = { from } as any;

    const result = await getMarkets(db);

    expect(from).toHaveBeenCalledWith("markets");
    expect(select).toHaveBeenCalledWith("name, color");
    expect(order).toHaveBeenCalledWith("sort_order");
    expect(result).toEqual([{ name: "B", color: "#111111" }, { name: "A", color: "#222222" }]);
  });

  it("throws when the query errors", async () => {
    const db = {
      from: () => ({ select: () => ({ order: async () => ({ data: null, error: new Error("boom") }) }) }),
    } as any;

    await expect(getMarkets(db)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- markets.test.ts`
Expected: FAIL — `Cannot find module '@/lib/markets'`.

- [ ] **Step 3: Write `lib/markets.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketOption = { name: string; color: string };

export async function getMarkets(supabase: SupabaseClient): Promise<MarketOption[]> {
  const { data, error } = await supabase.from("markets").select("name, color").order("sort_order");
  if (error) throw error;
  return (data ?? []) as MarketOption[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- markets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/markets.ts tests/unit/markets.test.ts
git commit -m "feat: add getMarkets fetch helper"
```

---

### Task 4: `lib/types.ts` + `lib/queries.ts` — drop the `Market` type alias

**Files:**
- Modify: `lib/types.ts:1,24`
- Modify: `lib/queries.ts:2,7`

**Interfaces:**
- Consumes: nothing (pure type change; `Market` type removed in Task 2).
- Produces: `Survey.market: string`, `SurveyListItem.market: string`.

- [ ] **Step 1: Edit `lib/types.ts`**

Change line 1 from:
```ts
import type { Brand, Market, ShopSize } from "./constants";
```
to:
```ts
import type { Brand, ShopSize } from "./constants";
```
Change line 24 from `market: Market;` to `market: string;`.

- [ ] **Step 2: Edit `lib/queries.ts`**

Change line 2 from:
```ts
import type { Market } from "@/lib/constants";
```
Delete this line entirely (no longer needed). Change line 7 from
`market: Market;` to `market: string;`.

- [ ] **Step 3: Verify with the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files (other files still reference the
old `MARKETS`/`Market` import until later tasks land — this is expected; see
Task 9 for the point where all remaining references are gone and a full
`tsc --noEmit` should be clean).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/queries.ts
git commit -m "refactor: type Survey.market and SurveyListItem.market as string"
```

---

### Task 5: `lib/validation.ts` — take `markets` as a parameter

**Files:**
- Modify: `lib/validation.ts:1-5,90-109,115-140`
- Test: `tests/unit/validation.test.ts`

**Interfaces:**
- Consumes: nothing new (pure signature change).
- Produces: `validateScalarFields(v, markets: readonly string[])`,
  `validateSurvey(v, markets: readonly string[])`,
  `validateSurveyEdit(v, counts, markets: readonly string[])`. `SurveyForm`
  (Task 9) and `SurveyEditForm` (Task 9) call these with the markets list
  they receive as a prop.

- [ ] **Step 1: Write the failing test**

Replace `tests/unit/validation.test.ts` in full:

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, validateSurvey, validateSurveyEdit, validateScalarFields, buildSurveyPayload, validateAudioUpload, type SurveyFormValues } from "@/lib/validation";
import { MAX_AUDIO_UPLOAD_MB } from "@/lib/constants";

const MARKETS = ["Arambagh", "Malir"];

const valid: SurveyFormValues = {
  shop_name: "Al Madina Electronics",
  market: "Arambagh",
  shop_size: "Medium",
  customer_name: "Bilal",
  customer_number: "0300 1234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 12 },
  most_selling_fan: "GFC",
  rec_30w_1: "Tamoor",
  rec_30w_2: "",
  rec_50w_1: "Royal",
  rec_50w_2: "",
  most_selling_fan_other: "",
  rec_30w_1_other: "",
  rec_30w_2_other: "",
  rec_50w_1_other: "",
  rec_50w_2_other: "",
  frontPhoto: new File(["x"], "front.jpg", { type: "image/jpeg" }),
  innerPhotos: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
  quotationPhotos: [],
  audio: null,
};

describe("normalizePhone", () => {
  it.each([
    ["03001234567", "03001234567"],
    ["0300 123 4567", "03001234567"],
    ["+923001234567", "03001234567"],
    ["+92 300 1234567", "03001234567"],
  ])("accepts %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
  it.each(["12345", "0300123456", "030012345678", "0421234567", ""])(
    "rejects %s",
    (input) => expect(normalizePhone(input)).toBeNull(),
  );
});

describe("validateSurvey", () => {
  it("passes a fully valid form", () => {
    expect(validateSurvey(valid, MARKETS)).toEqual({});
  });
  it("flags every missing required field", () => {
    const errs = validateSurvey({
      ...valid, shop_name: " ", market: "", shop_size: "", customer_name: "",
      customer_number: "abc", gps: null, most_selling_fan: "", rec_30w_1: "",
      rec_50w_1: "", frontPhoto: null, innerPhotos: [],
      most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "",
      rec_50w_1_other: "", rec_50w_2_other: "", quotationPhotos: [],
    }, MARKETS);
    for (const k of ["shop_name","market","shop_size","customer_name","customer_number","gps","most_selling_fan","rec_30w_1","rec_50w_1","frontPhoto","innerPhotos"]) {
      expect(errs).toHaveProperty(k);
    }
  });
  it("allows blank optional recommendations", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "", rec_50w_2: "" }, MARKETS)).toEqual({});
  });
  it("rejects an out-of-range optional recommendation", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "Nonsense" }, MARKETS)).toHaveProperty("rec_30w_2");
  });
  it("rejects more than 10 inner photos", () => {
    const many = Array.from({ length: 11 }, (_, i) => new File(["x"], `${i}.jpg`, { type: "image/jpeg" }));
    expect(validateSurvey({ ...valid, innerPhotos: many }, MARKETS)).toHaveProperty("innerPhotos");
  });
  it("rejects a market not in the given list", () => {
    expect(validateSurvey({ ...valid, market: "Nowhere" }, MARKETS)).toHaveProperty("market");
  });
});

describe("buildSurveyPayload", () => {
  it("normalizes phone and maps photo paths", () => {
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111", valid, {
      front: "uid/sid/front.jpg", inner: ["uid/sid/inner-0.jpg"], quotation: [], audio: null,
    });
    expect(p.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(p.customer_number).toBe("03001234567");
    expect(p.rec_30w_2).toBeNull();
    expect(p.audio_path).toBeNull();
    expect(p.photos).toEqual([
      { kind: "front", storage_path: "uid/sid/front.jpg", sort_order: 0 },
      { kind: "inner", storage_path: "uid/sid/inner-0.jpg", sort_order: 0 },
    ]);
  });
});

describe("Other brand", () => {
  it("accepts a real brand with no _other text", () => {
    expect(validateSurvey({ ...valid, most_selling_fan: "GFC", most_selling_fan_other: "" }, MARKETS)).toEqual({});
  });
  it("requires the typed name when the field is Other", () => {
    const e = validateSurvey({ ...valid, most_selling_fan: "Other", most_selling_fan_other: "  " }, MARKETS);
    expect(e.most_selling_fan_other).toMatch(/brand name/i);
    expect(e.most_selling_fan).toBeUndefined();
  });
  it("accepts Other + a name, trims it in the payload", () => {
    expect(validateSurvey({ ...valid, most_selling_fan: "Other", most_selling_fan_other: " Fanco " }, MARKETS)).toEqual({});
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111",
      { ...valid, most_selling_fan: "Other", most_selling_fan_other: " Fanco " },
      { front: "u/s/front.jpg", inner: ["u/s/inner-0.jpg"], quotation: [], audio: null });
    expect(p.most_selling_fan).toBe("Other");
    expect(p.most_selling_fan_other).toBe("Fanco");
    expect(p.rec_30w_1_other).toBeNull();
  });
  it("rejects an Other name longer than 40 chars", () => {
    const e = validateSurvey({ ...valid, rec_30w_1: "Other", rec_30w_1_other: "x".repeat(41) }, MARKETS);
    expect(e.rec_30w_1_other).toMatch(/40/);
  });
  it("still allows a blank optional recommendation", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "", rec_30w_2_other: "" }, MARKETS)).toEqual({});
  });
});

describe("quotation photos", () => {
  const img = (n: string) => new File([new Uint8Array(4)], n, { type: "image/jpeg" });
  it("0 is fine", () => {
    expect(validateSurvey({ ...valid, quotationPhotos: [] }, MARKETS)).toEqual({});
  });
  it("errors above the cap of 2", () => {
    const e = validateSurvey({ ...valid, quotationPhotos: [img("a"), img("b"), img("c")] }, MARKETS);
    expect(e.quotationPhotos).toMatch(/2 quotation/i);
  });
  it("maps quotation paths into the payload", () => {
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111", valid,
      { front: "u/s/front.jpg", inner: ["u/s/inner-0.jpg"], quotation: ["u/s/quotation-0.jpg", "u/s/quotation-1.jpg"], audio: null });
    expect(p.photos).toEqual([
      { kind: "front", storage_path: "u/s/front.jpg", sort_order: 0 },
      { kind: "inner", storage_path: "u/s/inner-0.jpg", sort_order: 0 },
      { kind: "quotation", storage_path: "u/s/quotation-0.jpg", sort_order: 0 },
      { kind: "quotation", storage_path: "u/s/quotation-1.jpg", sort_order: 1 },
    ]);
  });
});

const goodScalars: SurveyFormValues = {
  shop_name: "Al Madina", market: "Arambagh", shop_size: "Small",
  customer_name: "B", customer_number: "03001234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 10 },
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: "", rec_50w_1: "Royal", rec_50w_2: "",
  most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "",
  frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
};

describe("validateSurveyEdit", () => {
  it("passes when front is an existing photo and inner count >= 1", () => {
    const e = validateSurveyEdit(goodScalars, { front: 1, inner: 2, quotation: 0 }, MARKETS);
    expect(e).toEqual({});
  });
  it("flags a missing front and empty inner set", () => {
    const e = validateSurveyEdit(goodScalars, { front: 0, inner: 0, quotation: 0 }, MARKETS);
    expect(e.frontPhoto).toMatch(/front photo/i);
    expect(e.innerPhotos).toMatch(/at least one/i);
  });
  it("caps inner at 10 and quotation at 2", () => {
    const e = validateSurveyEdit(goodScalars, { front: 1, inner: 11, quotation: 3 }, MARKETS);
    expect(e.innerPhotos).toMatch(/no more than 10/i);
    expect(e.quotationPhotos).toMatch(/no more than 2/i);
  });
  it("reuses the scalar checks", () => {
    const e = validateSurveyEdit({ ...goodScalars, shop_name: "" }, { front: 1, inner: 1, quotation: 0 }, MARKETS);
    expect(e.shop_name).toBeTruthy();
  });
});

describe("validateScalarFields", () => {
  it("returns no errors for good scalars and ignores media", () => {
    expect(validateScalarFields(goodScalars, MARKETS)).toEqual({});
  });
  it("rejects a market outside the given list", () => {
    expect(validateScalarFields({ ...goodScalars, market: "Nowhere" }, MARKETS)).toHaveProperty("market");
  });
});

describe("validateAudioUpload", () => {
  const file = (type: string, bytes: number) =>
    new File([new Uint8Array(bytes)], "n", { type });

  it("accepts an audio file within the size cap", () => {
    expect(validateAudioUpload(file("audio/mpeg", 5 * 1024 * 1024))).toBeNull();
  });
  it("rejects a non-audio type", () => {
    expect(validateAudioUpload(file("application/pdf", 10))).toMatch(/audio file/i);
  });
  it("rejects a file over the cap", () => {
    expect(validateAudioUpload(file("audio/wav", (MAX_AUDIO_UPLOAD_MB + 1) * 1024 * 1024)))
      .toMatch(new RegExp(`${MAX_AUDIO_UPLOAD_MB} MB`));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validation.test.ts`
Expected: FAIL — `validateSurvey`/`validateScalarFields`/`validateSurveyEdit`
still take only one/two arguments (TypeScript error) and the market-list
membership check still reads from the removed `MARKETS` import.

- [ ] **Step 3: Update `lib/validation.ts`**

Change the import block (lines 1–5) to drop `MARKETS`:
```ts
import {
  BRANDS, SHOP_SIZES, MAX_INNER_PHOTOS,
  MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN, OTHER_BRAND,
  MAX_AUDIO_UPLOAD_MB, ALLOWED_AUDIO_TYPES,
} from "./constants";
```

Change `validateScalarFields` (was lines 90–109) to take `markets`:
```ts
export function validateScalarFields(v: SurveyFormValues, markets: readonly string[]): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.shop_name.trim()) e.shop_name = "Shop name is required";
  if (!markets.includes(v.market)) e.market = "Select a market";
  if (!(SHOP_SIZES as readonly string[]).includes(v.shop_size)) e.shop_size = "Select a shop size";
  if (!v.customer_name.trim()) e.customer_name = "Customer name is required";
  if (!normalizePhone(v.customer_number)) e.customer_number = "Enter a valid Pakistani mobile number";
  if (!v.gps) e.gps = "Capture the shop location";
  for (const [name, brand, other, optional] of [
    ["most_selling_fan", v.most_selling_fan, v.most_selling_fan_other, false],
    ["rec_30w_1", v.rec_30w_1, v.rec_30w_1_other, false],
    ["rec_30w_2", v.rec_30w_2, v.rec_30w_2_other, true],
    ["rec_50w_1", v.rec_50w_1, v.rec_50w_1_other, false],
    ["rec_50w_2", v.rec_50w_2, v.rec_50w_2_other, true],
  ] as const) {
    const r = brandCheck(brand, other, optional);
    if (r) e[r.field === "self" ? name : `${name}_other`] = r.msg;
  }
  return e;
}
```

Change `validateSurvey` (was lines 115–125):
```ts
export function validateSurvey(v: SurveyFormValues, markets: readonly string[]): Record<string, string> {
  const e = validateScalarFields(v, markets);
  if (!v.frontPhoto) e.frontPhoto = "Add a front photo";
  if (v.innerPhotos.length < 1) e.innerPhotos = "Add at least one inner photo";
  else if (v.innerPhotos.length > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  if (v.quotationPhotos.length > MAX_QUOTATION_PHOTOS)
    e.quotationPhotos = `No more than ${MAX_QUOTATION_PHOTOS} quotation photos`;
  const a = audioUploadError(v.audio);
  if (a) e.audio = a;
  return e;
}
```

Change `validateSurveyEdit` (was lines 127–140):
```ts
export function validateSurveyEdit(
  v: SurveyFormValues,
  counts: { front: number; inner: number; quotation: number },
  markets: readonly string[],
): Record<string, string> {
  const e = validateScalarFields(v, markets);
  if (counts.front !== 1) e.frontPhoto = "Add a front photo";
  if (counts.inner < 1) e.innerPhotos = "Add at least one inner photo";
  else if (counts.inner > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  if (counts.quotation > MAX_QUOTATION_PHOTOS)
    e.quotationPhotos = `No more than ${MAX_QUOTATION_PHOTOS} quotation photos`;
  const a = audioUploadError(v.audio);
  if (a) e.audio = a;
  return e;
}
```

Everything else in the file (`GpsFix`, `ExistingMedia`, `validateAudioUpload`,
`SurveyFormValues`, `SurveyRpcPayload`, `normalizePhone`, `isBrand`,
`brandCheck`, `audioUploadError`, `buildSurveyPayload`) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/unit/validation.test.ts
git commit -m "refactor: validateSurvey/validateSurveyEdit take markets as a parameter"
```

---

### Task 6: `lib/aggregations.ts` — `countByMarket` takes `markets`

**Files:**
- Modify: `lib/aggregations.ts:1,7-11`
- Test: `tests/unit/aggregations.test.ts`

**Interfaces:**
- Produces: `countByMarket(surveys, markets: readonly string[]): Datum[]`.
  Called from `app/admin/overview/page.tsx` (Task 13) with the fetched
  markets list.

- [ ] **Step 1: Write the failing test**

Replace `tests/unit/aggregations.test.ts` in full:

```ts
import { describe, it, expect } from "vitest";
import {
  countByMarket, countByRep, countMostSellingFan, countRecommendedBrands, overviewStats,
} from "@/lib/aggregations";

const MARKET_NAMES = [
  "Arambagh", "MA Jinnah", "Waterpump", "Bohrapir", "Johar Mor", "UP",
  "Liaquatabad", "Shah Faisal Colony", "Orangi Town", "Baldia Town", "Malir", "Landhi/Korangi",
];

const surveys = [
  { market: "Malir", rep_username: "rep.one", most_selling_fan: "GFC", rec_30w_1: "GFC", rec_30w_2: "Tamoor", rec_50w_1: "GFC", rec_50w_2: null },
  { market: "Malir", rep_username: "rep.two", most_selling_fan: "Royal", rec_30w_1: "Royal", rec_30w_2: null, rec_50w_1: "GFC", rec_50w_2: "SK" },
  { market: "Arambagh", rep_username: "rep.one", most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null, rec_50w_1: "Tamoor", rec_50w_2: null },
  { market: "UP", rep_username: "rep.one", most_selling_fan: "Other", rec_30w_1: "Other", rec_30w_2: null, rec_50w_1: "Royal", rec_50w_2: null },
];

describe("aggregations", () => {
  it("countByMarket returns every given market in order with correct counts", () => {
    const out = countByMarket(surveys, MARKET_NAMES);
    expect(out).toHaveLength(12);
    expect(out.map((o) => o.label)).toEqual(MARKET_NAMES);
    expect(out.find((o) => o.label === "Malir")!.value).toBe(2);
    expect(out.find((o) => o.label === "UP")!.value).toBe(1);
  });

  it("countByMarket reflects a shorter or reordered markets list", () => {
    const out = countByMarket(surveys, ["UP", "Arambagh"]);
    expect(out).toEqual([{ label: "UP", value: 1 }, { label: "Arambagh", value: 1 }]);
  });

  it("countByRep is sorted descending", () => {
    const out = countByRep(surveys);
    expect(out[0]).toEqual({ label: "rep.one", value: 3 });
    expect(out[1]).toEqual({ label: "rep.two", value: 1 });
  });

  it("countMostSellingFan counts per brand and includes Other bucket", () => {
    const out = countMostSellingFan(surveys);
    expect(out).toHaveLength(8);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(2);
    expect(out.find((o) => o.label === "Royal")!.value).toBe(1);
    expect(out.find((o) => o.label === "SK")!.value).toBe(0);
    expect(out.find((o) => o.label === "Other")!.value).toBe(1);
  });

  it("countRecommendedBrands sums all four recommendation columns and includes Other bucket", () => {
    const out = countRecommendedBrands(surveys);
    expect(out).toHaveLength(8);
    expect(out.find((o) => o.label === "GFC")!.value).toBe(3);   // s1:2, s2:1
    expect(out.find((o) => o.label === "Tamoor")!.value).toBe(3); // s1:1, s3:2
    expect(out.find((o) => o.label === "SK")!.value).toBe(1);
    expect(out.find((o) => o.label === "Other")!.value).toBe(1); // s4:rec_30w_1
  });

  it("overviewStats reports totals and distinct markets", () => {
    expect(overviewStats(surveys)).toEqual({ totalSurveys: 4, marketsCovered: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- aggregations.test.ts`
Expected: FAIL — `countByMarket` still takes one argument.

- [ ] **Step 3: Update `lib/aggregations.ts`**

Change line 1 to drop `MARKETS`:
```ts
import { BRANDS, OTHER_BRAND } from "./constants";
```

Change `countByMarket` (was lines 7–11):
```ts
export function countByMarket(surveys: { market: string }[], markets: readonly string[]): Datum[] {
  const counts = new Map<string, number>(markets.map((m) => [m, 0]));
  for (const s of surveys) counts.set(s.market, (counts.get(s.market) ?? 0) + 1);
  return markets.map((m) => ({ label: m, value: counts.get(m) ?? 0 }));
}
```

Everything else in the file is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- aggregations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/aggregations.ts tests/unit/aggregations.test.ts
git commit -m "refactor: countByMarket takes the markets list as a parameter"
```

---

### Task 7: `app/admin/housekeeping/actions.ts` — `addMarket`/`renameMarket`

**Files:**
- Modify: `app/admin/housekeeping/actions.ts`
- Test: `tests/unit/housekeeping-actions.test.ts`

**Interfaces:**
- Consumes: `MARKET_COLOR_PALETTE`, `MAX_MARKET_NAME_LEN` from
  `lib/constants` (Task 2).
- Produces: `addMarket(name: string): Promise<void>`,
  `renameMarket(oldName: string, newName: string): Promise<void>`. Called
  from `MarketsSection` (Task 8).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/housekeeping-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSessionProfile: vi.fn() }));

const countResult: { current: { count: number | null } } = { current: { count: 0 } };
const ilikeResult: { current: { data: { name: string }[] | null } } = { current: { data: [] } };
const insertMock = vi.fn(async () => ({ error: null }));
const updateEqMock = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      if (table !== "markets") throw new Error(`unexpected table ${table}`);
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) return Promise.resolve(countResult.current);
          return { ilike: () => Promise.resolve(ilikeResult.current) };
        },
        insert: insertMock,
        update: (vals: { name: string }) => ({ eq: (_col: string, val: string) => updateEqMock(vals, val) }),
      };
    },
  }),
}));

import { getSessionProfile } from "@/lib/auth";
import { addMarket, renameMarket } from "@/app/admin/housekeeping/actions";
import { MARKET_COLOR_PALETTE } from "@/lib/constants";

const admin = { id: "a1", username: "admin", full_name: "Admin", role: "admin" as const, active: true, created_at: "" };
const rep = { ...admin, id: "r1", username: "rep.one", role: "rep" as const };

beforeEach(() => {
  vi.mocked(getSessionProfile).mockResolvedValue(admin);
  countResult.current = { count: 3 };
  ilikeResult.current = { data: [] };
  insertMock.mockClear();
  updateEqMock.mockClear();
});

describe("addMarket", () => {
  it("rejects a non-admin caller", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(rep);
    await expect(addMarket("New Town")).rejects.toThrow(/not authorized/i);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    await expect(addMarket("   ")).rejects.toThrow(/required/i);
  });

  it("rejects a name over 40 characters", async () => {
    await expect(addMarket("x".repeat(41))).rejects.toThrow(/40/);
  });

  it("rejects a case-insensitive duplicate", async () => {
    ilikeResult.current = { data: [{ name: "Malir" }] };
    await expect(addMarket("malir")).rejects.toThrow(/already exists/i);
  });

  it("inserts with the palette color at count % length and the next sort_order", async () => {
    countResult.current = { count: 12 };
    await addMarket(" New Town ");
    expect(insertMock).toHaveBeenCalledWith({
      name: "New Town",
      color: MARKET_COLOR_PALETTE[12 % MARKET_COLOR_PALETTE.length],
      sort_order: 13,
    });
  });
});

describe("renameMarket", () => {
  it("rejects a non-admin caller", async () => {
    vi.mocked(getSessionProfile).mockResolvedValue(rep);
    await expect(renameMarket("UP", "University Road")).rejects.toThrow(/not authorized/i);
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    await expect(renameMarket("UP", "  ")).rejects.toThrow(/required/i);
  });

  it("rejects a name over 40 characters", async () => {
    await expect(renameMarket("UP", "x".repeat(41))).rejects.toThrow(/40/);
  });

  it("allows a case-only rename without a duplicate check", async () => {
    await renameMarket("UP", "up");
    expect(updateEqMock).toHaveBeenCalledWith({ name: "up" }, "UP");
  });

  it("rejects a rename that collides with another existing market", async () => {
    ilikeResult.current = { data: [{ name: "Malir" }] };
    await expect(renameMarket("UP", "Malir")).rejects.toThrow(/already exists/i);
  });

  it("updates the row by its old name", async () => {
    await renameMarket("UP", "University Road");
    expect(updateEqMock).toHaveBeenCalledWith({ name: "University Road" }, "UP");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- housekeeping-actions.test.ts`
Expected: FAIL — `addMarket`/`renameMarket` are not exported yet.

- [ ] **Step 3: Update `app/admin/housekeeping/actions.ts`**

Add the import and the two new exports; leave `assertAdmin`, `sweepBucket`,
`sweepOrphans` unchanged:

```ts
"use server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MARKET_COLOR_PALETTE, MAX_MARKET_NAME_LEN } from "@/lib/constants";

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

async function sweepBucket(db: any, bucket: string, liveIds: Set<string>): Promise<number> {
  let removed = 0;
  const { data: uidFolders } = await db.storage.from(bucket).list("", { limit: 1000 });
  for (const uid of uidFolders ?? []) {
    if (!uid.name) continue;
    const { data: surveyFolders } = await db.storage.from(bucket).list(uid.name, { limit: 1000 });
    for (const sf of surveyFolders ?? []) {
      if (!sf.name || liveIds.has(sf.name)) continue;
      const prefix = `${uid.name}/${sf.name}`;
      const { data: files } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
      if (files?.length) {
        await db.storage.from(bucket).remove(files.map((f: any) => `${prefix}/${f.name}`));
        removed += files.length;
      }
    }
  }
  return removed;
}

export async function sweepOrphans(): Promise<{ removedFiles: number }> {
  await assertAdmin();
  const db = createAdminSupabase();
  const { data: rows } = await db.from("surveys").select("id");
  const liveIds = new Set<string>((rows ?? []).map((r: any) => r.id));
  const a = await sweepBucket(db, "survey-photos", liveIds);
  const b = await sweepBucket(db, "survey-audio", liveIds);
  return { removedFiles: a + b };
}

async function checkNameCollision(db: ReturnType<typeof createAdminSupabase>, name: string): Promise<void> {
  const { data } = await db.from("markets").select("name").ilike("name", name);
  if (data?.length) throw new Error("A market with that name already exists");
}

export async function addMarket(name: string): Promise<void> {
  await assertAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Market name is required");
  if (trimmed.length > MAX_MARKET_NAME_LEN)
    throw new Error(`Market name must be ${MAX_MARKET_NAME_LEN} characters or fewer`);

  const db = createAdminSupabase();
  const { count } = await db.from("markets").select("*", { count: "exact", head: true });
  await checkNameCollision(db, trimmed);

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
    await checkNameCollision(db, trimmed);
  }

  const { error } = await db.from("markets").update({ name: trimmed }).eq("name", oldName);
  if (error) throw new Error("Could not rename market");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- housekeeping-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/housekeeping/actions.ts tests/unit/housekeeping-actions.test.ts
git commit -m "feat: add addMarket/renameMarket admin actions"
```

---

### Task 8: `MarketsSection` component + Housekeeping page

**Files:**
- Create: `components/admin/MarketsSection.tsx`
- Modify: `app/admin/housekeeping/page.tsx`

**Interfaces:**
- Consumes: `addMarket`, `renameMarket` from `app/admin/housekeeping/actions`
  (Task 7); `getMarkets` from `lib/markets` (Task 3).
- Produces: `MarketsSection({ markets }: { markets: { name: string; color:
  string }[] })`, rendered by the Housekeeping page.

No unit test for this task — the codebase has no established pattern for
testing thin admin-action UI components (`SweepButton` has none either); the
logic it calls (`addMarket`/`renameMarket`) is already covered in Task 7, and
the end-to-end flow is covered by Task 16's e2e spec.

- [ ] **Step 1: Write `components/admin/MarketsSection.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMarket, renameMarket } from "@/app/admin/housekeeping/actions";

export function MarketsSection({ markets }: { markets: { name: string; color: string }[] }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function beginRename(name: string) {
    setError("");
    setRenaming(name);
    setRenameValue(name);
  }

  function saveRename(oldName: string) {
    setError("");
    start(async () => {
      try {
        await renameMarket(oldName, renameValue);
        setRenaming(null);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function submitAdd() {
    setError("");
    start(async () => {
      try {
        await addMarket(newName);
        setNewName("");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold">Markets</h2>
        <p className="text-sm text-slate-500">
          Renaming a market updates it everywhere, including past surveys. Markets cannot be deleted here.
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {markets.map((m) => (
          <li key={m.name} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: m.color }} />
            {renaming === m.name ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  aria-label={`Rename ${m.name}`}
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <button disabled={pending} onClick={() => saveRename(m.name)}
                  className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60">
                  Save
                </button>
                <button disabled={pending} onClick={() => setRenaming(null)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{m.name}</span>
                <button disabled={pending} aria-label={`Rename ${m.name}`} onClick={() => beginRename(m.name)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs">
                  Rename
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New market name"
          aria-label="New market name"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button disabled={pending || !newName.trim()} onClick={submitAdd}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
          Add market
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/admin/housekeeping/page.tsx`**

```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getMarkets } from "@/lib/markets";
import { MarketsSection } from "@/components/admin/MarketsSection";
import { SweepButton } from "@/components/admin/SweepButton";

export default async function HousekeepingPage() {
  const db = createAdminSupabase();
  const markets = await getMarkets(db);

  return (
    <div className="flex flex-col gap-8">
      <MarketsSection markets={markets} />
      <div>
        <h2 className="text-base font-semibold">Storage housekeeping</h2>
        <p className="text-sm text-slate-500">
          Removes photo and voice-note files left behind by submissions that never completed.
        </p>
      </div>
      <SweepButton />
    </div>
  );
}
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add components/admin/MarketsSection.tsx app/admin/housekeeping/page.tsx
git commit -m "feat: add/rename markets UI on the Housekeeping page"
```

---

### Task 9: Thread `markets` through `SurveyFields`/`SurveyForm`/`SurveyEditForm`

**Files:**
- Modify: `components/form/SurveyFields.tsx:7,23-24`
- Modify: `components/form/SurveyForm.tsx:5-6,15,26,40-43`
- Modify: `components/form/SurveyEditForm.tsx:3,6,41-49,97,131-134`
- Test: `tests/unit/survey-fields.test.tsx`, `tests/unit/survey-form-validation.test.tsx`, `tests/unit/survey-edit-form.test.tsx`

**Interfaces:**
- Consumes: `validateSurvey`/`validateSurveyEdit` with the new `markets`
  parameter (Task 5).
- Produces: `SurveyFields({ ..., markets: string[] })`,
  `SurveyForm({ ..., markets: string[] })`,
  `SurveyEditForm({ ..., markets: string[] })`. Consumed by `NewSurveyClient`
  (Task 10) and `EditClient` (Task 11).

- [ ] **Step 1: Update the three failing tests**

In `tests/unit/survey-fields.test.tsx`, add a `markets` fixture prop to the
render call:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurveyFields } from "@/components/form/SurveyFields";
import { EMPTY_SURVEY } from "@/components/form/SurveyForm";

describe("SurveyFields", () => {
  it("renders every scalar field and both slots", () => {
    render(<SurveyFields v={EMPTY_SURVEY} set={vi.fn()} errors={{}} markets={["Arambagh", "Waterpump"]}
      photos={<div data-testid="photos-slot" />} voice={<div data-testid="voice-slot" />} />);
    expect(screen.getByLabelText(/shop name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/market/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/customer number/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /most selling fan/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /50W — Recommend 2/i })).toBeInTheDocument();
    expect(screen.getByTestId("photos-slot")).toBeInTheDocument();
    expect(screen.getByTestId("voice-slot")).toBeInTheDocument();
  });
});
```

In `tests/unit/survey-form-validation.test.tsx`, pass `markets={["Arambagh", "Waterpump"]}`
to all three `<SurveyForm>` renders:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyForm } from "@/components/form/SurveyForm";

const MARKETS = ["Arambagh", "Waterpump"];

describe("SurveyForm validation", () => {
  it("blocks submit and shows errors when required fields are empty", async () => {
    const onSubmit = vi.fn();
    render(<SurveyForm onSubmit={onSubmit} markets={MARKETS} />);
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText(/shop name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/select a market/i)).toBeInTheDocument();
    expect(screen.getByText(/capture the shop location/i)).toBeInTheDocument();
    expect(screen.getByText(/add a front photo/i)).toBeInTheDocument();
  });

  it("shows a phone-format error for a bad number", async () => {
    render(<SurveyForm onSubmit={vi.fn()} markets={MARKETS} />);
    await userEvent.type(screen.getByLabelText(/customer number/i), "12345");
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(await screen.findByText(/valid pakistani mobile number/i)).toBeInTheDocument();
  });

  it("requires a typed name when a brand is set to Other", async () => {
    render(<SurveyForm onSubmit={vi.fn()} markets={MARKETS} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /most selling fan/i }), "Other");
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(await screen.findByText(/enter the brand name/i)).toBeInTheDocument();
  });
});
```

In `tests/unit/survey-edit-form.test.tsx`, pass `markets={["Arambagh"]}` (the
fixture `survey.market` is `"Arambagh"`) to all four `<SurveyEditForm>`
renders — replace each render call:

```tsx
render(<SurveyEditForm survey={survey} media={media} markets={["Arambagh"]} onSaved={vi.fn()} />);
```
```tsx
render(<SurveyEditForm survey={survey} media={media} markets={["Arambagh"]} onSaved={onSaved} />);
```
```tsx
render(<SurveyEditForm survey={survey} media={media} markets={["Arambagh"]} onSaved={vi.fn()} onDirty={onDirty} />);
```
```tsx
render(<SurveyEditForm survey={survey} media={media} markets={["Arambagh"]} onSaved={vi.fn()} />);
```
(Leave the rest of the file — imports, mocks, fixtures, assertions — unchanged.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- survey-fields.test.tsx survey-form-validation.test.tsx survey-edit-form.test.tsx`
Expected: FAIL — `markets` is not an accepted prop yet (TypeScript errors) /
`validateSurvey`/`validateSurveyEdit` calls inside the components are missing
an argument.

- [ ] **Step 3: Update `components/form/SurveyFields.tsx`**

Change line 7 to drop the `MARKETS` import:
```ts
import { SHOP_SIZES } from "@/lib/constants";
```
Change the function signature and the market `SelectField`'s `options`:
```tsx
export function SurveyFields({
  v, set, errors, markets, photos, voice,
}: {
  v: SurveyFormValues;
  set: <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => void;
  errors: Record<string, string>;
  markets: string[];
  photos: React.ReactNode;
  voice: React.ReactNode;
}) {
  return (
    <>
      <TextField label="Shop name" name="shop_name" value={v.shop_name}
        onChange={(x) => set("shop_name", x)} error={errors.shop_name} />
      <SelectField label="Market" name="market" value={v.market}
        onChange={(x) => set("market", x)} error={errors.market} options={markets} placeholder="Choose a market" />
```
(The rest of the JSX — shop size onward — is unchanged.)

- [ ] **Step 4: Update `components/form/SurveyForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceRecorder } from "./VoiceRecorder";
import { SurveyFields } from "./SurveyFields";
import { validateSurvey, type SurveyFormValues, type GpsFix } from "@/lib/validation";

const EMPTY: SurveyFormValues = {
  shop_name: "", market: "", shop_size: "", customer_name: "", customer_number: "",
  gps: null, most_selling_fan: "", rec_30w_1: "", rec_30w_2: "", rec_50w_1: "", rec_50w_2: "",
  most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "",
  frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
};

export function SurveyForm({ onSubmit, onDirty, markets }: {
  onSubmit: (v: SurveyFormValues) => Promise<void>;
  onDirty?: () => void;
  markets: string[];
}) {
  const [v, setV] = useState<SurveyFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => {
    onDirty?.();
    setV((s) => ({ ...s, [k]: val }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSurvey(v, markets);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try { await onSubmit(v); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-28">
      <h1 className="text-xl font-semibold">New shop survey</h1>

      <SurveyFields
        v={v}
        set={set}
        errors={errors}
        markets={markets}
        photos={
          <div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos || errors.quotationPhotos ? "true" : undefined}>
            <PhotoCapture
              front={v.frontPhoto} inner={v.innerPhotos} quotation={v.quotationPhotos}
              onFrontChange={(f) => set("frontPhoto", f)}
              onInnerChange={(files) => set("innerPhotos", files)}
              onQuotationChange={(f) => set("quotationPhotos", f)}
            />
            {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
            {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
            {errors.quotationPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.quotationPhotos}</span> : null}
          </div>
        }
        voice={
          <div data-region="voice">
            <VoiceRecorder value={v.audio} onChange={(b) => set("audio", b)} />
            {errors.audio ? <span role="alert" className="block text-xs text-red-600">{errors.audio}</span> : null}
          </div>
        }
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 text-base font-medium text-white disabled:opacity-60">
          {busy ? "Submitting…" : "Submit survey"}
        </button>
      </div>
    </form>
  );
}

export { EMPTY as EMPTY_SURVEY };
```

- [ ] **Step 5: Update `components/form/SurveyEditForm.tsx`**

Change the function signature (was lines 41–49) and the two call sites that
need `markets`:

```tsx
export function SurveyEditForm({
  survey, media, markets, onSaved, onDirty,
}: {
  survey: SurveyWithRelations;
  media: EditMedia;
  markets: string[];
  onSaved: () => void;
  onDirty?: () => void;
}) {
```

Change the `validateSurveyEdit` call (was line 97):
```tsx
const errs = validateSurveyEdit(v, counts, markets);
```

Change the `<SurveyFields>` call (was lines 131–134) to add `markets={markets}`:
```tsx
      <SurveyFields
        v={v}
        set={set}
        errors={errors}
        markets={markets}
        photos={
```
(Everything else in the file is unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- survey-fields.test.tsx survey-form-validation.test.tsx survey-edit-form.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/form/SurveyFields.tsx components/form/SurveyForm.tsx components/form/SurveyEditForm.tsx \
  tests/unit/survey-fields.test.tsx tests/unit/survey-form-validation.test.tsx tests/unit/survey-edit-form.test.tsx
git commit -m "refactor: thread markets prop through SurveyFields/SurveyForm/SurveyEditForm"
```

---

### Task 10: Split `app/survey/new/page.tsx` into a server fetch + client form

**Files:**
- Create: `app/survey/new/NewSurveyClient.tsx`
- Modify: `app/survey/new/page.tsx`

**Interfaces:**
- Consumes: `getMarkets` (Task 3), `SurveyForm` with its new `markets` prop
  (Task 9).
- Produces: `NewSurveyClient({ markets: string[] })`.

No unit test — this route has no existing unit test (its behavior is covered
by `tests/unit/survey-form-validation.test.tsx` at the `SurveyForm` level and
`tests/e2e/full-flow.spec.ts` end-to-end); this task is a structural move with
no new logic.

- [ ] **Step 1: Create `app/survey/new/NewSurveyClient.tsx`**

This is today's `app/survey/new/page.tsx` body, renamed, with a `markets`
prop threaded into `<SurveyForm>`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SurveyForm } from "@/components/form/SurveyForm";
import { submitSurvey } from "@/lib/submitSurvey";
import { useToast } from "@/components/Toast";
import type { SurveyFormValues } from "@/lib/validation";

export function NewSurveyClient({ markets }: { markets: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState("");
  const dirty = useRef(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function handleSubmit(v: SurveyFormValues) {
    setError("");
    try {
      dirty.current = false;
      await submitSurvey(v);
      toast("Survey submitted", "success");
      router.push("/dashboard");
    } catch (e) {
      dirty.current = true;
      setError((e as Error).message);
      toast((e as Error).message, "error");
    }
  }

  return (
    <>
      {error ? <p role="alert" className="mx-auto max-w-md px-4 pt-4 text-sm text-red-600">{error}</p> : null}
      <SurveyForm onSubmit={handleSubmit} onDirty={() => { dirty.current = true; }} markets={markets} />
    </>
  );
}
```

- [ ] **Step 2: Replace `app/survey/new/page.tsx`**

```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { getMarkets } from "@/lib/markets";
import { NewSurveyClient } from "./NewSurveyClient";

export default async function NewSurveyPage() {
  const supabase = await createServerSupabase();
  const markets = await getMarkets(supabase);
  return <NewSurveyClient markets={markets.map((m) => m.name)} />;
}
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add app/survey/new/NewSurveyClient.tsx app/survey/new/page.tsx
git commit -m "refactor: fetch markets server-side for the new-survey page"
```

---

### Task 11: `survey/[id]/edit` — thread `markets` through

**Files:**
- Modify: `app/survey/[id]/edit/page.tsx:1-4,13,40-45`
- Modify: `app/survey/[id]/edit/EditClient.tsx:8-32`

**Interfaces:**
- Consumes: `getMarkets` (Task 3), `SurveyEditForm` with its new `markets`
  prop (Task 9).

No unit test — this route has no existing unit test either; its behavior is
covered by `tests/unit/survey-edit-form.test.tsx` at the `SurveyEditForm`
level.

- [ ] **Step 1: Update `app/survey/[id]/edit/page.tsx`**

Add the `getMarkets` import (alongside the existing imports) and fetch/pass
markets. Full resulting file:

```tsx
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMarkets } from "@/lib/markets";
import { getSignedMediaUrls } from "../actions";
import { EditClient } from "./EditClient";
import type { SurveyWithRelations } from "@/lib/types";

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("surveys")
    .select("*, rep:profiles!surveys_rep_id_fkey(id, username, full_name), photos:survey_photos(*)")
    .eq("id", id)
    .single();
  if (error || !data) notFound();

  // Owner rep only. Admin editing is out of scope for this feature.
  if (data.rep_id !== profile.id) notFound();

  const signed = await getSignedMediaUrls(id);
  const markets = await getMarkets(supabase);

  // If any photo row failed to mint a signed URL, do NOT render the edit form:
  // update_survey reconciles photos by delete+reinsert from the payload, so a
  // row missing from the form's "existing media" would be permanently dropped.
  if (signed.photos.length !== (data.photos?.length ?? 0)) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-sm">
        <p>Some photos for this survey could not be loaded. Please try again in a moment.</p>
        <a href={`/survey/${id}`} className="mt-4 inline-block text-blue-600 underline">
          Back to survey
        </a>
      </main>
    );
  }

  return (
    <EditClient
      survey={data as SurveyWithRelations}
      media={{ photos: signed.photos, audioUrl: signed.audio }}
      markets={markets.map((m) => m.name)}
    />
  );
}
```

- [ ] **Step 2: Update `app/survey/[id]/edit/EditClient.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SurveyEditForm } from "@/components/form/SurveyEditForm";
import { useToast } from "@/components/Toast";
import type { SurveyWithRelations } from "@/lib/types";

export function EditClient({ survey, media, markets }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[]; audioUrl: string | null };
  markets: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const dirty = useRef(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <SurveyEditForm
      survey={survey}
      media={media}
      markets={markets}
      onDirty={() => { dirty.current = true; }}
      onSaved={() => {
        dirty.current = false;
        toast("Changes saved", "success");
        router.push(`/survey/${survey.id}`);
      }}
    />
  );
}
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add app/survey/[id]/edit/page.tsx app/survey/[id]/edit/EditClient.tsx
git commit -m "refactor: fetch markets server-side for the survey edit page"
```

---

### Task 12: `SurveyFilterBar` + `admin/surveys/page.tsx`

**Files:**
- Modify: `components/admin/SurveyFilterBar.tsx:1,3,9-14`
- Modify: `app/admin/surveys/page.tsx:1-2,19-21,37`

**Interfaces:**
- Consumes: `getMarkets` (Task 3).
- Produces: `SurveyFilterBar({ markets: string[], reps, current })`.

No unit test — `SurveyFilterBar` has no existing unit test (it's a thin
server-rendered `<form>`); covered by `tests/e2e/admin-surveys.spec.ts`.

- [ ] **Step 1: Update `components/admin/SurveyFilterBar.tsx`**

```tsx
export function SurveyFilterBar({ markets, reps, current }: {
  markets: string[];
  reps: { id: string; username: string }[];
  current: Record<string, string>;
}) {
  return (
    <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs font-medium">Market
        <select name="market" defaultValue={current.market ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All</option>
          {markets.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium">Rep
        <select name="repId" defaultValue={current.repId ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All</option>
          {reps.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
        </select>
      </label>
      <label className="flex flex-col text-xs font-medium">From
        <input type="date" name="from" defaultValue={current.from ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">To
        <input type="date" name="to" defaultValue={current.to ?? ""} className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <label className="flex flex-col text-xs font-medium">Search
        <input name="q" defaultValue={current.q ?? ""} placeholder="Shop or customer" className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm" /></label>
      <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Apply</button>
      <a href="/admin/surveys" className="rounded border border-slate-300 px-3 py-2 text-sm">Reset</a>
    </form>
  );
}
```

- [ ] **Step 2: Update `app/admin/surveys/page.tsx`**

Add the `getMarkets` import and fetch, and pass `markets` to
`SurveyFilterBar`:

```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSurveysPage, PAGE_SIZE, type SurveyFilter } from "@/lib/adminQueries";
import { getMarkets } from "@/lib/markets";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveyTable } from "@/components/admin/SurveyTable";
import { ExportButton } from "@/components/admin/ExportButton";

export default async function AdminSurveysPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const parsedPage = parseInt(sp.page ?? "", 10);
  const filter: SurveyFilter = {
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 0,
  };

  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const markets = await getMarkets(db);
  const { rows, total } = await getSurveysPage(db, filter);
  const page = filter.page ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const u = new URLSearchParams(sp as Record<string, string>);
    u.set("page", String(p));
    return `?${u.toString()}`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} survey(s)</p>
        <ExportButton filter={filter} />
      </div>
      <SurveyFilterBar markets={markets.map((m) => m.name)} reps={reps ?? []} current={sp} />
      <SurveyTable rows={rows} />
      <div className="mt-4 flex items-center justify-between text-sm">
        <a aria-disabled={page <= 0} href={qs(Math.max(0, page - 1))}
          className={`rounded border px-3 py-1.5 ${page <= 0 ? "pointer-events-none opacity-40" : ""}`}>Previous</a>
        <span>Page {page + 1} of {pages}</span>
        <a aria-disabled={page + 1 >= pages} href={qs(page + 1)}
          className={`rounded border px-3 py-1.5 ${page + 1 >= pages ? "pointer-events-none opacity-40" : ""}`}>Next</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add components/admin/SurveyFilterBar.tsx app/admin/surveys/page.tsx
git commit -m "refactor: fetch markets server-side for the admin surveys filter"
```

---

### Task 13: `SurveysMap` + `admin/map/page.tsx`

**Files:**
- Modify: `components/SurveysMap.tsx`
- Modify: `app/admin/map/page.tsx`

**Interfaces:**
- Consumes: `getMarkets` (Task 3), `SurveyFilterBar` with its new `markets`
  prop (Task 12).
- Produces: `SurveysMap({ points, markets: {name,color}[] })`.

No unit test — `SurveysMap` has no existing unit test (it wraps
`react-leaflet`, which the project's own test notes say crashes in jsdom);
covered by the manual `/admin/map` check `CLAUDE.md` already calls out after
Leaflet-related changes.

- [ ] **Step 1: Update `components/SurveysMap.tsx`**

```tsx
"use client";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { KARACHI_CENTER, KARACHI_ZOOM } from "@/lib/constants";

export type MapPoint = {
  id: string; lat: number; lng: number; shop_name: string; market: string; rep_username: string; created_at: string;
};

type MarketOption = { name: string; color: string };

const Inner = dynamic(async () => {
  const RL = await import("react-leaflet");
  const { MapContainer, TileLayer, CircleMarker, Popup, useMap } = RL;
  const L = await import("leaflet");

  function Fit({ points }: { points: MapPoint[] }) {
    const map = useMap();
    if (points.length) {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
    }
    return null;
  }

  return function MapInner({ points, colorByMarket }: { points: MapPoint[]; colorByMarket: Record<string, string> }) {
    return (
      <MapContainer center={KARACHI_CENTER} zoom={KARACHI_ZOOM} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors" />
        <Fit points={points} />
        {points.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7}
            pathOptions={{ color: colorByMarket[p.market] ?? "#0f172a", fillOpacity: 0.85 }}>
            <Popup>
              <strong>{p.shop_name}</strong><br />
              {p.market} · {p.rep_username}<br />
              {new Date(p.created_at).toLocaleDateString("en-GB")}<br />
              <a href={`/survey/${p.id}`}>Open survey</a>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    );
  };
}, { ssr: false });

export function SurveysMap({ points, markets }: { points: MapPoint[]; markets: MarketOption[] }) {
  const colorByMarket = Object.fromEntries(markets.map((m) => [m.name, m.color]));
  return (
    <div className="flex flex-col gap-3">
      <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200">
        <Inner points={points} colorByMarket={colorByMarket} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {markets.map((m) => (
          <li key={m.name} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: m.color }} />
            {m.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/admin/map/page.tsx`**

```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildSurveyQuery, type SurveyFilter } from "@/lib/adminQueries";
import { getMarkets } from "@/lib/markets";
import { SurveyFilterBar } from "@/components/admin/SurveyFilterBar";
import { SurveysMap, type MapPoint } from "@/components/SurveysMap";

export default async function AdminMapPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter: SurveyFilter & { all: true } = {
    all: true,
    market: sp.market || undefined,
    repId: sp.repId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    q: sp.q || undefined,
  };
  const db = createAdminSupabase();
  const { data: reps } = await db.from("profiles").select("id, username").eq("role", "rep").order("username");
  const markets = await getMarkets(db);
  const base = db.from("surveys").select(
    "id, shop_name, market, gps_lat, gps_lng, created_at, profiles!surveys_rep_id_fkey(username)",
  );
  const { data } = await buildSurveyQuery(base, filter);
  const points: MapPoint[] = (data ?? []).map((r: any) => ({
    id: r.id, lat: r.gps_lat, lng: r.gps_lng, shop_name: r.shop_name, market: r.market,
    rep_username: r.profiles?.username ?? "—", created_at: r.created_at,
  }));

  return (
    <div>
      <SurveyFilterBar markets={markets.map((m) => m.name)} reps={reps ?? []} current={sp} />
      <SurveysMap points={points} markets={markets} />
    </div>
  );
}
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add components/SurveysMap.tsx app/admin/map/page.tsx
git commit -m "refactor: fetch markets server-side for the admin map"
```

---

### Task 14: `app/admin/overview/page.tsx`

**Files:**
- Modify: `app/admin/overview/page.tsx`

**Interfaces:**
- Consumes: `getMarkets` (Task 3), `countByMarket(surveys, markets)` (Task 6).

No unit test — this page has no existing unit test; its aggregation logic is
covered by `tests/unit/aggregations.test.ts`.

- [ ] **Step 1: Update `app/admin/overview/page.tsx`**

```tsx
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getMarkets } from "@/lib/markets";
import { StatTile } from "@/components/StatTile";
import { BarChartCard } from "@/components/BarChartCard";
import {
  countByMarket, countByRep, countMostSellingFan, countRecommendedBrands, overviewStats,
} from "@/lib/aggregations";

export default async function AdminOverviewPage() {
  const db = createAdminSupabase();
  const markets = await getMarkets(db);
  const marketNames = markets.map((m) => m.name);
  const { data: raw } = await db.from("surveys").select(
    "market, most_selling_fan, rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, profiles!surveys_rep_id_fkey(username)",
  );
  const surveys = (raw ?? []).map((r: any) => ({ ...r, rep_username: r.profiles?.username ?? "—" }));
  const { count: activeReps } = await db.from("profiles")
    .select("id", { count: "exact", head: true }).eq("role", "rep").eq("active", true);

  const stats = overviewStats(surveys);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total surveys" value={stats.totalSurveys} />
        <StatTile label="Active reps" value={activeReps ?? 0} />
        <StatTile label="Markets covered" value={`${stats.marketsCovered} / ${marketNames.length}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BarChartCard title="Shop count by market" data={countByMarket(surveys, marketNames)} />
        <BarChartCard title="Survey count by rep" data={countByRep(surveys)} />
        <BarChartCard title="Most selling fan" data={countMostSellingFan(surveys)} />
        <BarChartCard title="Recommended brands (30W + 50W)" data={countRecommendedBrands(surveys)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add app/admin/overview/page.tsx
git commit -m "refactor: fetch markets server-side for the admin overview page"
```

---

### Task 15: Integration test — RLS + rename cascade + delete restriction

**Files:**
- Create: `tests/integration/markets.test.ts`

**Interfaces:**
- Consumes: `serviceClient`, `signInAs` from `tests/setup/supabase-test-client`
  (existing).

This suite is in the repo's "authored, never run" set (per `CLAUDE.md`); write
and commit it regardless, and run it if a local Docker-backed Supabase is
available in this environment.

- [ ] **Step 1: Write `tests/integration/markets.test.ts`**

```ts
import { describe, it, expect, afterAll } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1_ID = "10000000-0000-0000-0000-000000000002";

describe("markets", () => {
  afterAll(async () => {
    const db = serviceClient();
    await db.from("markets").delete().eq("name", "Integration Test Market");
    await db.from("markets").update({ name: "UP" }).eq("name", "University Road");
  });

  it("a rep can read the markets list", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const { data, error } = await rep.from("markets").select("name");
    expect(error).toBeNull();
    expect(data?.some((m: any) => m.name === "Arambagh")).toBe(true);
  });

  it("a rep cannot insert a market", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep.from("markets").insert({ name: "Integration Test Market", color: "#000000", sort_order: 99 });
    expect(error).not.toBeNull();
  });

  it("a rep cannot rename a market", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep.from("markets").update({ name: "Should Not Work" }).eq("name", "MA Jinnah");
    expect(error).not.toBeNull();

    const db = serviceClient();
    const { data } = await db.from("markets").select("name").eq("name", "MA Jinnah");
    expect(data?.length).toBe(1);
  });

  it("the admin can insert a market", async () => {
    const admin = await signInAs("admin@survey.local", "test-pass-123");
    const { error } = await admin.from("markets").insert({ name: "Integration Test Market", color: "#000000", sort_order: 99 });
    expect(error).toBeNull();
  });

  it("renaming a market cascades to existing surveys referencing it", async () => {
    const db = serviceClient();
    const surveyId = "66666666-6666-6666-6666-666666666666";
    await db.from("surveys").insert({
      id: surveyId, rep_id: REP1_ID,
      shop_name: "Cascade Test", market: "UP", shop_size: "Small",
      customer_name: "c", customer_number: "03001234567",
      gps_lat: 24.9, gps_lng: 67.1, most_selling_fan: "GFC",
      rec_30w_1: "GFC", rec_50w_1: "GFC",
    });

    const admin = await signInAs("admin@survey.local", "test-pass-123");
    await admin.from("markets").update({ name: "University Road" }).eq("name", "UP");

    const { data } = await db.from("surveys").select("market").eq("id", surveyId).single();
    expect(data?.market).toBe("University Road");

    await db.from("surveys").delete().eq("id", surveyId);
    await admin.from("markets").update({ name: "UP" }).eq("name", "University Road");
  });

  it("deleting a market that has surveys attached is blocked by the FK", async () => {
    const db = serviceClient();
    // seed.sql's "Malir Fan House" survey references the Malir market.
    const { error } = await db.from("markets").delete().eq("name", "Malir");
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it if a local Supabase is available**

Run: `npm run db:start` (if not already running), then `npm run db:reset`,
then `npm run test:integration -- markets.test.ts`
Expected: PASS. If Docker is unavailable in this environment, skip this step
and note it in the task summary — the file is still committed.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/markets.test.ts
git commit -m "test: add markets RLS + rename-cascade + delete-restriction integration tests"
```

---

### Task 16: e2e test — admin adds/renames a market

**Files:**
- Create: `tests/e2e/admin-markets.spec.ts`

**Interfaces:**
- Consumes: the `/admin/housekeeping` UI from Task 8 (the "New market name"
  input, "Add market" button, and the per-row `Rename {name}` button/input).

This suite is in the repo's "authored, never run" set (per `CLAUDE.md`); write
and commit it regardless.

- [ ] **Step 1: Write `tests/e2e/admin-markets.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("admin adds a market and a rep sees it in the survey form", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/admin/housekeeping");
  await page.getByLabel("New market name").fill("E2E Test Market");
  await page.getByRole("button", { name: "Add market" }).click();
  await expect(page.getByText("E2E Test Market")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Username").fill("rep.one");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/survey/new");
  await expect(page.getByLabel("Market").locator('option[value="E2E Test Market"]')).toHaveCount(1);
});

test("admin renames a market and the new name shows in the surveys filter", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("test-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.goto("/admin/housekeeping");
  await page.getByRole("button", { name: "Rename Waterpump" }).click();
  await page.getByLabel("Rename Waterpump").fill("Water Pump Chowk");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Water Pump Chowk")).toBeVisible();

  await page.goto("/admin/surveys");
  await expect(page.getByLabel("Market").locator('option[value="Water Pump Chowk"]')).toHaveCount(1);
});
```

- [ ] **Step 2: Run it if a local stack is available**

Run: `npm run db:start` (if not already running), `npm run db:reset`, start
the dev server, then `npm run e2e -- admin-markets.spec.ts`
Expected: PASS. If the local stack is unavailable in this environment, skip
this step and note it in the task summary — the file is still committed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-markets.spec.ts
git commit -m "test: add e2e coverage for adding and renaming a market"
```

---

### Task 17: Docs — `CLAUDE.md` + `docs/DEPLOYMENT.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Update `CLAUDE.md`**

In the **Hard rules** section, replace the "Fixed lists live in one place"
bullet's market sentence. Change:

```
- **Fixed lists live in one place** (`lib/constants.ts`) and are mirrored by
  Postgres `CHECK` constraints. Markets: Arambagh, MA Jinnah, Waterpump,
  Bohrapir, Johar Mor, UP, Liaquatabad, Shah Faisal Colony, Orangi Town, Baldia
  Town, Malir, Landhi/Korangi. Brands: Tamoor, Khurshid, SK, GFC, Royal, Pak
  Fans, Lahore Fans, plus the free-text `"Other"` option. ...
```

to:

```
- **Markets are admin-managed**, not a fixed list. They live in
  `public.markets` (`name` primary key, `color`, `sort_order`), fetched via
  `lib/markets.ts`'s `getMarkets()` and threaded through every page/component
  that needs them (no more static `MARKETS` import). `surveys.market` is a
  foreign key to `markets(name)` with `on update cascade` (an admin rename is
  retroactive — it updates every survey referencing that market, past and
  future) and `on delete restrict` (no delete UI is built; the DB itself
  blocks deleting a market that's in use). Only the admin can add/rename a
  market (`app/admin/housekeeping/actions.ts`'s `addMarket`/`renameMarket`,
  RLS-gated by `is_admin()`); any authenticated user can read the list. A new
  market's color auto-assigns from `MARKET_COLOR_PALETTE` in
  `lib/constants.ts`.
- **Other fixed lists still live in one place** (`lib/constants.ts`) and are
  mirrored by Postgres `CHECK` constraints. Brands: Tamoor, Khurshid, SK, GFC,
  Royal, Pak Fans, Lahore Fans, plus the free-text `"Other"` option. ...
```
(Keep the rest of that bullet — the `'Other'`/`<field>_other` pairing rule,
exports, shop sizes — unchanged, just under the renamed second bullet.)

In the **Status** section, update:
```
- Backed by a hosted Supabase project. Migrations `0001`–`0006` are applied
```
to:
```
- Backed by a hosted Supabase project. Migrations `0001`–`0007` are applied
```
(only once `0007` is actually applied to the hosted project — if this plan is
executed before that happens, leave the range at `0006` and note `0007` is
pending, matching how `0006` itself was called out before it was applied; see
`docs/DEPLOYMENT.md` Step 2d in Step 2 below for the apply procedure).

In the **Layout** section, add `lib/markets.ts` to the `lib/` line and
`components/admin/MarketsSection.tsx` is implied by the existing `admin/`
glob — no line addition needed there, but confirm the `lib/` line reads:
```
lib/         supabase clients, constants, validation, geo, compression, audio,
            adminQueries, aggregations, exportSurveys, submitSurvey, updateSurvey,
            uploadEditedMedia, upload, markets,
            format (date + `brandDisplay` — folds an `'Other'` brand's typed name)
```

In the **Development** section's migration bullet list, add a sentence after
the existing `0006` note:
```
`0007` (admin-managed markets) is idempotent-guarded (`create table if not
exists`, `on conflict do nothing`, `drop constraint/policy if exists` before
recreating).
```

In the **Testing** section, refresh the unit-test count (run `npm test` after
finishing this plan and update the "111 unit tests" figure wherever it's
cited).

- [ ] **Step 2: Update `docs/DEPLOYMENT.md`**

In the migration bullet list (around the existing `0005`/`0006` bullets), add:
```
- `0007_markets_table.sql` — admin-managed markets: `markets` table, seeds the
  12 current markets, `surveys.market` becomes a FK with `on update cascade` /
  `on delete restrict` (see below)
```

After the existing "Step 2c — Rep survey editing migration (0006)" section,
add a new section following the same structure:

```markdown
### Step 2d — Admin-managed markets migration (0007)

If the app is already live with `0006`, migration `0007` must be applied to
the hosted database **before** deploying the markets-management feature. The
migration is backward-compatible; existing surveys keep their current market
value (now enforced by a foreign key instead of a `CHECK`).

Apply `0007` via the Supabase SQL Editor (as with `0005`/`0006`), or via
`supabase db push` only after the `0005` and `0006` migration ledger rows have
been inserted (Steps 2b/2c) — otherwise `db push` re-runs all three.

1. Open the hosted project's SQL Editor.
2. Copy the entire contents of `supabase/migrations/0007_markets_table.sql`
   and paste it into the editor.
3. Run it.
4. **Record the migration in the ledger.** Run this in the same SQL Editor:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('0007', 'markets_table')
   on conflict (version) do nothing;
   ```
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/DEPLOYMENT.md
git commit -m "docs: markets are now admin-managed (0007 migration, hard rule, layout)"
```

---

### Task 18: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: all tests pass, including every file touched in Tasks 2, 5, 6, 7, 9.

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors. This is the point where every `MARKETS`/`Market`
reference removed in Task 2 should have no remaining consumers — if `tsc`
reports a missing import, find and fix the straggler before proceeding.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: succeeds. The only allowed warnings are the two existing
`@next/next/no-img-element` in `PhotoCapture.tsx` / `MediaGallery.tsx`.

- [ ] **Step 4: Manual check of `/admin/map` and `/survey/new`**

Per `CLAUDE.md`'s existing note that react-leaflet changes warrant a fresh
browser check: with the dev server running (`npm run dev`) and a Supabase
connection configured, open `/admin/map` and confirm markers/legend render
with colors, and open `/survey/new` and confirm the Market dropdown is
populated. If no live Supabase connection is available in this environment,
note that this step was skipped in the task summary.

- [ ] **Step 5: Update the unit-test count in `CLAUDE.md`**

Take the total from Step 1's `npm test` output and update every place in
`CLAUDE.md` that cites the old count (currently "111 unit tests").

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: refresh unit-test count after markets management work"
```

---

## Self-Review

**Spec coverage:**
- §1 (schema, FK, RLS) → Task 1.
- §2 (auto-color palette) → Task 2 (`MARKET_COLOR_PALETTE`), Task 7
  (`addMarket`'s `count % length` assignment).
- §3 (admin actions) → Task 7.
- §4 (admin UI) → Task 8.
- §5 (threading through the app, file-by-file) → Tasks 9–14, matching the
  spec's table one row at a time.
- §6.1 (unit tests) → Tasks 2, 3, 6, 7, 9 test files; §6.2 (integration) →
  Task 15; §6.3 (e2e) → Task 16; §6.4 (gates) → Task 18.
- §7 (docs) → Task 17.
- Out-of-scope items (delete UI, per-market metadata, reordering, color
  picker, audit trail) → deliberately absent from every task; the FK's `on
  delete restrict` (Task 1) is the only delete-related code, and it's a
  safety guard, not a feature.

**Placeholder scan:** no "TBD"/"TODO" remain; every code step has literal,
complete file contents or exact diffs; every test has real assertions.

**Type consistency:** `getMarkets` returns `{name: string; color: string}[]`
everywhere it's introduced (Task 3) and consumed identically in Tasks 8, 12,
13, 14 (`.map((m) => m.name)` where only names are needed). `validateSurvey`/
`validateScalarFields`/`validateSurveyEdit`'s `markets: readonly string[]`
parameter (Task 5) matches the `markets: string[]` prop threaded through
`SurveyForm`/`SurveyEditForm`/`SurveyFields` (Task 9) — `string[]` is
assignable to `readonly string[]`. `countByMarket(surveys, markets: readonly
string[])` (Task 6) matches the `marketNames: string[]` passed from Task 14.
`addMarket`/`renameMarket` (Task 7) signatures match the calls in
`MarketsSection` (Task 8).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-16-market-management.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

# Survey Form v2 Implementation Plan — "Other" brands + Quotation photo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Other… (type the name)" option to every brand dropdown on the survey form, and a new optional "Quotation" photo category (0–2 images), end to end — schema, RPC, form, submit pipeline, detail view, export, and charts.

**Architecture:** One new migration (`0005_survey_form_v2.sql`) allows `'Other'` in the 5 brand `CHECK` constraints, adds 5 nullable companion text columns for the typed name, allows `'quotation'` in `survey_photos.kind`, and `create or replace`s `create_survey`. The app already stores fixed brand lists in `lib/constants.ts` and validates in `lib/validation.ts`; those plus the form components, `lib/upload.ts`, the detail action, `lib/exportSurveys.ts`, and `lib/aggregations.ts` are extended. Charts stay clean by counting an `Other` bucket; the export folds the typed name into the existing brand column.

**Tech Stack:** Next.js 15.5.x, React 19, TypeScript, Tailwind, `@supabase/ssr` + `@supabase/supabase-js`, `browser-image-compression`, Supabase Postgres. Vitest + `@testing-library/react` for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-08-survey-form-v2-design.md` (read it alongside this plan).

## Global Constraints

- **Node** 20+; **npm**.
- **The app is live.** `supabase/migrations/0005_survey_form_v2.sql` is authored and committed but **not run locally** (no Docker / Supabase CLI here). It is applied to the **hosted** Supabase project via the SQL Editor **before** the code deploys — the replaced `create_survey` is backward-compatible (all new params optional/nullable), so the live app keeps working between the two steps. Verify `0005` by inspection + that the RPC's inserted columns match the `SurveyRpcPayload` keys.
- **`npm test` (Vitest unit) must stay green.** `tests/integration/**` and `tests/e2e/**` are authored, never executed here. The vitest CLI does **not** filter on `|` — run test names as separate commands.
- **jsdom `File`/`Blob` in this repo's Vitest setup has no `arrayBuffer()`** — test mocks must never call it; use plain `new File([new Uint8Array(n)], name, { type })`.
- Pre-approved test-tooling adaptations (used throughout the repo): `import { beforeAll, afterEach } from "vitest"`, `import type { Mock } from "vitest"` + `as unknown as Mock`.
- All dropdowns are **native `<select>`**.
- `npm run build` must succeed. The known `@next/next/no-img-element` warnings (`PhotoCapture.tsx`, `MediaGallery.tsx`) are acceptable; the new quotation thumbnails add more of the **same** warning on blob/signed-URL `<img>` — also acceptable, do **not** add lint-disables.
- Exact literals: the "other" sentinel is the string `"Other"`. Typed brand name: **trimmed, 1–40 chars** (`MAX_OTHER_BRAND_LEN = 40`). Quotation photos: **0–2** (`MAX_QUOTATION_PHOTOS = 2`), optional.
- The 7 canonical brands stay in `BRANDS` unchanged: `Tamoor`, `Khurshid`, `SK`, `GFC`, `Royal`, `Pak Fans`, `Lahore Fans`.
- **Migrations are append-only** — never edit `0001`–`0004`; all new DDL goes in `0005`.
- Conventional Commits. Append to every commit message:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01MLkh57YtiPBjQcQNrzVWBW
  ```

## File Structure

| File | Change |
|---|---|
| `lib/constants.ts` | + `OTHER_BRAND`, `BRAND_SELECT_OPTIONS`, `MAX_QUOTATION_PHOTOS`, `MAX_OTHER_BRAND_LEN` |
| `lib/types.ts` | `SurveyPhoto.kind` gains `"quotation"`; `Survey` brand fields → `Brand \| "Other"`, + 5 `*_other` fields |
| `supabase/migrations/0005_survey_form_v2.sql` | **new** — CHECK swaps, 5 columns, `create_survey` replace |
| `lib/validation.ts` | `SurveyFormValues` + `SurveyRpcPayload` new fields; brand + quotation rules; payload mapping |
| `lib/compression.ts` | refactor to a shared helper; add `compressDocument` |
| `components/form/BrandField.tsx` | **new** — select + conditional "type it in" input |
| `components/form/PhotoCapture.tsx` | shared add-photos handler; new "Quotation" section |
| `components/form/SurveyForm.tsx` | 5 `SelectField`→`BrandField`; wire quotation; `EMPTY_SURVEY` |
| `lib/upload.ts` | upload `quotation-<i>.jpg`; return `quotation: string[]` |
| `app/survey/[id]/actions.ts` | widen `kind`; front→inner→quotation ordering |
| `components/SurveyDetail.tsx` | quotation gallery section; `Other — "name"` brand rows |
| `components/MediaGallery.tsx` | `kind` union + quotation `alt` text |
| `lib/exportSurveys.ts` | brand-cell fold; `quotation_photo_urls` column |
| `lib/aggregations.ts` | `Other` bucket in the two brand charts |
| `CLAUDE.md`, `docs/DEPLOYMENT.md` | new constants, `quotation` kind, the `0005` deploy step |
| `tests/unit/*` | new `brand-field.test.tsx`; updates to constants / validation / compression / photo-capture / survey-form-validation / submit-survey / signed-urls / export-surveys / aggregations |
| `tests/integration/create-survey-rpc.test.ts` | + quotation-count + `_other` cases (authored, not run) |

`lib/submitSurvey.ts` needs **no change** (it forwards `paths` from `uploadSurveyMedia` straight into `buildSurveyPayload`, and both signatures are updated in tasks 8 and 3).

---

### Task 1: Constants + row types

**Files:**
- Modify: `lib/constants.ts`, `lib/types.ts`
- Test: `tests/unit/constants.test.ts`

**Interfaces:**
- Produces: `OTHER_BRAND = "Other"`, `BRAND_SELECT_OPTIONS: readonly [...Brand[], "Other"]`, `MAX_QUOTATION_PHOTOS = 2`, `MAX_OTHER_BRAND_LEN = 40`. `SurveyPhoto.kind = "front" | "inner" | "quotation"`. `Survey` gains `most_selling_fan_other` / `rec_30w_1_other` / `rec_30w_2_other` / `rec_50w_1_other` / `rec_50w_2_other`, each `string | null`, and its brand fields become `Brand | "Other"`.

- [ ] **Step 1: Add failing test cases**

Append to `tests/unit/constants.test.ts`:
```ts
import { BRAND_SELECT_OPTIONS, OTHER_BRAND, MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN, BRANDS } from "@/lib/constants";

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

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- constants`
Expected: FAIL — `BRAND_SELECT_OPTIONS` / `OTHER_BRAND` etc. not exported.

- [ ] **Step 3: Extend `lib/constants.ts`**

Add after the `BRANDS` / `Brand` block:
```ts
export const OTHER_BRAND = "Other" as const;
export const BRAND_SELECT_OPTIONS = [...BRANDS, OTHER_BRAND] as const;
export const MAX_OTHER_BRAND_LEN = 40;
```
Add near the other `MAX_*` constants:
```ts
export const MAX_QUOTATION_PHOTOS = 2;
```

- [ ] **Step 4: Extend `lib/types.ts`**

```ts
export interface SurveyPhoto {
  id: string;
  survey_id: string;
  kind: "front" | "inner" | "quotation";
  storage_path: string;
  sort_order: number;
}
```
In `Survey`, change the five brand fields and add the five companions:
```ts
  most_selling_fan: Brand | "Other";
  most_selling_fan_other: string | null;
  rec_30w_1: Brand | "Other";
  rec_30w_1_other: string | null;
  rec_30w_2: Brand | "Other" | null;
  rec_30w_2_other: string | null;
  rec_50w_1: Brand | "Other";
  rec_50w_1_other: string | null;
  rec_50w_2: Brand | "Other" | null;
  rec_50w_2_other: string | null;
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- constants` then `npx tsc --noEmit`
Expected: constants tests PASS. `tsc` may now report errors in `SurveyDetail.tsx` / `exportSurveys.ts` / `aggregations.ts` because their `kind` unions / brand reads narrowed — that is expected and fixed in later tasks. If `tsc` fails **only** in those downstream files, proceed; if it fails in `lib/constants.ts` or `lib/types.ts` themselves, fix that.

> Note: to keep the tree green between tasks, if `tsc` breaks downstream files, add a minimal `// @ts-expect-error v2 wip` is NOT allowed. Instead, order-of-work: this task's `npm test` must pass; `tsc` clean is only required again at the end of Task 3 (types fully threaded) and every task after. State in the report which downstream files `tsc` flags now.

- [ ] **Step 6: Commit**

```bash
git add lib/constants.ts lib/types.ts tests/unit/constants.test.ts
git commit -m "feat: add Other-brand + quotation constants and row types"
```

---

### Task 2: Migration `0005` (authored, not run) + integration test cases

**Files:**
- Create: `supabase/migrations/0005_survey_form_v2.sql`
- Modify: `tests/integration/create-survey-rpc.test.ts`

**Interfaces:**
- Produces: `0005` — `'Other'` allowed in the 5 brand CHECKs; 5 nullable `text` columns `*_other` with pairing CHECKs; `'quotation'` allowed in `survey_photos.kind`; `create_survey` replaced to insert the 5 `_other` values, count `quotation` photos (0–2), and reject an `'Other'` brand with a blank name.

- [ ] **Step 1: Author `supabase/migrations/0005_survey_form_v2.sql`**

```sql
-- Survey Form v2: "Other" brand option + Quotation photo kind.

-- 1. Allow 'Other' in every brand CHECK (constraints are auto-named
--    surveys_<col>_check from 0001).
alter table public.surveys
  drop constraint surveys_most_selling_fan_check,
  add  constraint surveys_most_selling_fan_check check (most_selling_fan in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_30w_1_check,
  add  constraint surveys_rec_30w_1_check check (rec_30w_1 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_30w_2_check,
  add  constraint surveys_rec_30w_2_check check (rec_30w_2 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_50w_1_check,
  add  constraint surveys_rec_50w_1_check check (rec_50w_1 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_50w_2_check,
  add  constraint surveys_rec_50w_2_check check (rec_50w_2 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));

-- 2. Companion columns for the typed brand name (only meaningful when the
--    matching brand column = 'Other').
alter table public.surveys
  add column most_selling_fan_other text,
  add column rec_30w_1_other        text,
  add column rec_30w_2_other        text,
  add column rec_50w_1_other        text,
  add column rec_50w_2_other        text;

alter table public.surveys
  add constraint surveys_most_selling_fan_other_ck check (
    (most_selling_fan is distinct from 'Other' and most_selling_fan_other is null)
    or (most_selling_fan = 'Other' and most_selling_fan_other is not null
        and char_length(btrim(most_selling_fan_other)) between 1 and 40)),
  add constraint surveys_rec_30w_1_other_ck check (
    (rec_30w_1 is distinct from 'Other' and rec_30w_1_other is null)
    or (rec_30w_1 = 'Other' and rec_30w_1_other is not null
        and char_length(btrim(rec_30w_1_other)) between 1 and 40)),
  add constraint surveys_rec_30w_2_other_ck check (
    (rec_30w_2 is distinct from 'Other' and rec_30w_2_other is null)
    or (rec_30w_2 = 'Other' and rec_30w_2_other is not null
        and char_length(btrim(rec_30w_2_other)) between 1 and 40)),
  add constraint surveys_rec_50w_1_other_ck check (
    (rec_50w_1 is distinct from 'Other' and rec_50w_1_other is null)
    or (rec_50w_1 = 'Other' and rec_50w_1_other is not null
        and char_length(btrim(rec_50w_1_other)) between 1 and 40)),
  add constraint surveys_rec_50w_2_other_ck check (
    (rec_50w_2 is distinct from 'Other' and rec_50w_2_other is null)
    or (rec_50w_2 = 'Other' and rec_50w_2_other is not null
        and char_length(btrim(rec_50w_2_other)) between 1 and 40));

-- 3. Allow the 'quotation' photo kind.
alter table public.survey_photos
  drop constraint survey_photos_kind_check,
  add  constraint survey_photos_kind_check check (kind in ('front','inner','quotation'));

-- 4. Replace create_survey: write the 5 *_other values, count quotation photos
--    (0-2), and reject an 'Other' brand with no typed name.
create or replace function public.create_survey(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (payload->>'id')::uuid;
  v_photo jsonb;
  v_front int := 0;
  v_inner int := 0;
  v_quotation int := 0;
begin
  if v_id is null then
    raise exception 'payload.id is required';
  end if;

  -- Every brand field set to 'Other' must carry a typed name.
  perform 1 from (values
    (payload->>'most_selling_fan', payload->>'most_selling_fan_other'),
    (payload->>'rec_30w_1',        payload->>'rec_30w_1_other'),
    (payload->>'rec_30w_2',        payload->>'rec_30w_2_other'),
    (payload->>'rec_50w_1',        payload->>'rec_50w_1_other'),
    (payload->>'rec_50w_2',        payload->>'rec_50w_2_other')
  ) as t(brand, other)
  where t.brand = 'Other' and coalesce(btrim(t.other), '') = '';
  if found then
    raise exception 'a brand was set to "Other" without a typed name';
  end if;

  insert into public.surveys (
    id, rep_id, shop_name, market, shop_size, customer_name, customer_number,
    gps_lat, gps_lng, gps_accuracy, most_selling_fan,
    rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, audio_path,
    most_selling_fan_other, rec_30w_1_other, rec_30w_2_other, rec_50w_1_other, rec_50w_2_other
  ) values (
    v_id, auth.uid(),
    payload->>'shop_name', payload->>'market', payload->>'shop_size',
    payload->>'customer_name', payload->>'customer_number',
    (payload->>'gps_lat')::double precision,
    (payload->>'gps_lng')::double precision,
    nullif(payload->>'gps_accuracy', '')::double precision,
    payload->>'most_selling_fan',
    payload->>'rec_30w_1', nullif(payload->>'rec_30w_2', ''),
    payload->>'rec_50w_1', nullif(payload->>'rec_50w_2', ''),
    nullif(payload->>'audio_path', ''),
    nullif(btrim(payload->>'most_selling_fan_other'), ''),
    nullif(btrim(payload->>'rec_30w_1_other'), ''),
    nullif(btrim(payload->>'rec_30w_2_other'), ''),
    nullif(btrim(payload->>'rec_50w_1_other'), ''),
    nullif(btrim(payload->>'rec_50w_2_other'), '')
  );

  for v_photo in select * from jsonb_array_elements(coalesce(payload->'photos', '[]'::jsonb))
  loop
    if (v_photo->>'storage_path') not like auth.uid()::text || '/%' then
      raise exception 'photo storage_path must be under the caller prefix';
    end if;
    insert into public.survey_photos (survey_id, kind, storage_path, sort_order)
    values (v_id, v_photo->>'kind', v_photo->>'storage_path',
            coalesce((v_photo->>'sort_order')::int, 0));
    if v_photo->>'kind' = 'front' then v_front := v_front + 1;
    elsif v_photo->>'kind' = 'inner' then v_inner := v_inner + 1;
    elsif v_photo->>'kind' = 'quotation' then v_quotation := v_quotation + 1;
    end if;
  end loop;

  if v_front <> 1 then
    raise exception 'exactly one front photo required (got %)', v_front;
  end if;
  if v_inner < 1 or v_inner > 10 then
    raise exception 'between 1 and 10 inner photos required (got %)', v_inner;
  end if;
  if v_quotation > 2 then
    raise exception 'at most 2 quotation photos (got %)', v_quotation;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_survey(jsonb) from public, anon;
grant execute on function public.create_survey(jsonb) to authenticated;
```

- [ ] **Step 2: Add integration test cases (authored, not run)**

Append to `tests/integration/create-survey-rpc.test.ts` inside the existing `describe`:
```ts
  it("accepts up to 2 quotation photos", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "aaaa1111-0000-0000-0000-000000000001";
    const p = payload(id, { photos: [
      { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
      { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
      { kind: "quotation", storage_path: `${REP1}/${id}/quotation-0.jpg`, sort_order: 0 },
      { kind: "quotation", storage_path: `${REP1}/${id}/quotation-1.jpg`, sort_order: 1 },
    ] });
    const { error } = await rep.rpc("create_survey", { payload: p });
    expect(error).toBeNull();
  });

  it("rolls back on a 3rd quotation photo", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "aaaa1111-0000-0000-0000-000000000002";
    const q = (n: number) => ({ kind: "quotation", storage_path: `${REP1}/${id}/quotation-${n}.jpg`, sort_order: n });
    const { error } = await rep.rpc("create_survey", { payload: payload(id, { photos: [
      { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
      { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
      q(0), q(1), q(2),
    ] }) });
    expect(error).not.toBeNull();
    const { count } = await serviceClient().from("surveys")
      .select("id", { count: "exact", head: true }).eq("id", id);
    expect(count).toBe(0);
  });

  it("stores an Other brand name and rejects Other with no name", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const ok = "aaaa1111-0000-0000-0000-000000000003";
    const okRes = await rep.rpc("create_survey", {
      payload: payload(ok, { most_selling_fan: "Other", most_selling_fan_other: "Fanco" }),
    });
    expect(okRes.error).toBeNull();
    const { data } = await serviceClient().from("surveys")
      .select("most_selling_fan, most_selling_fan_other").eq("id", ok).single();
    expect(data).toEqual({ most_selling_fan: "Other", most_selling_fan_other: "Fanco" });

    const bad = "aaaa1111-0000-0000-0000-000000000004";
    const badRes = await rep.rpc("create_survey", {
      payload: payload(bad, { most_selling_fan: "Other", most_selling_fan_other: "" }),
    });
    expect(badRes.error).not.toBeNull();
  });
```
The existing `payload(id, over)` helper spreads `over` onto the base object, so `most_selling_fan` / `most_selling_fan_other` overrides work. Add `most_selling_fan_other: null, rec_30w_1_other: null, rec_30w_2_other: null, rec_50w_1_other: null, rec_50w_2_other: null` to that helper's base object so the non-Other cases are explicit.

- [ ] **Step 3: Verify by inspection**

There is no local Supabase. Confirm:
- Every `insert into public.surveys` column has a matching value expression (21 columns, 21 values).
- The inserted `*_other` column names exactly match the `SurveyRpcPayload` keys added in Task 3 (`most_selling_fan_other` etc.).
- `char_length(btrim(...)) between 1 and 40` matches `MAX_OTHER_BRAND_LEN`.
- Run `npx tsc --noEmit` (the `.test.ts` file must still typecheck) and `npm test` (unchanged — integration tests are not in the unit run).

Record in the report: "0005 authored; not executed (no local Supabase). Runs on hosted Supabase before the code deploy."

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_survey_form_v2.sql tests/integration/create-survey-rpc.test.ts
git commit -m "feat: add 0005 migration for Other brands + quotation photos"
```

---

### Task 3: Validation — new fields, brand rules, payload mapping

**Files:**
- Modify: `lib/validation.ts`
- Test: `tests/unit/validation.test.ts`

**Interfaces:**
- Consumes: `OTHER_BRAND`, `MAX_OTHER_BRAND_LEN`, `MAX_QUOTATION_PHOTOS` from `@/lib/constants`.
- Produces:
  - `SurveyFormValues` gains `most_selling_fan_other`, `rec_30w_1_other`, `rec_30w_2_other`, `rec_50w_1_other`, `rec_50w_2_other` (all `string`) and `quotationPhotos: File[]`.
  - `SurveyRpcPayload` gains the 5 `*_other: string | null`; its `photos[].kind` union gains `"quotation"`.
  - `validateSurvey`: a brand field errors to `<field>` when the select is wrong, or to `<field>_other` when the typed name is missing/too long. `quotationPhotos` errors only when `> MAX_QUOTATION_PHOTOS`.
  - `buildSurveyPayload(id, v, paths)` — `paths` is now `{ front: string; inner: string[]; quotation: string[]; audio: string | null }`.

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/validation.test.ts` (extend the `valid` fixture with the new fields, then add cases):
```ts
// add to the `valid` object:
//   most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "",
//   rec_50w_1_other: "", rec_50w_2_other: "", quotationPhotos: [],

describe("Other brand", () => {
  it("accepts a real brand with no _other text", () => {
    expect(validateSurvey({ ...valid, most_selling_fan: "GFC", most_selling_fan_other: "" })).toEqual({});
  });
  it("requires the typed name when the field is Other", () => {
    const e = validateSurvey({ ...valid, most_selling_fan: "Other", most_selling_fan_other: "  " });
    expect(e.most_selling_fan_other).toMatch(/brand name/i);
    expect(e.most_selling_fan).toBeUndefined();
  });
  it("accepts Other + a name, trims it in the payload", () => {
    expect(validateSurvey({ ...valid, most_selling_fan: "Other", most_selling_fan_other: " Fanco " })).toEqual({});
    const p = buildSurveyPayload("11111111-1111-1111-1111-111111111111",
      { ...valid, most_selling_fan: "Other", most_selling_fan_other: " Fanco " },
      { front: "u/s/front.jpg", inner: ["u/s/inner-0.jpg"], quotation: [], audio: null });
    expect(p.most_selling_fan).toBe("Other");
    expect(p.most_selling_fan_other).toBe("Fanco");
    expect(p.rec_30w_1_other).toBeNull();
  });
  it("rejects an Other name longer than 40 chars", () => {
    const e = validateSurvey({ ...valid, rec_30w_1: "Other", rec_30w_1_other: "x".repeat(41) });
    expect(e.rec_30w_1_other).toMatch(/40/);
  });
  it("still allows a blank optional recommendation", () => {
    expect(validateSurvey({ ...valid, rec_30w_2: "", rec_30w_2_other: "" })).toEqual({});
  });
});

describe("quotation photos", () => {
  const img = (n: string) => new File([new Uint8Array(4)], n, { type: "image/jpeg" });
  it("0 is fine", () => {
    expect(validateSurvey({ ...valid, quotationPhotos: [] })).toEqual({});
  });
  it("errors above the cap of 2", () => {
    const e = validateSurvey({ ...valid, quotationPhotos: [img("a"), img("b"), img("c")] });
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
```
Also update the existing `buildSurveyPayload` test call to pass `quotation: []` in `paths`, and the existing "flags every missing required field" case to add `most_selling_fan_other: "", ... quotationPhotos: []` to its input object.

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- validation`
Expected: FAIL — new fields / `paths.quotation` not in the types; `most_selling_fan_other` key not produced.

- [ ] **Step 3: Edit `lib/validation.ts`**

Update the import:
```ts
import {
  BRANDS, MARKETS, SHOP_SIZES, MAX_INNER_PHOTOS,
  MAX_QUOTATION_PHOTOS, MAX_OTHER_BRAND_LEN, OTHER_BRAND,
} from "./constants";
```
`SurveyFormValues` — add after `rec_50w_2`:
```ts
  most_selling_fan_other: string;
  rec_30w_1_other: string;
  rec_30w_2_other: string;
  rec_50w_1_other: string;
  rec_50w_2_other: string;
```
and after `innerPhotos`:
```ts
  quotationPhotos: File[];
```
`SurveyRpcPayload` — add after `audio_path`:
```ts
  most_selling_fan_other: string | null;
  rec_30w_1_other: string | null;
  rec_30w_2_other: string | null;
  rec_50w_1_other: string | null;
  rec_50w_2_other: string | null;
```
and change the `photos` type:
```ts
  photos: { kind: "front" | "inner" | "quotation"; storage_path: string; sort_order: number }[];
```
Replace the five `if (...isBrand...)` lines in `validateSurvey` with a shared check:
```ts
type BrandFieldResult = { field: "self" | "other"; msg: string } | null;
function brandCheck(brand: string, other: string, optional: boolean): BrandFieldResult {
  if (!brand) return optional ? null : { field: "self", msg: "Select a brand" };
  if (brand === OTHER_BRAND) {
    const t = other.trim();
    if (!t) return { field: "other", msg: "Enter the brand name" };
    if (t.length > MAX_OTHER_BRAND_LEN) return { field: "other", msg: `Use ${MAX_OTHER_BRAND_LEN} characters or fewer` };
    return null;
  }
  if (!isBrand(brand)) return { field: "self", msg: "Invalid brand" };
  return null;
}
```
In `validateSurvey`, where the brand lines were:
```ts
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
```
After the `innerPhotos` checks add:
```ts
  if (v.quotationPhotos.length > MAX_QUOTATION_PHOTOS)
    e.quotationPhotos = `No more than ${MAX_QUOTATION_PHOTOS} quotation photos`;
```
`buildSurveyPayload` — change the signature `paths` to `{ front: string; inner: string[]; quotation: string[]; audio: string | null }`, add a helper and the fields:
```ts
  const otherOf = (brand: string, other: string) => (brand === OTHER_BRAND ? (other.trim() || null) : null);
```
in the returned object, after `audio_path: paths.audio,`:
```ts
    most_selling_fan_other: otherOf(v.most_selling_fan, v.most_selling_fan_other),
    rec_30w_1_other: otherOf(v.rec_30w_1, v.rec_30w_1_other),
    rec_30w_2_other: otherOf(v.rec_30w_2, v.rec_30w_2_other),
    rec_50w_1_other: otherOf(v.rec_50w_1, v.rec_50w_1_other),
    rec_50w_2_other: otherOf(v.rec_50w_2, v.rec_50w_2_other),
```
and in `photos`, after the inner map:
```ts
      ...paths.quotation.map((p, i) => ({ kind: "quotation" as const, storage_path: p, sort_order: i })),
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- validation` then `npm test` then `npx tsc --noEmit`
Expected: validation tests PASS; full unit suite PASS. `tsc` may still flag `SurveyForm.tsx` (EMPTY missing new keys — Task 7), `PhotoCapture.tsx` (Task 6), `upload.ts` (Task 8), `submit-survey.test.ts` (fixture — Task 8), `SurveyDetail.tsx` / `MediaGallery.tsx` (Task 9), `exportSurveys.ts` (Task 10), `aggregations.ts` (Task 11). Record which files `tsc` flags.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/unit/validation.test.ts
git commit -m "feat: validate Other-brand text and quotation photo count"
```

---

### Task 4: `compressDocument`

**Files:**
- Modify: `lib/compression.ts`
- Test: `tests/unit/compression.test.ts`

**Interfaces:**
- Produces: `compressDocument(file: File): Promise<File>` — `maxWidthOrHeight: 2400`, `maxSizeMB: 1.2`, `initialQuality: 0.9`, JPEG output, returns the original on failure. `compressImage` unchanged in behaviour (1600 / 0.5 / 0.8).

- [ ] **Step 1: Add a failing test**

Add to `tests/unit/compression.test.ts`:
```ts
import { compressDocument } from "@/lib/compression";

it("compressDocument uses gentler document settings", async () => {
  (imageCompression as unknown as Mock).mockClear();
  const input = new File([new Uint8Array(2048)], "quote.png", { type: "image/png" });
  const out = await compressDocument(input);
  expect(out).toBeInstanceOf(File);
  expect(out.name).toBe("quote.jpg");
  const opts = (imageCompression as unknown as Mock).mock.calls[0][1];
  expect(opts.maxWidthOrHeight).toBe(2400);
  expect(opts.maxSizeMB).toBeCloseTo(1.2);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- compression`
Expected: FAIL — `compressDocument` not exported.

- [ ] **Step 3: Refactor `lib/compression.ts`**

```ts
import imageCompression from "browser-image-compression";

function toJpgName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") + ".jpg";
}

async function compressTo(
  file: File,
  opts: { maxWidthOrHeight: number; maxSizeMB: number; initialQuality: number },
): Promise<File> {
  try {
    const blob = await imageCompression(file, {
      ...opts,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    return new File([blob], toJpgName(file.name), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const compressImage = (file: File): Promise<File> =>
  compressTo(file, { maxWidthOrHeight: 1600, maxSizeMB: 0.5, initialQuality: 0.8 });

export const compressDocument = (file: File): Promise<File> =>
  compressTo(file, { maxWidthOrHeight: 2400, maxSizeMB: 1.2, initialQuality: 0.9 });
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- compression` then `npm test`
Expected: PASS — the existing `compressImage` cases (options 1600 / 0.5, returns original on throw, `.jpg` rename) and the new `compressDocument` case all green.

- [ ] **Step 5: Commit**

```bash
git add lib/compression.ts tests/unit/compression.test.ts
git commit -m "feat: add compressDocument for legible quotation photos"
```

---

### Task 5: `BrandField` component

**Files:**
- Create: `components/form/BrandField.tsx`
- Test: `tests/unit/brand-field.test.tsx`

**Interfaces:**
- Consumes: `BRAND_SELECT_OPTIONS`, `MAX_OTHER_BRAND_LEN`, `OTHER_BRAND` from `@/lib/constants`.
- Produces: `BrandField({ label, name, value, otherValue, onChange, onOtherChange, error, placeholder? })` — native `<select>` of the 7 brands + `Other…`; when `value === "Other"` also renders a text input (`maxLength={40}`) bound to `otherValue` / `onOtherChange`; one shared error slot (`role="alert"`).

- [ ] **Step 1: Write failing tests**

`tests/unit/brand-field.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrandField } from "@/components/form/BrandField";

const base = {
  label: "Most selling fan", name: "most_selling_fan",
  value: "", otherValue: "", onChange: vi.fn(), onOtherChange: vi.fn(),
};

describe("BrandField", () => {
  it("shows the brand select with an Other option, no text input", () => {
    render(<BrandField {...base} />);
    expect(screen.getByRole("combobox", { name: /most selling fan/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /other/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type the brand name/i)).not.toBeInTheDocument();
  });

  it("reveals the text input when the value is Other", () => {
    render(<BrandField {...base} value="Other" />);
    const input = screen.getByPlaceholderText(/type the brand name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("maxLength", "40");
  });

  it("calls onChange from the select and onOtherChange from the text input", async () => {
    const onChange = vi.fn();
    const onOtherChange = vi.fn();
    const { rerender } = render(<BrandField {...base} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "Other");
    expect(onChange).toHaveBeenCalledWith("Other");
    rerender(<BrandField {...base} value="Other" onOtherChange={onOtherChange} />);
    await userEvent.type(screen.getByPlaceholderText(/type the brand name/i), "F");
    expect(onOtherChange).toHaveBeenCalledWith("F");
  });

  it("renders the error text once", () => {
    render(<BrandField {...base} value="Other" error="Enter the brand name" />);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText("Enter the brand name")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- brand-field`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/form/BrandField.tsx`**

```tsx
"use client";
import { BRAND_SELECT_OPTIONS, MAX_OTHER_BRAND_LEN, OTHER_BRAND } from "@/lib/constants";

interface Props {
  label: string;
  name: string;
  value: string;
  otherValue: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}

export function BrandField({
  label, name, value, otherValue, onChange, onOtherChange, error, placeholder = "Select a brand",
}: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        name={name} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
      >
        <option value="">{placeholder}</option>
        {BRAND_SELECT_OPTIONS.map((o) => (
          <option key={o} value={o}>{o === OTHER_BRAND ? "Other…" : o}</option>
        ))}
      </select>
      {value === OTHER_BRAND ? (
        <input
          name={`${name}_other`} value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          maxLength={MAX_OTHER_BRAND_LEN} placeholder="Type the brand name"
          aria-invalid={!!error}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base font-normal"
        />
      ) : null}
      {error ? <span role="alert" className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- brand-field`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/form/BrandField.tsx tests/unit/brand-field.test.tsx
git commit -m "feat: add BrandField (dropdown with Other + type-in)"
```

---

### Task 6: `PhotoCapture` — quotation section

**Files:**
- Modify: `components/form/PhotoCapture.tsx`
- Test: `tests/unit/photo-capture.test.tsx`

**Interfaces:**
- Consumes: `compressImage`, `compressDocument` from `@/lib/compression`; `MAX_INNER_PHOTOS`, `MAX_QUOTATION_PHOTOS` from `@/lib/constants`.
- Produces: `PhotoCapture` gains props `quotation: File[]` and `onQuotationChange: (files: File[]) => void`. A "Quotation photo (optional, up to 2)" section with `data-testid` `quotation-camera-input` / `quotation-gallery-input`, `compressDocument` compression, a removable thumbnail grid, capped at `MAX_QUOTATION_PHOTOS` with a truncation notice. Inner-photo behaviour and existing test ids are unchanged.

- [ ] **Step 1: Update tests**

In `tests/unit/photo-capture.test.tsx`:
- change the mock to also stub `compressDocument`:
  ```ts
  vi.mock("@/lib/compression", () => ({
    compressImage: vi.fn(async (f: File) => f),
    compressDocument: vi.fn(async (f: File) => f),
  }));
  ```
- every `render(<PhotoCapture .../>)` call now needs `quotation={[]} onQuotationChange={vi.fn()}` (and the existing cases pass those).
- add cases:
  ```ts
  it("compresses and reports a chosen quotation photo", async () => {
    const onQuotationChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={onQuotationChange} />);
    await userEvent.upload(screen.getByTestId("quotation-gallery-input"), img("q.jpg"));
    expect(onQuotationChange).toHaveBeenCalledWith([expect.any(File)]);
  });

  it("caps quotation photos at 2", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onQuotationChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={current}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={onQuotationChange} />);
    await userEvent.upload(screen.getByTestId("quotation-gallery-input"), img("c.jpg"));
    expect(onQuotationChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 2 quotation photos/i)).toBeInTheDocument();
  });

  it("removes a quotation photo by index", async () => {
    const current = [img("a.jpg"), img("b.jpg")];
    const onQuotationChange = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={current}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={onQuotationChange} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove b\.jpg/i })[0]);
    expect(onQuotationChange).toHaveBeenCalledWith([current[0]]);
  });
  ```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- photo-capture`
Expected: FAIL — `quotation` prop / testids missing.

- [ ] **Step 3: Edit `components/form/PhotoCapture.tsx`**

Update imports:
```ts
import { compressImage, compressDocument } from "@/lib/compression";
import { MAX_INNER_PHOTOS, MAX_QUOTATION_PHOTOS } from "@/lib/constants";
```
Props:
```ts
interface Props {
  front: File | null;
  inner: File[];
  quotation: File[];
  onFrontChange: (f: File | null) => void;
  onInnerChange: (files: File[]) => void;
  onQuotationChange: (files: File[]) => void;
}
```
Replace `handleInner` with a shared multi-photo handler (deliberate refactor — three near-identical handlers would be verbatim duplication):
```ts
  async function addPhotos(
    files: FileList | null,
    current: File[],
    max: number,
    compress: (f: File) => Promise<File>,
    onChange: (files: File[]) => void,
    noun: string,
  ) {
    if (!files || busy.current) return;
    busy.current = true;
    try {
      const room = max - current.length;
      if (room <= 0) { setNotice(`You can attach a maximum of ${max} ${noun}.`); return; }
      const picked = Array.from(files).slice(0, room);
      setNotice(picked.length < files.length ? `Only ${room} more ${noun} could be added (max ${max}).` : "");
      const compressed = await Promise.all(picked.map(compress));
      onChange([...current, ...compressed]);
    } finally {
      busy.current = false;
    }
  }

  const handleInner = (files: FileList | null) =>
    addPhotos(files, inner, MAX_INNER_PHOTOS, compressImage, onInnerChange, "inner photos");
  const handleQuotation = (files: FileList | null) =>
    addPhotos(files, quotation, MAX_QUOTATION_PHOTOS, compressDocument, onQuotationChange, "quotation photos");
```
`handleFront` is unchanged. Add the section after the inner-photos block (mirror its markup):
```tsx
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Quotation photo — optional ({quotation.length}/{MAX_QUOTATION_PHOTOS})</span>
        <div className="flex gap-2">
          <label className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
            Take photo
            <input data-testid="quotation-camera-input" type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => handleQuotation(e.target.files)} />
          </label>
          <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Choose from gallery
            <input data-testid="quotation-gallery-input" type="file" accept="image/*" multiple hidden
              onChange={(e) => handleQuotation(e.target.files)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {quotation.map((f, i) => (
            <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => onQuotationChange(quotation.filter((_, j) => j !== i))} />
          ))}
        </div>
      </div>
```
(The single `notice` state is shared across inner + quotation, as it already is a single element — acceptable; the last action's notice wins.)

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- photo-capture`
Expected: PASS — the existing inner-photo cases (`/maximum of 10 inner photos/i`, remove-by-index) plus the 3 new quotation cases.

- [ ] **Step 5: Commit**

```bash
git add components/form/PhotoCapture.tsx tests/unit/photo-capture.test.tsx
git commit -m "feat: add optional quotation photo slot to PhotoCapture"
```

---

### Task 7: Wire `SurveyForm`

**Files:**
- Modify: `components/form/SurveyForm.tsx`
- Test: `tests/unit/survey-form-validation.test.tsx`

**Interfaces:**
- Consumes: `BrandField` (Task 5); `PhotoCapture` new props (Task 6); `SurveyFormValues` new fields (Task 3).
- Produces: `EMPTY_SURVEY` includes the 5 `*_other: ""` and `quotationPhotos: []`. The 5 brand pickers are `<BrandField>`; the photos region renders `errors.quotationPhotos`; `PhotoCapture` gets `quotation` / `onQuotationChange`.

- [ ] **Step 1: Update tests**

In `tests/unit/survey-form-validation.test.tsx`:
- the "blocks submit and shows errors when required fields are empty" case still asserts `/shop name is required/i`, `/select a market/i`, `/capture the shop location/i`, `/add a front photo/i` — keep as-is (brand error text is not asserted).
- add a case:
  ```ts
  it("requires a typed name when a brand is set to Other", async () => {
    render(<SurveyForm onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /most selling fan/i }), "Other");
    await userEvent.click(screen.getByRole("button", { name: /submit survey/i }));
    expect(await screen.findByText(/enter the brand name/i)).toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- survey-form-validation`
Expected: FAIL — no `Other` option / `EMPTY` missing keys → `tsc`/runtime error.

- [ ] **Step 3: Edit `components/form/SurveyForm.tsx`**

- Import: drop `BRANDS` from the `@/lib/constants` import (no longer used here); keep `MARKETS`, `SHOP_SIZES`. Add `import { BrandField } from "./BrandField";`.
- `EMPTY`:
  ```ts
  const EMPTY: SurveyFormValues = {
    shop_name: "", market: "", shop_size: "", customer_name: "", customer_number: "",
    gps: null,
    most_selling_fan: "", most_selling_fan_other: "",
    rec_30w_1: "", rec_30w_1_other: "", rec_30w_2: "", rec_30w_2_other: "",
    rec_50w_1: "", rec_50w_1_other: "", rec_50w_2: "", rec_50w_2_other: "",
    frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
  };
  ```
- Replace the 5 `<SelectField ... options={BRANDS} ...>` elements with:
  ```tsx
  <BrandField label="Most selling fan" name="most_selling_fan"
    value={v.most_selling_fan} otherValue={v.most_selling_fan_other}
    onChange={(x) => set("most_selling_fan", x)} onOtherChange={(x) => set("most_selling_fan_other", x)}
    error={errors.most_selling_fan || errors.most_selling_fan_other} />
  <BrandField label="30W — Recommend 1" name="rec_30w_1"
    value={v.rec_30w_1} otherValue={v.rec_30w_1_other}
    onChange={(x) => set("rec_30w_1", x)} onOtherChange={(x) => set("rec_30w_1_other", x)}
    error={errors.rec_30w_1 || errors.rec_30w_1_other} />
  <BrandField label="30W — Recommend 2 (optional)" name="rec_30w_2" placeholder="None"
    value={v.rec_30w_2} otherValue={v.rec_30w_2_other}
    onChange={(x) => set("rec_30w_2", x)} onOtherChange={(x) => set("rec_30w_2_other", x)}
    error={errors.rec_30w_2 || errors.rec_30w_2_other} />
  <BrandField label="50W — Recommend 1" name="rec_50w_1"
    value={v.rec_50w_1} otherValue={v.rec_50w_1_other}
    onChange={(x) => set("rec_50w_1", x)} onOtherChange={(x) => set("rec_50w_1_other", x)}
    error={errors.rec_50w_1 || errors.rec_50w_1_other} />
  <BrandField label="50W — Recommend 2 (optional)" name="rec_50w_2" placeholder="None"
    value={v.rec_50w_2} otherValue={v.rec_50w_2_other}
    onChange={(x) => set("rec_50w_2", x)} onOtherChange={(x) => set("rec_50w_2_other", x)}
    error={errors.rec_50w_2 || errors.rec_50w_2_other} />
  ```
- In the `data-region="photos"` block: pass quotation and surface its error:
  ```tsx
  <PhotoCapture
    front={v.frontPhoto} inner={v.innerPhotos} quotation={v.quotationPhotos}
    onFrontChange={(f) => set("frontPhoto", f)}
    onInnerChange={(files) => set("innerPhotos", files)}
    onQuotationChange={(files) => set("quotationPhotos", files)}
  />
  {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
  {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
  {errors.quotationPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.quotationPhotos}</span> : null}
  ```
  and add `|| errors.quotationPhotos` to the region's `data-invalid` expression.

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- survey-form-validation` then `npm test` then `npx tsc --noEmit` then `npm run build`
Expected: form tests PASS; full unit suite PASS; `tsc` may still flag `upload.ts` (Task 8), `SurveyDetail.tsx` / `MediaGallery.tsx` (Task 9), `exportSurveys.ts` (Task 10), `aggregations.ts` (Task 11), and `submit-survey.test.ts` fixture (Task 8). `npm run build` may fail on those same files — record which; it is expected to go green at the end of Task 11.

- [ ] **Step 5: Commit**

```bash
git add components/form/SurveyForm.tsx tests/unit/survey-form-validation.test.tsx
git commit -m "feat: use BrandField and wire quotation photos into the survey form"
```

---

### Task 8: Submit pipeline — upload quotation photos

**Files:**
- Modify: `lib/upload.ts`
- Test: `tests/unit/submit-survey.test.ts`

**Interfaces:**
- Consumes: `SurveyFormValues.quotationPhotos` (Task 3).
- Produces: `uploadSurveyMedia(...)` returns `{ front: string; inner: string[]; quotation: string[]; audio: string | null }` — uploads each quotation file to `<repUid>/<surveyId>/quotation-<i>.jpg`. `lib/submitSurvey.ts` needs no edit (it passes `paths` straight to `buildSurveyPayload`, whose signature already accepts `quotation`).

- [ ] **Step 1: Update the test**

In `tests/unit/submit-survey.test.ts`:
- extend the fixture `v` with the new required fields: `most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "", quotationPhotos: []`.
- keep the existing "uploads media then calls create_survey with mapped paths" case (front + 2 inner → 3 uploads).
- add:
  ```ts
  it("uploads quotation photos and maps them into the payload", async () => {
    uploadMock.mockResolvedValue({ error: null });
    rpcMock.mockResolvedValue({ data: "generated-id", error: null });
    vi.stubGlobal("crypto", { randomUUID: () => "abcd" });
    const withQuote = { ...v, quotationPhotos: [new File(["q"], "q.jpg", { type: "image/jpeg" })] };
    await submitSurvey(withQuote);
    expect(uploadMock).toHaveBeenCalledTimes(4); // front + 2 inner + 1 quotation
    const payload = rpcMock.mock.calls[0][1].payload;
    expect(payload.photos).toContainEqual({
      kind: "quotation", storage_path: "rep-uid-1/abcd/quotation-0.jpg", sort_order: 0,
    });
    vi.unstubAllGlobals();
  });
  ```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- submit-survey`
Expected: FAIL — only 3 uploads / no quotation path.

- [ ] **Step 3: Edit `lib/upload.ts`**

Change the return type to `{ front: string; inner: string[]; quotation: string[]; audio: string | null }`. After the inner-photos loop and **before** the audio block, add:
```ts
  const quotation: string[] = [];
  for (let i = 0; i < v.quotationPhotos.length; i++) {
    const p = `${base}/quotation-${i}.jpg`;
    const res = await supabase.storage.from(PHOTO_BUCKET).upload(p, v.quotationPhotos[i], { contentType: "image/jpeg" });
    if (res.error) throw new Error(`Photo upload failed: ${res.error.message}`);
    quotation.push(p);
  }
```
Change the final `return` to include `quotation`:
```ts
  return { front: frontPath, inner, quotation, audio };
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- submit-survey` then `npm test` then `npx tsc --noEmit`
Expected: submit-survey PASS; full unit suite PASS. `tsc` now flags only the remaining downstream files (`SurveyDetail`, `MediaGallery`, `exportSurveys`, `aggregations`) — Tasks 9–11.

- [ ] **Step 5: Commit**

```bash
git add lib/upload.ts tests/unit/submit-survey.test.ts
git commit -m "feat: upload quotation photos in the submit pipeline"
```

---

### Task 9: Survey detail — quotation gallery + Other-brand rows

**Files:**
- Modify: `app/survey/[id]/actions.ts`, `components/SurveyDetail.tsx`, `components/MediaGallery.tsx`
- Test: `tests/unit/signed-urls.test.ts`, `tests/unit/survey-detail.test.tsx` (new)

**Interfaces:**
- Consumes: `SurveyPhoto.kind` / `Survey` `*_other` fields (Task 1).
- Produces:
  - `getSignedMediaUrls` returns `photos: { kind: "front" | "inner" | "quotation"; url: string }[]`, ordered front → inner → quotation (then `sort_order`).
  - `SurveyDetail` renders quotation photos in their own "Quotation" section (only when present) and shows `Other — "<name>"` for any brand row whose value is `"Other"`.
  - `MediaGallery` accepts the widened `kind` union.

- [ ] **Step 1: Update / add tests**

`tests/unit/signed-urls.test.ts` — in the "signs each photo path and the audio path" case, add a `quotation` row to the mocked `survey_photos` and a signed URL for it, and assert the returned `photos` array ends with `{ kind: "quotation", url: "https://x/quote" }`:
```ts
// survey_photos in the mock:
[
  { kind: "front", storage_path: "uid/sid/front.jpg", sort_order: 0 },
  { kind: "inner", storage_path: "uid/sid/inner-0.jpg", sort_order: 0 },
  { kind: "quotation", storage_path: "uid/sid/quotation-0.jpg", sort_order: 0 },
]
// createSignedUrls mock adds:
{ path: "uid/sid/quotation-0.jpg", signedUrl: "https://x/quote" }
// assertion:
expect(res.photos).toEqual([
  { kind: "front", url: "https://x/front" },
  { kind: "inner", url: "https://x/inner0" },
  { kind: "quotation", url: "https://x/quote" },
]);
```

`tests/unit/survey-detail.test.tsx` (new):
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurveyDetail } from "@/components/SurveyDetail";

const baseSurvey: any = {
  id: "s1", shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
  customer_name: "Bilal", customer_number: "03001234567",
  gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
  most_selling_fan: "Other", most_selling_fan_other: "Fanco",
  rec_30w_1: "GFC", rec_30w_1_other: null,
  rec_30w_2: null, rec_30w_2_other: null,
  rec_50w_1: "Royal", rec_50w_1_other: null,
  rec_50w_2: null, rec_50w_2_other: null,
  audio_path: null, created_at: "2026-09-08T10:00:00Z",
  rep: { id: "r1", username: "rep.one", full_name: "Rep One" }, photos: [],
};

describe("SurveyDetail v2", () => {
  it("renders an Other brand with its typed name", () => {
    render(<SurveyDetail survey={baseSurvey}
      media={{ photos: [], audio: null }} />);
    expect(screen.getByText(/Other — "Fanco"/)).toBeInTheDocument();
  });

  it("shows a Quotation section only when quotation photos exist", () => {
    const { rerender } = render(<SurveyDetail survey={baseSurvey}
      media={{ photos: [{ kind: "front", url: "u/f" }], audio: null }} />);
    expect(screen.queryByText("Quotation")).not.toBeInTheDocument();
    rerender(<SurveyDetail survey={baseSurvey}
      media={{ photos: [{ kind: "front", url: "u/f" }, { kind: "quotation", url: "u/q" }], audio: null }} />);
    expect(screen.getByText("Quotation")).toBeInTheDocument();
  });
});
```
(`MiniMap` is `next/dynamic` `ssr:false`; under jsdom it renders an empty wrapper — fine. If the render throws on the Leaflet import, add `vi.mock("@/components/MiniMap", () => ({ MiniMap: () => <div /> }))` and `vi.mock("@/components/admin/DeleteSurveyButton", () => ({ DeleteSurveyButton: () => <div /> }))` at the top of the test.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- signed-urls` and `npm test -- survey-detail`
Expected: both FAIL.

- [ ] **Step 3: Edit `app/survey/[id]/actions.ts`**

Widen the return type's `photos` kind to `"front" | "inner" | "quotation"`. Replace the `ordered` sort and the `.map` cast:
```ts
  const rank: Record<string, number> = { front: 0, inner: 1, quotation: 2 };
  const ordered = [...(data.survey_photos as any[])].sort((a, b) =>
    rank[a.kind] === rank[b.kind] ? a.sort_order - b.sort_order : rank[a.kind] - rank[b.kind]);
  ...
  const photos = ordered
    .map((p) => ({ kind: p.kind as "front" | "inner" | "quotation", url: byPath.get(p.storage_path) as string }))
    .filter((p) => !!p.url);
```

- [ ] **Step 4: Edit `components/MediaGallery.tsx`**

Prop type: `photos: { kind: "front" | "inner" | "quotation"; url: string }[]`. `alt`:
```tsx
alt={p.kind === "front" ? "Shop front" : p.kind === "quotation" ? `Quotation ${i + 1}` : `Inner photo ${i}`}
```

- [ ] **Step 5: Edit `components/SurveyDetail.tsx`**

- Widen the `media.photos` prop type to include `"quotation"`.
- Add a helper above `SurveyDetail`:
  ```tsx
  function brandDisplay(brand: string | null, other: string | null): string {
    if (!brand) return "";
    return brand === "Other" ? `Other — "${other ?? ""}"` : brand;
  }
  ```
- Split the gallery:
  ```tsx
  const mainPhotos = media.photos.filter((p) => p.kind !== "quotation");
  const quotationPhotos = media.photos.filter((p) => p.kind === "quotation");
  ```
  Use `<MediaGallery photos={mainPhotos} />` where the single gallery is now, and after the audio section add:
  ```tsx
  {quotationPhotos.length > 0 ? (
    <section className="flex flex-col gap-1">
      <span className="text-sm font-medium">Quotation</span>
      <MediaGallery photos={quotationPhotos} />
    </section>
  ) : null}
  ```
- Change the 5 brand `<Row>`s to use the helper, e.g.:
  ```tsx
  <Row label="Most selling fan" value={brandDisplay(survey.most_selling_fan, survey.most_selling_fan_other)} />
  <Row label="30W — Recommend 1" value={brandDisplay(survey.rec_30w_1, survey.rec_30w_1_other)} />
  <Row label="30W — Recommend 2" value={brandDisplay(survey.rec_30w_2, survey.rec_30w_2_other)} />
  <Row label="50W — Recommend 1" value={brandDisplay(survey.rec_50w_1, survey.rec_50w_1_other)} />
  <Row label="50W — Recommend 2" value={brandDisplay(survey.rec_50w_2, survey.rec_50w_2_other)} />
  ```

- [ ] **Step 6: Run — expect PASS**

Run: `npm test -- signed-urls`, `npm test -- survey-detail`, then `npm test`
Expected: PASS. `npx tsc --noEmit` now flags only `exportSurveys.ts` (Task 10) and `aggregations.ts` (Task 11).

- [ ] **Step 7: Commit**

```bash
git add app/survey/\[id\]/actions.ts components/SurveyDetail.tsx components/MediaGallery.tsx tests/unit/signed-urls.test.ts tests/unit/survey-detail.test.tsx
git commit -m "feat: show quotation photos and Other-brand names on the detail page"
```

---

### Task 10: Export — brand fold + quotation column

**Files:**
- Modify: `lib/exportSurveys.ts`
- Test: `tests/unit/export-surveys.test.ts`

**Interfaces:**
- Produces: `ExportRow` gains `quotation_photo_urls: string`; `EXPORT_COLUMNS` inserts `"quotation_photo_urls"` after `"inner_photo_urls"`. Each brand cell reads `Other: <name>` when the stored brand is `"Other"`, else the brand (or `""`).

- [ ] **Step 1: Update the test**

In `tests/unit/export-surveys.test.ts`, extend the `survey` fixture:
```ts
most_selling_fan: "Other", most_selling_fan_other: "Fanco",
rec_30w_1: "Tamoor", rec_30w_1_other: null,
rec_30w_2: null, rec_30w_2_other: null,
rec_50w_1: "Royal", rec_50w_1_other: null,
rec_50w_2: null, rec_50w_2_other: null,
// survey_photos: add
{ kind: "quotation", storage_path: "u/s1/quotation-0.jpg", sort_order: 0 },
// signed map: add
["u/s1/quotation-0.jpg", "https://x/q0"],
```
Assertions:
```ts
expect(row.most_selling_fan).toBe("Other: Fanco");
expect(row.rec_30w_1).toBe("Tamoor");
expect(row.rec_30w_2).toBe("");
expect(row.quotation_photo_urls).toBe("https://x/q0");
```
The CSV header case still passes (it just gains a column); no change needed there beyond it existing.

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- export-surveys`
Expected: FAIL.

- [ ] **Step 3: Edit `lib/exportSurveys.ts`**

- `ExportRow`: add `quotation_photo_urls: string;` after `inner_photo_urls`.
- `EXPORT_COLUMNS`: insert `"quotation_photo_urls"` right after `"inner_photo_urls"`.
- In `toExportRows`, add a helper and a `quotation` collector:
  ```ts
  const brandCell = (b: string | null, o: string | null) =>
    b === "Other" ? `Other: ${o ?? ""}` : (b ?? "");
  ...
  const quotation = (s.survey_photos ?? [])
    .filter((p: any) => p.kind === "quotation")
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((p: any) => signedByPath.get(p.storage_path) ?? "")
    .filter(Boolean);
  ```
  In the returned row object, replace the five brand fields:
  ```ts
  most_selling_fan: brandCell(s.most_selling_fan, s.most_selling_fan_other),
  rec_30w_1: brandCell(s.rec_30w_1, s.rec_30w_1_other),
  rec_30w_2: brandCell(s.rec_30w_2, s.rec_30w_2_other),
  rec_50w_1: brandCell(s.rec_50w_1, s.rec_50w_1_other),
  rec_50w_2: brandCell(s.rec_50w_2, s.rec_50w_2_other),
  ```
  and add:
  ```ts
  quotation_photo_urls: quotation.join("\n"),
  ```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- export-surveys` then `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/exportSurveys.ts tests/unit/export-surveys.test.ts
git commit -m "feat: export Other-brand names inline and add quotation photo URLs"
```

---

### Task 11: Aggregations — `Other` bucket

**Files:**
- Modify: `lib/aggregations.ts`
- Test: `tests/unit/aggregations.test.ts`

**Interfaces:**
- Consumes: `OTHER_BRAND` from `@/lib/constants`.
- Produces: `countMostSellingFan` and `countRecommendedBrands` return **8** entries — the 7 brands then `"Other"`. A survey with a brand value of `"Other"` counts in the `Other` bucket; typed names never appear.

- [ ] **Step 1: Update the test**

In `tests/unit/aggregations.test.ts`:
- extend the fixture with a survey whose `most_selling_fan: "Other"` and one rec column `"Other"`.
- adjust: `countMostSellingFan(...)` now has length 8, last label `"Other"`; assert `out.find(o => o.label === "Other")!.value` equals the count of `Other` most-selling surveys. Same for `countRecommendedBrands`.
- existing assertions (`GFC` value, a zero bucket like `SK`) still hold.

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- aggregations`
Expected: FAIL (length 7, no `Other` bucket).

- [ ] **Step 3: Edit `lib/aggregations.ts`**

```ts
import { BRANDS, MARKETS, OTHER_BRAND } from "./constants";

const BRAND_BUCKETS = [...BRANDS, OTHER_BRAND];
```
In `countMostSellingFan`, replace the three `BRANDS` uses with `BRAND_BUCKETS`:
```ts
  const counts = new Map<string, number>(BRAND_BUCKETS.map((b) => [b, 0]));
  for (const s of surveys) counts.set(s.most_selling_fan, (counts.get(s.most_selling_fan) ?? 0) + 1);
  return BRAND_BUCKETS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));
```
In `countRecommendedBrands`, same swap:
```ts
  const counts = new Map<string, number>(BRAND_BUCKETS.map((b) => [b, 0]));
  for (const s of surveys) {
    for (const v of [s.rec_30w_1, s.rec_30w_2, s.rec_50w_1, s.rec_50w_2]) {
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return BRAND_BUCKETS.map((b) => ({ label: b, value: counts.get(b) ?? 0 }));
```
`countByMarket`, `countByRep`, `overviewStats` unchanged.

- [ ] **Step 4: Run — full green**

Run: `npm test` then `npx tsc --noEmit` then `npm run build`
Expected: all unit tests PASS; `tsc` clean; `npm run build` exit 0 with only `@next/next/no-img-element` warnings (now also on the quotation thumbnails / gallery — acceptable, same class).

- [ ] **Step 5: Commit**

```bash
git add lib/aggregations.ts tests/unit/aggregations.test.ts
git commit -m "feat: count an Other bucket in the brand charts"
```

---

### Task 12: Docs

**Files:**
- Modify: `CLAUDE.md`, `docs/DEPLOYMENT.md`

- [ ] **Step 1: `CLAUDE.md`**

- In the fixed-lists hard rule, note that a brand field may also be the literal
  `'Other'`, with the typed name in `<field>_other` (≤ `MAX_OTHER_BRAND_LEN` =
  40 chars); `lib/constants.ts` exports `OTHER_BRAND` and `BRAND_SELECT_OPTIONS`.
- Note `survey_photos.kind` is `'front' | 'inner' | 'quotation'` and
  `MAX_QUOTATION_PHOTOS = 2` (optional).
- Update the migrations line to `0001`–`0005`; restate that `0005` is applied to
  hosted Supabase via the SQL Editor before deploying the form change.

- [ ] **Step 2: `docs/DEPLOYMENT.md`**

Add a short section "Applying migration 0005 (Survey Form v2)":
1. In the hosted Supabase **SQL Editor**, paste and run the contents of
   `supabase/migrations/0005_survey_form_v2.sql`. It swaps CHECK constraints,
   adds 5 nullable `*_other` columns, allows the `quotation` photo kind, and
   replaces `create_survey`. Existing rows are unaffected (`*_other` null, no
   quotation photos).
2. Then deploy the code (push to `master`). Doing 0005 first keeps the live app
   working — the replaced RPC is backward-compatible.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/DEPLOYMENT.md
git commit -m "docs: document Other-brand, quotation photos, and the 0005 deploy step"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §1.1 brand CHECKs allow `'Other'` | 2 |
| §1.2 five `*_other` columns + pairing CHECKs | 2 |
| §1.3 `survey_photos.kind` gains `'quotation'` | 2 |
| §1.4 `create_survey` replace (write `_other`, count quotation 0–2, reject Other-with-no-name) | 2 |
| §2 constants (`OTHER_BRAND`, `BRAND_SELECT_OPTIONS`, `MAX_QUOTATION_PHOTOS`, `MAX_OTHER_BRAND_LEN`) + types | 1 |
| §3 validation — `SurveyFormValues`/`SurveyRpcPayload` fields, brand rules, quotation cap, payload mapping | 3 |
| §4 `compressDocument` (2400 / 1.2 / 0.9) | 4 |
| §5.1 `BrandField` | 5 |
| §5.2 `SurveyForm` wiring + `EMPTY_SURVEY` | 7 |
| §5.3 `PhotoCapture` quotation section (`compressDocument`, testids, cap) | 6 |
| §6 `uploadSurveyMedia` quotation upload + return shape | 8 |
| §7.1 detail: `getSignedMediaUrls` widen/order, quotation gallery section, `Other — "name"` rows | 9 |
| §7.2 export brand fold + `quotation_photo_urls` column | 10 |
| §7.3 charts `Other` bucket | 11 |
| §8 tests | in each task + integration cases in 2 |
| §9 deployment order | 12 (docs) + Global Constraints |
| §10 docs | 12 |

No spec item unassigned.

**2. Placeholder scan** — every code step carries real code; no "TBD"/"handle errors"/"similar to Task N". The one refactor (`PhotoCapture.addPhotos`) is shown in full. `lib/submitSurvey.ts` is explicitly "no change" with the reason.

**3. Type consistency**
- `SurveyFormValues` new fields (Task 3) are consumed with the same names in Task 6 (`quotation`), Task 7 (`EMPTY`, `set(...)`), Task 8 (`v.quotationPhotos`).
- `SurveyRpcPayload.*_other` keys (Task 3) match the migration's inserted column names (Task 2) exactly: `most_selling_fan_other`, `rec_30w_1_other`, `rec_30w_2_other`, `rec_50w_1_other`, `rec_50w_2_other`.
- `buildSurveyPayload` `paths` param `{ front; inner; quotation; audio }` (Task 3) matches `uploadSurveyMedia`'s return (Task 8).
- `SurveyPhoto.kind` / `getSignedMediaUrls` `photos[].kind` / `MediaGallery` prop / `SurveyDetail` `media.photos` all carry the same `"front" | "inner" | "quotation"` union after Tasks 1 and 9.
- `OTHER_BRAND` is the string `"Other"` everywhere; the migration CHECKs and RPC use the bare literal `'Other'` — same value.
- `MAX_OTHER_BRAND_LEN = 40` ↔ migration `between 1 and 40` ↔ `BrandField` `maxLength={40}` ↔ validation `> MAX_OTHER_BRAND_LEN`.
- `MAX_QUOTATION_PHOTOS = 2` ↔ migration `v_quotation > 2` ↔ `PhotoCapture` cap ↔ validation `> MAX_QUOTATION_PHOTOS`.

**Inter-task tsc note:** Tasks 1, 3, 7, 8 intentionally leave `tsc` red in not-yet-touched downstream files; each of those tasks' own `npm test` is green, and `tsc` + `npm run build` are required green again at the end of **Task 11**. Every task after 11 (just 12, docs) keeps them green. This is called out in each affected task's run step.

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-survey-form-v2.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.

**2. Inline Execution** — work the tasks in this session with checkpoints.

**Which approach?**

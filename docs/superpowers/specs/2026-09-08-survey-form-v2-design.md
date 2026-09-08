# Survey Form v2 — "Other" brands + Quotation photo

**Date:** 2026-09-08
**Status:** Approved for planning
**Builds on:** `docs/superpowers/specs/2026-09-07-fan-retailer-survey-design.md` (the shipped app)

## Goal

Two additions to the field-rep survey form:

1. **"Other" brand.** Every brand dropdown (Most Selling Fan + all four 30W/50W
   recommendations) gains an `Other…` option. Choosing it reveals a text input
   where the rep types the brand name.
2. **Quotation photo.** A new photo category: the rep photographs the shop's
   written quotation. Up to 2 images, optional (a survey can be submitted with
   none).

## Confirmed decisions

- Typed "Other" brand name: **trimmed, 1–40 characters**, required when the
  field's value is `Other`.
- Charts stay clean: the brand column stores the literal `'Other'`; a companion
  text column per field stores the typed name. Aggregation charts get one
  `Other` bucket.
- **Export folds** the typed name into the existing brand column (e.g. cell reads
  `Other: Fanco`), not five extra columns.
- Quotation photos: **0–2**, optional. Compressed more gently than shopfront
  photos so small print stays legible.

## 1. Database — `supabase/migrations/0005_survey_form_v2.sql`

The app is live, so this migration is **applied to the hosted Supabase project
via the SQL Editor before the code deploys**. All statements in one script /
transaction.

### 1.1 Brand columns — allow `'Other'`

For each of `most_selling_fan`, `rec_30w_1`, `rec_30w_2`, `rec_50w_1`,
`rec_50w_2`: drop and re-add the auto-named `CHECK` (`surveys_<col>_check`) with
the 7 brands **plus `'Other'`**.

### 1.2 New companion columns

Add 5 nullable `text` columns: `most_selling_fan_other`, `rec_30w_1_other`,
`rec_30w_2_other`, `rec_50w_1_other`, `rec_50w_2_other`.

Each gets a pairing `CHECK`:

```
check (
  (<brand_col> <> 'Other' and <other_col> is null)
  or
  (<brand_col> = 'Other' and <other_col> is not null
     and char_length(btrim(<other_col>)) between 1 and 40)
)
```

### 1.3 `survey_photos.kind`

Drop and re-add `survey_photos_kind_check` as
`check (kind in ('front', 'inner', 'quotation'))`.

### 1.4 `create_survey` RPC — `create or replace`

- Insert the 5 `*_other` values: `nullif(btrim(payload->>'<col>_other'), '')`.
- Photo loop: keep the existing caller-prefix check for **every** kind
  (including `quotation`); count `quotation` alongside `front` / `inner`.
- After the loop: keep `front = 1` and `inner between 1 and 10`; add
  `quotation between 0 and 2`.
- Before returning: for each brand field, if value = `'Other'` then the matching
  `*_other` must be non-null / non-blank — raise otherwise. (Belt-and-braces
  with the DB `CHECK`; gives a friendly message.)

Old rows are unaffected: `*_other` default `null`, no `quotation` photos.

## 2. Constants & types

`lib/constants.ts`:
- `BRANDS` unchanged (the 7 canonical brands).
- `OTHER_BRAND = "Other"` (string literal).
- `BRAND_SELECT_OPTIONS = [...BRANDS, OTHER_BRAND] as const`.
- `MAX_QUOTATION_PHOTOS = 2`.
- `MAX_OTHER_BRAND_LEN = 40`.

`lib/types.ts`:
- `Survey`: brand fields typed `Brand | "Other"`; add
  `most_selling_fan_other: string | null` … `rec_50w_2_other: string | null`.
- `SurveyPhoto.kind`: `"front" | "inner" | "quotation"`.

## 3. Validation — `lib/validation.ts`

- `SurveyFormValues` adds: `most_selling_fan_other`, `rec_30w_1_other`,
  `rec_30w_2_other`, `rec_50w_1_other`, `rec_50w_2_other` (all `string`), and
  `quotationPhotos: File[]`.
- `validateSurvey`:
  - A brand field is valid when its value is one of `BRANDS`, **or** its value is
    `"Other"` and `<field>_other.trim()` is 1–`MAX_OTHER_BRAND_LEN` chars.
  - Required/optional unchanged: `most_selling_fan`, `rec_30w_1`, `rec_50w_1`
    required; `rec_30w_2` / `rec_50w_2` may be blank (blank ≠ `"Other"`). A field
    set to `"Other"` with a blank/oversized `_other` is an error keyed to that
    `_other` field.
  - `quotationPhotos`: no error at 0; error only when `length > MAX_QUOTATION_PHOTOS`.
- `buildSurveyPayload`:
  - Emit `<field>_other`: the trimmed text when the field is `"Other"`, else `null`.
  - Append `quotationPhotos` to `photos[]` as `{ kind: "quotation", storage_path,
    sort_order: i }`.
- `SurveyRpcPayload` adds the 5 `*_other: string | null` fields.

## 4. Compression — `lib/compression.ts`

Add `compressDocument(file: File): Promise<File>` — same wrapper as
`compressImage` but `maxWidthOrHeight: 2400`, `maxSizeMB: 1.2`,
`initialQuality: 0.9`. Front/inner keep `compressImage`; quotation uses
`compressDocument`.

## 5. Form UI

### 5.1 `components/form/BrandField.tsx` (new, `"use client"`)

Props: `{ label, name, value, otherValue, onChange, onOtherChange, error, required }`.
Renders a native `<select>` with `BRAND_SELECT_OPTIONS` (+ a placeholder
`<option value="">` when not required). When `value === "Other"`, renders a
labelled text input (`maxLength={MAX_OTHER_BRAND_LEN}`, `inputMode="text"`)
bound to `otherValue` / `onOtherChange`. One error slot (`role="alert"`) covers
both.

### 5.2 `components/form/SurveyForm.tsx`

- `EMPTY_SURVEY` gains the 5 `*_other: ""` and `quotationPhotos: []`.
- Replace the 5 `<SelectField … options={BRANDS}>` with `<BrandField>` wired to
  `v.<field>` / `v.<field>_other` and `errors.<field>` / `errors.<field>_other`.
- `PhotoCapture` gets `quotation` / `onQuotationChange` props; the photos region
  now also surfaces `errors.quotationPhotos`.

### 5.3 `components/form/PhotoCapture.tsx`

Add props `quotation: File[]`, `onQuotationChange: (files: File[]) => void`.
New section **"Quotation photo (optional, up to 2)"** mirroring the inner-photos
section: "Take photo" (`capture="environment"`, testid `quotation-camera-input`)
+ "Choose from gallery" (multiple, testid `quotation-gallery-input`); each file
through `compressDocument`; removable thumbnail grid; clamp to
`MAX_QUOTATION_PHOTOS` with a notice when a selection is truncated.

## 6. Submit pipeline

`lib/upload.ts` — `uploadSurveyMedia` also uploads each quotation file to
`<repUid>/<surveyId>/quotation-<i>.jpg` (contentType `image/jpeg`, no `upsert`);
return type gains `quotation: string[]`.

`lib/submitSurvey.ts` — pass `v.quotationPhotos` through; `buildSurveyPayload`
receives `{ front, inner, quotation, audio }` and maps quotation paths into
`photos[]`.

## 7. Admin surfaces

### 7.1 Detail — `app/survey/[id]/actions.ts`, `components/SurveyDetail.tsx`, `components/MediaGallery.tsx`

- `getSignedMediaUrls` already signs every `survey_photos` row; widen the
  returned `kind` union to include `"quotation"` and order front → inner →
  quotation.
- `SurveyDetail`: the existing `<MediaGallery>` renders only `front` + `inner`
  photos; add a separate **"Quotation"** heading + a second `<MediaGallery>`
  fed the `kind === "quotation"` photos, shown only when there are any. For each
  brand row, when the stored value is `"Other"` render `Other — "<typed name>"`
  (from the matching `*_other` field).

### 7.2 Export — `lib/exportSurveys.ts`

- `toExportRows`: each brand cell = `brand === "Other" ? `Other: ${other}` :
  brand`. No new brand columns.
- Add one column `quotation_photo_urls` (newline-joined signed URLs), populated
  from `kind === "quotation"` rows, placed next to `inner_photo_urls` in
  `EXPORT_COLUMNS`.
- `app/admin/surveys/export/route.ts` already selects all photo kinds — no query
  change; it just needs `toExportRows` to handle the new kind and columns.

### 7.3 Charts — `lib/aggregations.ts`

`countMostSellingFan` and `countRecommendedBrands` iterate `[...BRANDS,
OTHER_BRAND]` (8 buckets). A survey with `most_selling_fan = 'Other'` counts in
the `Other` bucket. Typed names never enter the charts.
`app/admin/overview/page.tsx` needs no change if the aggregation output shape is
unchanged.

## 8. Tests

Unit (run):
- `brand-field.test.tsx` (new) — text input hidden until `Other`, value/onChange
  wiring, `maxLength`.
- `validation.test.ts` — `Other` + blank → error; `Other` + 41 chars → error;
  `Other` + valid → ok; `rec_*_2` blank still ok; `quotationPhotos` 0 ok / 3 →
  error; `buildSurveyPayload` maps `*_other` and quotation photos.
- `photo-capture.test.tsx` — quotation slot add / remove / cap-at-2 + notice.
- `aggregations.test.ts` — `Other` bucket counted for most-selling and combined
  recs; bucket order.
- `submit-survey.test.ts` — quotation files uploaded and mapped into the RPC
  payload with `kind: "quotation"`.
- `export-surveys.test.ts` — brand cell fold (`Other: X`); `quotation_photo_urls`
  column populated & ordered.
- `constants.test.ts` — `BRAND_SELECT_OPTIONS` shape, `MAX_QUOTATION_PHOTOS`,
  `MAX_OTHER_BRAND_LEN`.

Integration (authored, not run here):
- `create-survey-rpc.test.ts` — `quotation` count 0/2 ok, 3 rolls back;
  `most_selling_fan='Other'` with `_other` set inserts; with `_other` null rolls
  back.

## 9. Deployment order

1. Run `supabase/migrations/0005_survey_form_v2.sql` in the hosted Supabase SQL
   Editor (adds columns, swaps CHECKs, replaces `create_survey`). Old data
   untouched.
2. Merge + deploy the code (push to `master` → Vercel).

Doing (1) before (2) means: between the two, the live app keeps working on the
old RPC signature (the replaced RPC is backward-compatible — new params are all
optional / nullable). Doing (2) before (1) would break `create_survey`.

## 10. Docs

- `CLAUDE.md`: note `BRAND_SELECT_OPTIONS` / `OTHER_BRAND`, the `quotation` photo
  kind, `MAX_QUOTATION_PHOTOS`, and that migrations are append-only (0005 added).
- `docs/DEPLOYMENT.md`: add the "run 0005 before deploying the form change" step.

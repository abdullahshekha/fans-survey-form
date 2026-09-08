# Rep Survey Editing + Voice-Note Upload — Design

- **Date:** 2026-09-08
- **Status:** Approved for implementation planning
- **Scope:** Two related changes to the Fan Retailer Survey app.

## Summary

1. **Reps can edit their own surveys.** A field rep may open any survey they
   submitted and change any field — text, GPS, photos, and the voice note — with
   no time limit. Each edit stamps `surveys.edited_at`; the admin sees an
   "Edited" badge and the timestamp. No field-level history is kept.
2. **The voice note accepts a recording *or* an uploaded file.** The existing
   "Pak Fan comments" field (`VoiceRecorder`) gains an **Upload** option beside
   **Record**. Uploaded audio must be an audio MIME type and ≤ 25 MB; enforced
   client-side and at the Supabase Storage bucket.

## Motivation

- Reps currently cannot fix a mistake after submitting — there is no edit path
  for anyone (the admin can only *delete*; `CLAUDE.md`'s "only the admin edits"
  was aspirational). A wrong shop name or a blurry photo means the row is stuck
  or must be deleted and redone.
- Some field recordings are made outside the app (e.g. a longer conversation)
  and need to be attached rather than re-recorded through the 120 s in-app
  recorder.

## Hard-rule changes (deliberate)

This design **reverses two documented rules**. Both `CLAUDE.md` and the
`0003_storage.sql` header say reps must never `UPDATE`/`DELETE` surveys or their
own media. After this change:

- Reps **can** `UPDATE` their own `surveys` rows and `survey_photos` rows, and
  `UPDATE`/`DELETE` Storage objects **under their own `auth.uid()` prefix only**.
- Everything else still holds and is re-asserted by the new policies:
  - A rep cannot touch another rep's survey, photos, or objects.
  - A **deactivated** rep cannot edit — the new `surveys_rep_update` policy
    checks `profiles.active`, exactly like `surveys_rep_insert`.
  - A rep cannot reassign `rep_id` (policy `WITH CHECK` keeps `rep_id =
    auth.uid()`).
  - The **admin remains the only role that deletes a survey.**

`CLAUDE.md` is updated as part of this work (see §7).

## Out of scope (YAGNI)

- **Admin editing surveys.** Does not exist today; a separate feature. The edit
  route is owner-rep-only. `surveys_admin_update` RLS already exists and is left
  untouched, but no admin edit UI or RPC path is built.
- **Edit history / audit table.** Chosen explicitly: a single `edited_at`
  timestamp + badge, no old/new values.
- **Time-limited edit window.** Edits are allowed forever.
- **Concurrency control.** One rep owns a survey; last write wins.
- **Offline support / draft autosave.** Unchanged — still none.

---

## 1. Database — migration `0006_survey_edit.sql`

New numbered migration, **append-only** (never edit `0001`–`0005`). Every
statement is idempotent-guarded so a fresh `supabase db reset` or an accidental
re-run is harmless:

- `add column if not exists`
- `drop policy if exists <name> on <table>;` before each `create policy`
- `create or replace function` for the RPC

### 1.1 `surveys.edited_at`

```sql
alter table public.surveys
  add column if not exists edited_at timestamptz;
```

- `null` until the first rep edit. Presence ⇒ "Edited".
- Set **only** by `update_survey` to `now()`. `created_at` and `rep_id` are never
  written by the RPC.

### 1.2 RLS — `surveys`

```sql
drop policy if exists surveys_rep_update on public.surveys;
create policy surveys_rep_update on public.surveys
  for update
  using (rep_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active))
  with check (rep_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.active));
```

Mirrors `surveys_rep_insert`. The `WITH CHECK` clause prevents a rep from
handing the survey to another `rep_id`. `surveys_admin_update` and
`surveys_admin_delete` are unchanged.

### 1.3 RLS — `survey_photos`

```sql
drop policy if exists survey_photos_rep_update on public.survey_photos;
create policy survey_photos_rep_update on public.survey_photos
  for update
  using (exists (select 1 from public.surveys s
                 where s.id = survey_id and s.rep_id = auth.uid()))
  with check (exists (select 1 from public.surveys s
                      where s.id = survey_id and s.rep_id = auth.uid()));

drop policy if exists survey_photos_rep_delete on public.survey_photos;
create policy survey_photos_rep_delete on public.survey_photos
  for delete
  using (exists (select 1 from public.surveys s
                 where s.id = survey_id and s.rep_id = auth.uid()));
```

`survey_photos_rep_insert`, `survey_photos_select`, `survey_photos_admin_write`
are unchanged. (`update_survey` reconciles photos with `DELETE` + re-`INSERT`,
so the rep `INSERT`/`DELETE` policies are what the RPC relies on; the `UPDATE`
policy is added for completeness / future direct edits.)

### 1.4 Storage object policies

```sql
-- survey-photos: rep may update/delete objects under their own uid prefix
drop policy if exists "survey_photos_rep_update" on storage.objects;
create policy "survey_photos_rep_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "survey_photos_rep_delete" on storage.objects;
create policy "survey_photos_rep_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- survey-audio: same
drop policy if exists "survey_audio_rep_update" on storage.objects;
create policy "survey_audio_rep_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "survey_audio_rep_delete" on storage.objects;
create policy "survey_audio_rep_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);
```

The existing `*_rep_insert` / `*_rep_read` / `*_admin_read` policies stay.

### 1.5 `survey-audio` bucket limits (change #2)

```sql
update storage.buckets
  set file_size_limit = 26214400,  -- 25 MiB
      allowed_mime_types = array[
        'audio/webm','audio/mp4','audio/mpeg','audio/aac',
        'audio/ogg','audio/wav','audio/x-m4a']
  where id = 'survey-audio';
```

- Both in-app recorder MIME types (`audio/webm`, `audio/mp4`) are in the list, so
  existing behaviour is unaffected.
- This is the real server-side guard for change #2; the client check (§4.4) is
  UX only.
- `survey-photos` bucket is **not** touched.

### 1.6 `update_survey(payload jsonb)` RPC

`create or replace function public.update_survey(payload jsonb) returns uuid`,
`language plpgsql`, `security invoker`, `set search_path = public`.
Grants: `revoke all ... from public, anon; grant execute ... to authenticated;`

Payload shape is **identical to `SurveyRpcPayload`** (reuse `buildSurveyPayload`).
`payload.id` is the *existing* survey id.

Body, in order:

1. `v_id := (payload->>'id')::uuid;` — raise if `null`.
2. **`'Other'`-brand guard** — identical to `create_survey` (0005): every brand
   field set to `'Other'` must carry a non-blank `<field>_other`.
3. **Update the row:**
   ```sql
   update public.surveys set
     shop_name = payload->>'shop_name',
     market = payload->>'market',
     shop_size = payload->>'shop_size',
     customer_name = payload->>'customer_name',
     customer_number = payload->>'customer_number',
     gps_lat = (payload->>'gps_lat')::double precision,
     gps_lng = (payload->>'gps_lng')::double precision,
     gps_accuracy = nullif(payload->>'gps_accuracy','')::double precision,
     most_selling_fan = payload->>'most_selling_fan',
     rec_30w_1 = payload->>'rec_30w_1',
     rec_30w_2 = nullif(payload->>'rec_30w_2',''),
     rec_50w_1 = payload->>'rec_50w_1',
     rec_50w_2 = nullif(payload->>'rec_50w_2',''),
     audio_path = nullif(payload->>'audio_path',''),
     most_selling_fan_other = nullif(btrim(payload->>'most_selling_fan_other'),''),
     rec_30w_1_other = nullif(btrim(payload->>'rec_30w_1_other'),''),
     rec_30w_2_other = nullif(btrim(payload->>'rec_30w_2_other'),''),
     rec_50w_1_other = nullif(btrim(payload->>'rec_50w_1_other'),''),
     rec_50w_2_other = nullif(btrim(payload->>'rec_50w_2_other'),''),
     edited_at = now()
   where id = v_id;
   ```
   RLS (`surveys_rep_update`) silently restricts this to the caller's own,
   still-active row. If `not found` (0 rows) ⇒
   `raise exception 'survey not found or not editable';`
4. **Reconcile photos:** `delete from public.survey_photos where survey_id =
   v_id;` then loop `payload->'photos'` exactly as `create_survey` does — same
   `storage_path not like auth.uid()::text || '/%'` per-row check, same insert,
   same `v_front` / `v_inner` / `v_quotation` tallies.
5. **Count guards** — identical to `create_survey`: `v_front = 1`, `v_inner`
   between 1 and 10, `v_quotation ≤ 2`.
6. `return v_id;`

Because kept photos are always already under `{rep}/{surveyId}/…`, the caller-prefix
check passes for both kept and newly uploaded paths.

The `'Other'` CHECKs and `*_other` pairing CHECKs from 0005 remain the ultimate
backstop for brand data.

---

## 2. Media model for editing

The edit form distinguishes **existing** media from **newly picked** media:

| | Representation | On save |
|---|---|---|
| Existing, kept | `{ storagePath: string; url: string }` (url = signed) | `storagePath` passed back in `payload.photos` / `payload.audio_path` |
| Existing, removed | — | after RPC success, client `storage.remove([...removedPaths])` |
| Newly picked | `File` | uploaded to a **fresh** path, then referenced in the payload |

### 2.1 Upload paths

- **Create flow — unchanged:** `{rep}/{surveyId}/front.jpg`,
  `inner-${i}.jpg`, `quotation-${i}.jpg`, `comment.{webm|mp4}`.
- **Edit flow — new files use collision-proof names:**
  `{rep}/{surveyId}/{kind}-${crypto.randomUUID()}.jpg` for photos,
  `{rep}/{surveyId}/comment-${crypto.randomUUID()}.${ext}` for audio, where
  `ext` derives from the file MIME (`mp3`→`audio/mpeg`, `m4a`→`audio/x-m4a` or
  `audio/mp4`, `wav`, `ogg`, `webm`). This guarantees a kept file is never
  overwritten by a new one in the same survey folder.

### 2.2 Orphan cleanup

After `update_survey` returns, the client computes
`removed = oldPaths − keptPaths` for photos, plus the old `audio_path` if the
voice note was replaced or cleared, and calls `storage.remove(...)` on each
bucket. **Cleanup failure is non-fatal** — the DB row is already correct, and
`deleteSurvey` (admin) sweeps the whole `{rep}/{surveyId}` folder on final
deletion regardless. Log, don't throw.

---

## 3. Routes & navigation

| Route | Type | Behaviour |
|---|---|---|
| `/survey/[id]/edit` | **new** server component | Loads `surveys` row + `survey_photos` + signed media URLs. **Guard:** `getSessionProfile()`; redirect `/login` if none; `notFound()` unless `profile.id === survey.rep_id` (owner rep only — admin is *not* allowed here). Renders `<SurveyEditForm>`. |
| `/survey/[id]` | existing | `SurveyDetail` gains an **Edit survey** link when `profile.id === survey.rep_id`, and an "Edited · {relativeDate}" line when `edited_at` is set. |
| `/dashboard` | existing | Each list row with `edited_at` shows a small "Edited" tag. |
| `/admin/surveys` | existing | List shows an "Edited" badge per row; the admin query must select `edited_at`. |

Middleware needs no change — `/survey/**` is already auth-gated; the per-owner
check lives in the page and is backed by RLS.

---

## 4. Components & libs

### 4.1 `components/form/SurveyFields.tsx` — **new**

Extract the shared scalar-field block (shop name, market, shop size, customer
name, customer number, GPS, the five `BrandField`s) from `SurveyForm` into a
presentational component:

```tsx
export function SurveyFields({ v, set, errors }: {
  v: SurveyFormValues;
  set: <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => void;
  errors: Record<string, string>;
}) { /* the <TextField>/<SelectField>/<BrandField>/<GpsCapture> markup */ }
```

`SurveyForm` (create) and `SurveyEditForm` (edit) both render it, so the field
layout has one source of truth.

### 4.2 `components/form/SurveyForm.tsx` — refactor only

Replaces its inline field markup with `<SurveyFields>`. Still owns `EMPTY`
initial state, the `<h1>New shop survey</h1>` heading, the fixed "Submit survey"
bar, and `validateSurvey`. **No behavioural change for create.**

### 4.3 `components/form/SurveyEditForm.tsx` — **new** (`"use client"`)

Props: the existing survey row and the signed media (`photos[]`, `audio`).

- Initial state built from the row: scalar fields straight across; brand `_other`
  values into their fields.
- Media state kept as, per slot:
  - front: `frontExisting: {storagePath,url} | null` **xor** `frontNew: File | null`
  - inner / quotation: `existing: {storagePath,url}[]` + `new: File[]`
  - audio: `audioExistingUrl: string | null` + `audioNew: Blob | null` +
    `audioCleared: boolean`
- Renders `<SurveyFields>` + edit-mode `<PhotoCapture>` + `<VoiceRecorder>`.
- Heading "Edit survey"; fixed bar button "Save changes" / "Saving…".
- `beforeunload` dirty guard, same pattern as `/survey/new`.
- On submit: `validateSurveyEdit(...)` (§4.6) → `updateSurvey(id, editValues)`
  (§4.5) → toast → `router.push('/survey/${id}')`.

### 4.4 `components/form/VoiceRecorder.tsx` — extend

- New **Upload** `<label>` wrapping `<input type="file" accept="audio/*" hidden>`
  beside **Record**, in the no-clip state and the has-clip state ("Replace").
- On file pick: validate with `validateAudioUpload(file)` (§4.6). On failure show
  the message inline (`role="alert"`), don't call `onChange`. On success
  `onChange(file)` — value type stays `Blob | null` since `File extends Blob`.
- New optional prop `existingUrl?: string | null` — when set and no local clip,
  render `<audio src={existingUrl} controls>` plus **Replace** / **Delete**.
- `isRecordingSupported()` false ⇒ still show the Upload control (only the
  recorder is gated), and drop the "you can skip this field" copy to a softer
  "Recording isn't supported on this device — you can upload a file instead."

### 4.5 `components/form/PhotoCapture.tsx` — extend

New optional props (all ignored by the create flow, which never passes them):

```ts
existingFront?: { storagePath: string; url: string } | null;
existingInner?: { storagePath: string; url: string }[];
existingQuotation?: { storagePath: string; url: string }[];
onRemoveExistingFront?: () => void;
onRemoveExistingInner?: (storagePath: string) => void;
onRemoveExistingQuotation?: (storagePath: string) => void;
```

- Existing thumbnails render **before** pending-`File` thumbnails, each with a ✕
  that calls the matching `onRemoveExisting*`.
- Count labels and the max-enforcement in `addPhotos` use
  `existing.length + current.length` against `MAX_INNER_PHOTOS` /
  `MAX_QUOTATION_PHOTOS`.
- Front: if an existing front is present, "Take photo" / "Choose from gallery"
  replace it (set `frontNew`, clear `frontExisting`) — the UI still shows exactly
  one front.
- `<img>` from a signed URL keeps the intentional
  `@next/next/no-img-element` waiver already noted for this file.

### 4.6 `lib/validation.ts`

- `SurveyFormValues` unchanged.
- New `ALLOWED_AUDIO_TYPES` check:
  ```ts
  export function validateAudioUpload(file: File): string | null {
    if (!ALLOWED_AUDIO_TYPES.includes(file.type as any))
      return "Choose an audio file (mp3, m4a, wav, ogg, webm).";
    if (file.size > MAX_AUDIO_UPLOAD_MB * 1024 * 1024)
      return `Audio must be ${MAX_AUDIO_UPLOAD_MB} MB or smaller.`;
    return null;
  }
  ```
- `validateSurvey` also runs the audio check when `v.audio` is a `File` with a
  `name` (i.e. an upload, not a recorder `Blob`); recorder blobs
  (`audio/webm|mp4`, tiny) always pass.
- Factor the scalar checks (shop/market/size/customer/phone/GPS/brands) of
  `validateSurvey` into `validateScalarFields(v)`; `validateSurvey` =
  scalar + create-media checks; new `validateSurveyEdit(v)` = scalar + the
  edit-media rule "front present (existing **or** new)", "≥ 1 inner (existing +
  new)", "≤ 10 inner", "≤ 2 quotation", plus the audio check.

### 4.7 `lib/constants.ts`

```ts
export const MAX_AUDIO_UPLOAD_MB = 25;
export const ALLOWED_AUDIO_TYPES = [
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/aac",
  "audio/ogg", "audio/wav", "audio/x-m4a",
] as const;
```

### 4.8 `lib/upload.ts`

Add:

```ts
export async function uploadEditedMedia(
  supabase, repUid, surveyId,
  media: {
    front:      { keep: string } | { file: File };
    inner:      Array<{ keep: string } | { file: File }>;
    quotation:  Array<{ keep: string } | { file: File }>;
    audio:      { keep: string } | { file: Blob } | null;
  },
): Promise<{ front: string; inner: string[]; quotation: string[]; audio: string | null }>
```

- `keep` entries pass through unchanged.
- `file` entries upload to `{repUid}/{surveyId}/{kind}-${crypto.randomUUID()}.jpg`
  (photos, `contentType: "image/jpeg"`) or
  `.../comment-${uuid}.${extFromMime(file.type)}` (audio).
- Returns arrays in final display order; feeds straight into
  `buildSurveyPayload`.

`uploadSurveyMedia` (create) is untouched.

### 4.9 `lib/submitSurvey.ts`

Add:

```ts
export async function updateSurvey(surveyId: string, e: SurveyEditValues): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const paths = await uploadEditedMedia(supabase, user.id, surveyId, e.media);
  const payload = buildSurveyPayload(surveyId, e.values, paths); // reuses existing builder
  const { error } = await supabase.rpc("update_survey", { payload });
  if (error) throw new Error(`Could not save your changes: ${error.message}`);

  // best-effort orphan cleanup — paths present originally but not in `paths`
  const kept = new Set([paths.front, ...paths.inner, ...paths.quotation]);
  const removedPhotos = e.originalPhotoPaths.filter((p) => !kept.has(p));
  if (removedPhotos.length) await supabase.storage.from("survey-photos").remove(removedPhotos);
  if (e.removedAudioPath)   await supabase.storage.from("survey-audio").remove([e.removedAudioPath]);
}
```

`SurveyEditValues` carries: `values` (a `SurveyFormValues` for
`buildSurveyPayload`), `media` (the descriptor `uploadEditedMedia` takes),
`originalPhotoPaths: string[]` and `removedAudioPath: string | null` for cleanup.
Its exact field names are finalised during implementation.

### 4.10 Display surfaces for `edited_at`

- `lib/queries.ts` — `getRepSurveys` select includes `edited_at`.
- `lib/adminQueries.ts` — admin surveys list select includes `edited_at`
  (verify `all: true` paths still map it).
- `components/SurveyDetail.tsx` — header shows
  `Edited · {relativeDate(survey.edited_at)}` when set.
- `app/admin/surveys` list/table + `app/dashboard` list — "Edited" pill.
- `lib/exportSurveys.ts` + `app/admin/surveys/export/route.ts` — new
  `edited_at` column (ISO string, blank when null) in CSV and XLSX; column order
  documented in the export test.

---

## 5. Data flow — a rep edit

```
/survey/[id]/edit (server)
  guard: profile.id === survey.rep_id  ── else notFound()
  load row + survey_photos + getSignedMediaUrls(id)
        │
        ▼
<SurveyEditForm>  (client, prefilled)
  rep changes fields / adds / removes photos / replaces voice note
        │  submit
        ▼
validateSurveyEdit(values)         ── errors → inline, abort
        │
        ▼
updateSurvey(id, editValues)
  ├─ uploadEditedMedia()  → new Files to {rep}/{id}/{kind}-{uuid}
  ├─ buildSurveyPayload(id, values, mergedPaths)
  ├─ rpc("update_survey", { payload })
  │     └─ UPDATE surveys … edited_at = now()   (RLS: own + active)
  │        DELETE+INSERT survey_photos          (prefix + count guards)
  └─ storage.remove(removed photo paths / old audio)   (best-effort)
        │
        ▼
toast "Changes saved" → router.push(`/survey/${id}`)
   detail page shows new values + "Edited ·" line
   admin list shows "Edited" badge; export has edited_at
```

Failure of the RPC writes nothing (single statement group in one function
invocation; `create_survey`'s all-or-nothing property carries over). The rep
sees the error and retries — same contract as submit.

---

## 6. Testing

### 6.1 Unit (`npm test` — must stay green)

- `validateAudioUpload` / `validateSurvey`: rejects wrong-type and > 25 MB audio;
  accepts a recorder `Blob`; accepts a 24 MB `audio/mpeg` file.
- `validateSurveyEdit`: passes when front is an existing photo and no new front;
  fails when the only inner photo was removed; caps inner at 10 and quotation at
  2 counting existing + new.
- `SurveyFields`: renders all fields; shared by both forms (snapshot / role
  queries).
- `PhotoCapture` edit mode: existing thumbs render before pending; ✕ on an
  existing thumb fires `onRemoveExisting*`; max enforcement counts existing +
  pending.
- `VoiceRecorder` upload: bad type/size shows `role="alert"` and does not call
  `onChange`; good file calls `onChange`; `existingUrl` renders `<audio>` with
  Replace/Delete.
- `uploadEditedMedia` (mocked Supabase): `keep` entries pass through untouched;
  `file` entries upload to a `{kind}-<uuid>` path; return order preserved.
- `updateSurvey` (mocked): calls `rpc("update_survey")` with `payload.id ===
  surveyId`; on success removes exactly the dropped paths; RPC error propagates
  and cleanup is skipped.
- `exportSurveys`: `edited_at` column present, ISO when set, blank when null.

### 6.2 Integration (`npm run test:integration` — local Supabase; **currently in
the "authored, never run" set — running it is part of this work**)

- `update_survey` happy path: row fields change, `edited_at` moves from null to a
  timestamp, `created_at` and `rep_id` unchanged.
- `update_survey` rejects: `'Other'` brand with blank `_other`; 0 or 2 front
  photos; 0 or 11 inner; 3 quotation; a `storage_path` not under the caller
  prefix.
- RLS: rep B calling `update_survey` on rep A's survey id → `not editable`;
  deactivated rep → `not editable`; attempt to set `rep_id` via a crafted direct
  `UPDATE` is blocked by `WITH CHECK`.
- Storage: rep can `remove` and overwrite an object under their own prefix; rep
  cannot `remove` an object under another rep's prefix.
- `survey-audio` bucket rejects a 30 MB upload and a `application/pdf` upload.

### 6.3 e2e (`npm run e2e` — Playwright, local stack)

Extend the existing rep→admin flow: after the rep submits, the rep opens the
survey, edits the shop name, swaps the front photo, uploads a small `.mp3` voice
note, saves; the detail page reflects all three; the admin list shows the
"Edited" badge and the export contains a non-blank `edited_at`.

### 6.4 Gates

`npm test`, `npx tsc --noEmit`, `npm run build` all pass. Allowed build warnings
remain only the two `@next/next/no-img-element` in `PhotoCapture.tsx` /
`MediaGallery.tsx`.

---

## 7. Docs

### `CLAUDE.md`

- **Hard rules** — rewrite the "Reps cannot update or delete" bullet:
  > Reps **can** edit their own surveys and their own media (photos, voice note)
  > via `/survey/[id]/edit` → the `update_survey` RPC. Enforced at the DB layer:
  > `surveys_rep_update` / `survey_photos_rep_*` RLS and storage `*_rep_update` /
  > `*_rep_delete` policies, all scoped to `rep_id = auth.uid()` / the caller's
  > own object prefix, and all re-checking `profiles.active`. Reps still cannot
  > touch another rep's data, cannot reassign `rep_id`, and **cannot delete a
  > survey** — only the admin deletes.
- **Required survey fields** — add: an uploaded voice note must be an audio MIME
  type ≤ `MAX_AUDIO_UPLOAD_MB` (25 MB); enforced client-side and by the
  `survey-audio` bucket's `file_size_limit` / `allowed_mime_types`.
- **Layout** — add `app/survey/[id]/edit`, `components/form/SurveyFields.tsx`,
  `components/form/SurveyEditForm.tsx`, `update_survey` to the `lib` line.
- **Migrations** — note `0006_survey_edit.sql` (idempotent-guarded); still
  append-only.
- **Testing** — refresh the unit-test count after implementation.

### `docs/DEPLOYMENT.md`

- Add `0006` to the migration list.
- Reiterate: before any `supabase db push` against hosted, the `0005` ledger row
  must be inserted first (existing Step 2b), otherwise `db push` re-runs `0005`
  then `0006`. Applying `0006` via the SQL Editor is fine and needs no ledger
  row (matches how `0005` was shipped).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Widening RLS/storage lets a rep reach another rep's data through a missed clause | Every new policy is `rep_id = auth.uid()` / `foldername[1] = auth.uid()` **and** re-checks `active`; integration tests assert cross-rep denial explicitly. |
| New photo name `{kind}-{uuid}` diverges from create's `{kind}-{i}` | Intentional and isolated to the edit path; `create_survey` and `uploadSurveyMedia` untouched; display order comes from `sort_order`, not the filename. |
| Orphaned storage objects after a removed photo | Best-effort `storage.remove` post-RPC; admin `deleteSurvey` folder-sweep is the backstop; orphans are private and unreferenced. |
| `edited_at` missing from an `all: true` admin query path silently truncates nothing but hides the badge | §4.10 lists every select to touch; export test pins the column. |
| Integration/e2e suites have never run — new tests may surface pre-existing breakage | Budget time to get the suites green once; treat unrelated failures as a separate finding, not a blocker for this feature's own tests. |
| `allowed_mime_types` on `survey-audio` rejects a real device's odd MIME (e.g. `audio/3gpp`) | List covers the common set; if a field device fails, add its type in a follow-up one-line migration rather than widening blindly now. |

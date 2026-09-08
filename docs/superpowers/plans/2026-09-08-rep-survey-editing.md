# Rep Survey Editing + Voice-Note Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a field rep edit any survey they submitted (all fields, no time
limit, with an "Edited" marker for the admin), and let the voice-note field
accept an uploaded audio file as an alternative to recording.

**Architecture:** A new `update_survey` Postgres RPC mirrors `create_survey`'s
guards but does an `UPDATE` + photo-row reconciliation and stamps
`surveys.edited_at`. New RLS and Storage policies let a rep mutate **only their
own** rows and objects (scoped to `rep_id = auth.uid()` / their own uid path
prefix, and re-checking `profiles.active`). The create form's field markup is
extracted into a shared `SurveyFields` component consumed by both a `SurveyForm`
(create) and a new `SurveyEditForm` (edit) reachable at `/survey/[id]/edit`.

**Tech Stack:** Next.js 15.5 App Router (React 19, TypeScript), Tailwind,
Supabase (Postgres + RLS, Auth, Storage), Vitest (jsdom unit; Node integration
against a local Supabase), Playwright e2e, `xlsx`.

**Spec:** `docs/superpowers/specs/2026-09-08-rep-survey-editing-design.md`

## Global Constraints

- **Service-role key never reaches the browser.** All new client code uses the
  anon key via `createBrowserSupabase()`. The `update_survey` RPC is
  `security invoker` and called from the client — no admin client involved.
- **Reps mutate only their own data.** Every new RLS/Storage policy predicate is
  `rep_id = auth.uid()` (or `(storage.foldername(name))[1] = auth.uid()::text`)
  **and** re-checks `profiles.active`. Reps still cannot touch another rep's
  survey/photos/objects, cannot change `rep_id`, and **cannot delete a survey**
  (admin only).
- **Migrations are append-only.** New file `supabase/migrations/0006_survey_edit.sql`;
  never edit `0001`–`0005`. Every statement idempotent-guarded
  (`add column if not exists`, `drop policy if exists` before `create policy`,
  `create or replace function`).
- **Fixed lists stay single-source** (`lib/constants.ts`, mirrored by Postgres
  CHECKs). This plan adds only `MAX_AUDIO_UPLOAD_MB = 25` and
  `ALLOWED_AUDIO_TYPES`.
- **Uploaded voice note:** audio MIME type only, ≤ 25 MB. Enforced client-side
  (`validateAudioUpload`) and server-side (the `survey-audio` bucket's
  `file_size_limit` + `allowed_mime_types`).
- **Required survey fields unchanged:** shop name, market, shop size, customer
  name, customer number (`03XXXXXXXXX`), GPS, exactly 1 front photo, 1–10 inner
  photos, `most_selling_fan`, `rec_30w_1`, `rec_50w_1`. `'Other'` brand needs a
  1–40 char `<field>_other`.
- **Build hygiene:** `npm test`, `npx tsc --noEmit`, `npm run build` must all
  pass. Only allowed build warnings: the two `@next/next/no-img-element` in
  `PhotoCapture.tsx` / `MediaGallery.tsx`.
- **Conventional Commits.** Commit after every task.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `supabase/migrations/0006_survey_edit.sql` | `edited_at` column, rep update/delete RLS + Storage policies, `survey-audio` bucket limits, `update_survey` RPC. |
| `components/form/SurveyFields.tsx` | Presentational: the scalar fields + GPS + 5 brand fields shared by create and edit forms; photos/voice injected as slots. |
| `components/form/SurveyEditForm.tsx` | Client. Prefilled edit form; hybrid existing/new media state; calls `updateSurvey`. |
| `app/survey/[id]/edit/page.tsx` | Server. Owner-rep-only guard; loads row + signed media; renders `SurveyEditForm`. |
| `tests/integration/update-survey-rpc.test.ts` | RPC happy path + every guard + RLS ownership/active. |
| `tests/integration/storage-rep-editable.test.ts` | Replaces `storage-rep-immutable.test.ts`: own object mutable, other rep's not. |
| `tests/unit/upload-edited-media.test.ts` | `uploadEditedMedia` keeps/uploads/orders correctly. |
| `tests/unit/update-survey.test.ts` | `updateSurvey` lib: uploads new only, calls RPC, cleans orphans. |
| `tests/unit/survey-edit-form.test.tsx` | `SurveyEditForm` prefill, remove-existing, submit payload. |
| `tests/unit/survey-fields.test.tsx` | `SurveyFields` renders all fields + slots. |
| `tests/e2e/survey-edit.spec.ts` | Rep creates → edits (text, front photo, uploads mp3) → admin sees new values + "Edited". |
| `tests/e2e/fixtures/note.mp3` | Tiny fake audio fixture. |

**Modified:**

| Path | Change |
|---|---|
| `lib/types.ts` | `Survey.edited_at: string \| null`. |
| `lib/constants.ts` | `MAX_AUDIO_UPLOAD_MB`, `ALLOWED_AUDIO_TYPES`. |
| `lib/validation.ts` | `ExistingMedia` type; `validateAudioUpload`, `audioUploadError`; extract `validateScalarFields`; add `validateSurveyEdit`; audio check in `validateSurvey`. |
| `lib/upload.ts` | `MediaSlot`/`AudioSlot` types, `extFromAudioMime`, `uploadEditedMedia`. |
| `lib/submitSurvey.ts` | `SurveyEditInput` type, `updateSurvey`. |
| `lib/queries.ts` | `SurveyListItem.edited_at`; select + map it. |
| `lib/adminQueries.ts` | `AdminSurveyRow.edited_at`; select + map it. |
| `lib/exportSurveys.ts` | `edited_at` in `ExportRow` + `EXPORT_COLUMNS` + `toExportRows`. |
| `components/form/SurveyForm.tsx` | Use `SurveyFields` with photos/voice slots; behaviour unchanged for create. |
| `components/form/VoiceRecorder.tsx` | Upload `<input>` beside Record; `existingUrl` playback; validate on pick. |
| `components/form/PhotoCapture.tsx` | Optional `existing*` props + `onRemoveExisting*`; counts include existing. |
| `components/SurveyDetail.tsx` | `canEdit` prop → Edit link; "Edited · …" line when `edited_at`. |
| `components/admin/SurveyTable.tsx` | "Edited" pill when `row.edited_at`. |
| `app/survey/[id]/page.tsx` | Pass `canEdit={profile.id === data.rep_id}`. |
| `app/survey/[id]/actions.ts` | `getSignedMediaUrls` returns `storagePath` per photo + `audioPath`. |
| `app/dashboard/page.tsx` | "Edited" tag on list rows with `edited_at`. |
| `app/admin/surveys/export/route.ts` | Classify media paths by `survey_photos` vs `audio_path` (not by extension). |
| `tests/integration/rls.test.ts` | "rep cannot update a survey" → "rep can update **own**, not another's, not when deactivated". |
| `CLAUDE.md`, `docs/DEPLOYMENT.md` | Rule/layout/migration/test-count updates. |

**Deleted:** `tests/integration/storage-rep-immutable.test.ts` (replaced by
`storage-rep-editable.test.ts`).

---

## Notes for the implementer (read once)

- **`updated_at` already exists.** `0001_schema.sql` gives `surveys.updated_at`
  plus a `set_updated_at()` BEFORE-UPDATE trigger. We still add a **separate
  nullable `edited_at`** because "was this edited after submission?" must be
  `edited_at IS NOT NULL` (unambiguous, and exports show blank until edited).
  The trigger keeps bumping `updated_at` independently — no conflict.
- **Integration tests need a local stack:** `npm run db:start` (Docker) then
  `npm run db:reset`, and run with `npm run test:integration`. These suites are
  in the repo's "authored, never run" set — running them here is part of the
  work. If Docker is genuinely unavailable, still write the test files, commit
  them, and flag in the task summary that they were not executed. Do **not**
  weaken a test to make it pass.
- **`crypto.randomUUID()`** is available in the browser and in the Node test
  env. Unit tests stub it (see `tests/unit/submit-survey.test.ts` for the
  pattern).
- Match surrounding style: 2-space indent, double quotes, no semicolon-free
  lines, Tailwind utility classes, `role="alert"` for errors.

---

## Task 1: Migration `0006` — schema, policies, bucket limits, `update_survey` RPC

**Files:**
- Create: `supabase/migrations/0006_survey_edit.sql`
- Modify: `lib/types.ts` (add `edited_at` to `Survey`)

**Interfaces:**
- Produces: DB function `update_survey(payload jsonb) returns uuid` — payload is
  the exact shape of `SurveyRpcPayload` (`lib/validation.ts`) with `id` = the
  **existing** survey id. Raises on: null id; an `'Other'` brand with blank
  `_other`; `row not found / not editable`; a `storage_path` not under
  `auth.uid()||'/'`; front count ≠ 1; inner count < 1 or > 10; quotation
  count > 2.
- Produces: `surveys.edited_at timestamptz` (nullable), set to `now()` by
  `update_survey`.
- Produces: RLS `surveys_rep_update`, `survey_photos_rep_update`,
  `survey_photos_rep_delete`; Storage `survey_photos_rep_update/_delete`,
  `survey_audio_rep_update/_delete`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0006_survey_edit.sql`:

```sql
-- Rep survey editing + voice-note upload.
--
-- Re-runnable: `add column if not exists`, every `create policy` is preceded by
-- a matching `drop policy if exists`, and the RPC is `create or replace`. A
-- fresh `supabase db reset` or an accidental re-run is harmless.

-- 1. "Edited after submission" marker. NULL until the first rep/admin edit.
--    (surveys.updated_at + its trigger from 0001 still fire independently.)
alter table public.surveys
  add column if not exists edited_at timestamptz;

-- 2. A rep may UPDATE their own survey while their profile is active, and may
--    not hand it to another rep_id.
drop policy if exists surveys_rep_update on public.surveys;
create policy surveys_rep_update on public.surveys
  for update
  using  (rep_id = auth.uid() and exists (
           select 1 from public.profiles p where p.id = auth.uid() and p.active))
  with check (rep_id = auth.uid() and exists (
           select 1 from public.profiles p where p.id = auth.uid() and p.active));

-- 3. A rep may UPDATE/DELETE survey_photos rows belonging to their own surveys.
drop policy if exists survey_photos_rep_update on public.survey_photos;
create policy survey_photos_rep_update on public.survey_photos
  for update
  using  (exists (select 1 from public.surveys s where s.id = survey_id and s.rep_id = auth.uid()))
  with check (exists (select 1 from public.surveys s where s.id = survey_id and s.rep_id = auth.uid()));

drop policy if exists survey_photos_rep_delete on public.survey_photos;
create policy survey_photos_rep_delete on public.survey_photos
  for delete
  using (exists (select 1 from public.surveys s where s.id = survey_id and s.rep_id = auth.uid()));

-- 4. Storage: a rep may UPDATE/DELETE objects under their own uid prefix only.
drop policy if exists "survey_photos_rep_update" on storage.objects;
create policy "survey_photos_rep_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "survey_photos_rep_delete" on storage.objects;
create policy "survey_photos_rep_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "survey_audio_rep_update" on storage.objects;
create policy "survey_audio_rep_update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "survey_audio_rep_delete" on storage.objects;
create policy "survey_audio_rep_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Server-side guard for uploaded voice notes: audio types, <= 25 MiB.
--    Both in-app recorder types (audio/webm, audio/mp4) are included.
update storage.buckets
  set file_size_limit = 26214400,
      allowed_mime_types = array[
        'audio/webm','audio/mp4','audio/mpeg','audio/aac',
        'audio/ogg','audio/wav','audio/x-m4a']
  where id = 'survey-audio';

-- 6. update_survey: same guards as create_survey (0005) but UPDATE + photo-row
--    reconciliation, and stamps edited_at.
create or replace function public.update_survey(payload jsonb)
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

  update public.surveys set
    shop_name = payload->>'shop_name',
    market = payload->>'market',
    shop_size = payload->>'shop_size',
    customer_name = payload->>'customer_name',
    customer_number = payload->>'customer_number',
    gps_lat = (payload->>'gps_lat')::double precision,
    gps_lng = (payload->>'gps_lng')::double precision,
    gps_accuracy = nullif(payload->>'gps_accuracy', '')::double precision,
    most_selling_fan = payload->>'most_selling_fan',
    rec_30w_1 = payload->>'rec_30w_1',
    rec_30w_2 = nullif(payload->>'rec_30w_2', ''),
    rec_50w_1 = payload->>'rec_50w_1',
    rec_50w_2 = nullif(payload->>'rec_50w_2', ''),
    audio_path = nullif(payload->>'audio_path', ''),
    most_selling_fan_other = nullif(btrim(payload->>'most_selling_fan_other'), ''),
    rec_30w_1_other = nullif(btrim(payload->>'rec_30w_1_other'), ''),
    rec_30w_2_other = nullif(btrim(payload->>'rec_30w_2_other'), ''),
    rec_50w_1_other = nullif(btrim(payload->>'rec_50w_1_other'), ''),
    rec_50w_2_other = nullif(btrim(payload->>'rec_50w_2_other'), ''),
    edited_at = now()
  where id = v_id;

  if not found then
    raise exception 'survey not found or not editable';
  end if;

  delete from public.survey_photos where survey_id = v_id;

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

revoke all on function public.update_survey(jsonb) from public, anon;
grant execute on function public.update_survey(jsonb) to authenticated;
```

- [ ] **Step 2: Add `edited_at` to the `Survey` type**

In `lib/types.ts`, inside `interface Survey`, next to `created_at` / `updated_at`:

```ts
  created_at: string;
  updated_at: string;
  edited_at: string | null;
```

- [ ] **Step 3: Apply and verify the migration**

Run: `npm run db:start` (once, if not already up) then `npm run db:reset`
Expected: reset completes, applying `0001`…`0006` with no error.

Run: `npx tsc --noEmit`
Expected: passes.

If Docker is unavailable, skip the reset, note it in the task summary, and rely
on Task 2/3 (or a later manual run) to exercise the SQL.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_survey_edit.sql lib/types.ts
git commit -m "feat(db): 0006 — rep survey-edit RLS/storage policies + update_survey RPC"
```

---

## Task 2: `update_survey` RPC integration tests

**Files:**
- Create: `tests/integration/update-survey-rpc.test.ts`

**Interfaces:**
- Consumes: `update_survey` RPC (Task 1); `serviceClient`, `signInAs` from
  `tests/setup/supabase-test-client`.

- [ ] **Step 1: Write the tests**

Create `tests/integration/update-survey-rpc.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

const REP1 = "10000000-0000-0000-0000-000000000002";
const REP2 = "10000000-0000-0000-0000-000000000003";

function createPayload(id: string, over: Record<string, unknown> = {}) {
  return {
    id, shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
    customer_name: "Bilal", customer_number: "03001234567",
    gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
    most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: null,
    rec_50w_1: "Royal", rec_50w_2: null, audio_path: null,
    most_selling_fan_other: null, rec_30w_1_other: null, rec_30w_2_other: null,
    rec_50w_1_other: null, rec_50w_2_other: null,
    photos: [
      { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
      { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
    ],
    ...over,
  };
}

async function seedSurvey(rep: Awaited<ReturnType<typeof signInAs>>, id: string) {
  const { error } = await rep.rpc("create_survey", { payload: createPayload(id) });
  expect(error).toBeNull();
}

describe("update_survey RPC", () => {
  beforeEach(async () => {
    await serviceClient().from("surveys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await serviceClient().from("profiles").update({ active: true }).in("id", [REP1, REP2]);
  });

  it("updates fields and stamps edited_at without touching created_at / rep_id", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000001";
    await seedSurvey(rep, id);
    const before = await serviceClient().from("surveys")
      .select("created_at, edited_at, rep_id").eq("id", id).single();
    expect(before.data?.edited_at).toBeNull();

    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "New Name", most_selling_fan: "SK" }),
    });
    expect(error).toBeNull();

    const after = await serviceClient().from("surveys")
      .select("shop_name, most_selling_fan, created_at, edited_at, rep_id").eq("id", id).single();
    expect(after.data?.shop_name).toBe("New Name");
    expect(after.data?.most_selling_fan).toBe("SK");
    expect(after.data?.created_at).toBe(before.data?.created_at);
    expect(after.data?.rep_id).toBe(REP1);
    expect(after.data?.edited_at).not.toBeNull();
  });

  it("reconciles photo rows to the payload", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000002";
    await seedSurvey(rep, id);
    await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [
        { kind: "front", storage_path: `${REP1}/${id}/front-new.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-1.jpg`, sort_order: 1 },
      ] }),
    });
    const { data } = await serviceClient().from("survey_photos")
      .select("kind, storage_path").eq("survey_id", id).order("storage_path");
    expect(data?.map((p) => p.kind).sort()).toEqual(["front", "inner", "inner"]);
    expect(data?.some((p) => p.storage_path === `${REP1}/${id}/front-new.jpg`)).toBe(true);
  });

  it("rejects an 'Other' brand with no typed name and rolls back", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000003";
    await seedSurvey(rep, id);
    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "Rolled Back", most_selling_fan: "Other", most_selling_fan_other: "" }),
    });
    expect(error).not.toBeNull();
    const { data } = await serviceClient().from("surveys").select("shop_name").eq("id", id).single();
    expect(data?.shop_name).toBe("Al Madina");
  });

  it("rejects bad photo counts", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000004";
    await seedSurvey(rep, id);
    const zeroInner = await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [{ kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 }] }),
    });
    expect(zeroInner.error).not.toBeNull();
    const threeQuote = await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [
        { kind: "front", storage_path: `${REP1}/${id}/front.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
        { kind: "quotation", storage_path: `${REP1}/${id}/q0.jpg`, sort_order: 0 },
        { kind: "quotation", storage_path: `${REP1}/${id}/q1.jpg`, sort_order: 1 },
        { kind: "quotation", storage_path: `${REP1}/${id}/q2.jpg`, sort_order: 2 },
      ] }),
    });
    expect(threeQuote.error).not.toBeNull();
  });

  it("rejects a storage_path outside the caller prefix", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000005";
    await seedSurvey(rep, id);
    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { photos: [
        { kind: "front", storage_path: `${REP2}/${id}/front.jpg`, sort_order: 0 },
        { kind: "inner", storage_path: `${REP1}/${id}/inner-0.jpg`, sort_order: 0 },
      ] }),
    });
    expect(error).not.toBeNull();
  });

  it("does not let a rep edit another rep's survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000006";
    await seedSurvey(rep1, id);
    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    const { error } = await rep2.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "Hijacked" }),
    });
    expect(error).not.toBeNull(); // "survey not found or not editable"
    const { data } = await serviceClient().from("surveys").select("shop_name").eq("id", id).single();
    expect(data?.shop_name).toBe("Al Madina");
  });

  it("does not let a deactivated rep edit their own survey", async () => {
    const rep = await signInAs("rep.one@survey.local", "test-pass-123");
    const id = "11111111-0000-0000-0000-000000000007";
    await seedSurvey(rep, id);
    await serviceClient().from("profiles").update({ active: false }).eq("id", REP1);
    const { error } = await rep.rpc("update_survey", {
      payload: createPayload(id, { shop_name: "While Inactive" }),
    });
    expect(error).not.toBeNull();
    await serviceClient().from("profiles").update({ active: true }).eq("id", REP1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:integration -- update-survey-rpc`
Expected: all pass. (Requires `supabase start` + a prior `npm run db:reset` so
`0006` is applied. If Docker is unavailable: commit and note it was not run.)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/update-survey-rpc.test.ts
git commit -m "test(integration): update_survey RPC guards + RLS ownership"
```

---

## Task 3: Integration — rep can edit own data, not others'

**Files:**
- Modify: `tests/integration/rls.test.ts` (rewrite one `it` block)
- Create: `tests/integration/storage-rep-editable.test.ts`
- Delete: `tests/integration/storage-rep-immutable.test.ts`

**Interfaces:**
- Consumes: RLS + Storage policies from Task 1.

- [ ] **Step 1: Flip the survey-update RLS test**

In `tests/integration/rls.test.ts`, replace the `it("rep cannot update a survey", …)`
block with:

```ts
  it("rep can update their own survey", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const { error } = await rep1.from("surveys")
      .update({ shop_name: "renamed by owner" }).eq("id", "44444444-4444-4444-4444-444444444444");
    expect(error).toBeNull();
    const { data } = await serviceClient().from("surveys")
      .select("shop_name").eq("id", "44444444-4444-4444-4444-444444444444").single();
    expect(data?.shop_name).toBe("renamed by owner");
  });

  it("rep cannot update another rep's survey", async () => {
    const rep2 = await signInAs("rep.two@survey.local", "test-pass-123");
    await rep2.from("surveys")
      .update({ shop_name: "hacked" }).eq("id", "44444444-4444-4444-4444-444444444444");
    const { data } = await serviceClient().from("surveys")
      .select("shop_name").eq("id", "44444444-4444-4444-4444-444444444444").single();
    expect(data?.shop_name).not.toBe("hacked");
  });
```

Leave `"rep cannot delete a survey"` and the read/admin tests unchanged. Note
the `beforeAll` re-inserts `44444444…` fresh each run, so ordering within the
file is fine.

- [ ] **Step 2: Replace the storage immutability test**

```bash
git rm tests/integration/storage-rep-immutable.test.ts
```

Create `tests/integration/storage-rep-editable.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serviceClient, signInAs } from "@/tests/setup/supabase-test-client";

// After 0006 a rep may mutate objects under their OWN uid prefix (needed to
// replace/remove media while editing a survey), but still not another rep's.

const REP1 = "10000000-0000-0000-0000-000000000002";
const REP2 = "10000000-0000-0000-0000-000000000003";
const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
const newBytes = new Blob([new Uint8Array([4, 5, 6, 7])], { type: "image/jpeg" });

describe("storage — rep may edit their own media", () => {
  it("rep can overwrite their own object", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const path = `${REP1}/editable-test/overwrite.jpg`;
    await rep1.storage.from("survey-photos").upload(path, bytes, { upsert: true });
    const { error } = await rep1.storage.from("survey-photos").upload(path, newBytes, { upsert: true });
    expect(error).toBeNull();
  });

  it("rep can delete their own object", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const path = `${REP1}/editable-test/delete.jpg`;
    await rep1.storage.from("survey-photos").upload(path, bytes, { upsert: true });
    await rep1.storage.from("survey-photos").remove([path]);
    const { error } = await serviceClient().storage.from("survey-photos").download(path);
    expect(error).not.toBeNull(); // gone
  });

  it("rep cannot delete another rep's object", async () => {
    const other = `${REP2}/editable-test/theirs.jpg`;
    await serviceClient().storage.from("survey-photos").upload(other, bytes, { upsert: true });
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    await rep1.storage.from("survey-photos").remove([other]);
    const { data, error } = await serviceClient().storage.from("survey-photos").download(other);
    expect(error).toBeNull();
    expect(data).not.toBeNull(); // still there
  });

  it("survey-audio bucket rejects a non-audio content type", async () => {
    const rep1 = await signInAs("rep.one@survey.local", "test-pass-123");
    const pdf = new Blob([new Uint8Array([1])], { type: "application/pdf" });
    const { error } = await rep1.storage.from("survey-audio")
      .upload(`${REP1}/editable-test/x.pdf`, pdf, { upsert: true });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run**

Run: `npm run test:integration -- rls storage-rep-editable`
Expected: pass. (Local stack required; else commit + note.)

- [ ] **Step 4: Commit**

```bash
git add tests/integration/rls.test.ts tests/integration/storage-rep-editable.test.ts
git rm tests/integration/storage-rep-immutable.test.ts
git commit -m "test(integration): rep may edit own survey + media, not others'"
```

---

## Task 4: Constants + `validateAudioUpload` + `ExistingMedia` type

**Files:**
- Modify: `lib/constants.ts`
- Modify: `lib/validation.ts`
- Modify: `tests/unit/validation.test.ts`

**Interfaces:**
- Produces: `MAX_AUDIO_UPLOAD_MB = 25`, `ALLOWED_AUDIO_TYPES: readonly string[]`
  (in `lib/constants.ts`).
- Produces: `validateAudioUpload(file: File): string | null` and
  `type ExistingMedia = { storagePath: string; url: string }` (in
  `lib/validation.ts`).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/validation.test.ts`:

```ts
import { validateAudioUpload } from "@/lib/validation";
import { MAX_AUDIO_UPLOAD_MB } from "@/lib/constants";

describe("validateAudioUpload", () => {
  const file = (type: string, bytes: number) =>
    new File([new Uint8Array(1)], "n", { type }) &&
    Object.assign(new File([new Uint8Array(1)], "n", { type }), { size: bytes }) as File;

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

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/validation.test.ts`
Expected: FAIL — `validateAudioUpload` is not exported.

- [ ] **Step 3: Implement**

In `lib/constants.ts`, after `MAX_AUDIO_SECONDS`:

```ts
export const MAX_AUDIO_UPLOAD_MB = 25;
export const ALLOWED_AUDIO_TYPES = [
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/aac",
  "audio/ogg", "audio/wav", "audio/x-m4a",
] as const;
```

In `lib/validation.ts`, update the imports from `./constants` to include
`MAX_AUDIO_UPLOAD_MB, ALLOWED_AUDIO_TYPES`, and add near the top (after the
`GpsFix` interface):

```ts
export type ExistingMedia = { storagePath: string; url: string };

export function validateAudioUpload(file: File): string | null {
  if (!(ALLOWED_AUDIO_TYPES as readonly string[]).includes(file.type))
    return "Choose an audio file (mp3, m4a, wav, ogg, or webm).";
  if (file.size > MAX_AUDIO_UPLOAD_MB * 1024 * 1024)
    return `Audio must be ${MAX_AUDIO_UPLOAD_MB} MB or smaller.`;
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/constants.ts lib/validation.ts tests/unit/validation.test.ts
git commit -m "feat(validation): validateAudioUpload + audio upload constants"
```

---

## Task 5: `validateScalarFields` refactor + `validateSurveyEdit` + `audioUploadError`

**Files:**
- Modify: `lib/validation.ts`
- Modify: `tests/unit/validation.test.ts`

**Interfaces:**
- Consumes: `validateAudioUpload` (Task 4).
- Produces:
  - `validateScalarFields(v: SurveyFormValues): Record<string, string>` — shop /
    market / size / customer / phone / GPS / the 5 brand fields only.
  - `audioUploadError(audio: Blob | null): string | null` — runs
    `validateAudioUpload` when `audio instanceof File`, else `null`.
  - `validateSurveyEdit(v: SurveyFormValues, counts: { front: number; inner:
    number; quotation: number }): Record<string, string>`.
  - `validateSurvey` behaviour is unchanged (now also reports `audio` on a bad
    upload).

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/validation.test.ts`:

```ts
import { validateSurveyEdit, validateScalarFields } from "@/lib/validation";
import type { SurveyFormValues } from "@/lib/validation";

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
    const e = validateSurveyEdit(goodScalars, { front: 1, inner: 2, quotation: 0 });
    expect(e).toEqual({});
  });
  it("flags a missing front and empty inner set", () => {
    const e = validateSurveyEdit(goodScalars, { front: 0, inner: 0, quotation: 0 });
    expect(e.frontPhoto).toMatch(/front photo/i);
    expect(e.innerPhotos).toMatch(/at least one/i);
  });
  it("caps inner at 10 and quotation at 2", () => {
    const e = validateSurveyEdit(goodScalars, { front: 1, inner: 11, quotation: 3 });
    expect(e.innerPhotos).toMatch(/no more than 10/i);
    expect(e.quotationPhotos).toMatch(/no more than 2/i);
  });
  it("reuses the scalar checks", () => {
    const e = validateSurveyEdit({ ...goodScalars, shop_name: "" }, { front: 1, inner: 1, quotation: 0 });
    expect(e.shop_name).toBeTruthy();
  });
});

describe("validateScalarFields", () => {
  it("returns no errors for good scalars and ignores media", () => {
    expect(validateScalarFields(goodScalars)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/validation.test.ts`
Expected: FAIL — `validateSurveyEdit` / `validateScalarFields` not exported.

- [ ] **Step 3: Implement**

In `lib/validation.ts`, replace the current `validateSurvey` with:

```ts
export function validateScalarFields(v: SurveyFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.shop_name.trim()) e.shop_name = "Shop name is required";
  if (!(MARKETS as readonly string[]).includes(v.market)) e.market = "Select a market";
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

export function audioUploadError(audio: Blob | null): string | null {
  return audio instanceof File ? validateAudioUpload(audio) : null;
}

export function validateSurvey(v: SurveyFormValues): Record<string, string> {
  const e = validateScalarFields(v);
  if (!v.frontPhoto) e.frontPhoto = "Add a front photo";
  if (v.innerPhotos.length < 1) e.innerPhotos = "Add at least one inner photo";
  else if (v.innerPhotos.length > MAX_INNER_PHOTOS) e.innerPhotos = `No more than ${MAX_INNER_PHOTOS} inner photos`;
  if (v.quotationPhotos.length > MAX_QUOTATION_PHOTOS)
    e.quotationPhotos = `No more than ${MAX_QUOTATION_PHOTOS} quotation photos`;
  const a = audioUploadError(v.audio);
  if (a) e.audio = a;
  return e;
}

export function validateSurveyEdit(
  v: SurveyFormValues,
  counts: { front: number; inner: number; quotation: number },
): Record<string, string> {
  const e = validateScalarFields(v);
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

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run tests/unit/validation.test.ts tests/unit/survey-form-validation.test.tsx`
Expected: PASS — existing `validateSurvey` behaviour intact, new tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/unit/validation.test.ts
git commit -m "refactor(validation): share scalar checks; add validateSurveyEdit"
```

---

## Task 6: `VoiceRecorder` — record OR upload, plus existing-audio playback

**Files:**
- Modify: `components/form/VoiceRecorder.tsx`
- Modify: `tests/unit/voice-recorder.test.tsx`

**Interfaces:**
- Consumes: `audioUploadError` (Task 5).
- Produces: `VoiceRecorder` props become
  `{ value: Blob | null; onChange: (b: Blob | null) => void; existingUrl?: string | null; onClearExisting?: () => void }`.
  On a rejected upload it renders the message with `role="alert"` and does **not**
  call `onChange`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/unit/voice-recorder.test.tsx` contents with:

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fakeRecorder = {
  start: vi.fn(),
  stop: vi.fn(async () => ({ blob: new Blob(["a"], { type: "audio/webm" }), seconds: 3, mimeType: "audio/webm" })),
  onAutoStop: vi.fn(),
};
vi.mock("@/lib/audio", () => ({
  isRecordingSupported: vi.fn(() => true),
  createRecorder: vi.fn(() => fakeRecorder),
}));
import { isRecordingSupported } from "@/lib/audio";
import { VoiceRecorder } from "@/components/form/VoiceRecorder";

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:a");
  globalThis.URL.revokeObjectURL = vi.fn();
  // @ts-expect-error partial mock
  navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [] })) };
});

const audioFile = (type: string, bytes = 1024) =>
  Object.assign(new File([new Uint8Array(1)], "note", { type }), { size: bytes }) as File;

describe("VoiceRecorder", () => {
  it("records then exposes playback and returns the blob", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /^record$/i }));
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onChange).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("accepts a valid uploaded audio file", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByTestId("audio-upload-input"), audioFile("audio/mpeg"));
    expect(onChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("rejects a non-audio upload without calling onChange", async () => {
    const onChange = vi.fn();
    render(<VoiceRecorder value={null} onChange={onChange} />);
    await userEvent.upload(screen.getByTestId("audio-upload-input"), audioFile("application/pdf"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/audio file/i);
  });

  it("plays an existing note and can clear it", async () => {
    const onClearExisting = vi.fn();
    render(<VoiceRecorder value={null} onChange={vi.fn()} existingUrl="https://x/a.mp3" onClearExisting={onClearExisting} />);
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("https://x/a.mp3");
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onClearExisting).toHaveBeenCalled();
  });

  it("still offers upload when recording is unsupported", () => {
    (isRecordingSupported as unknown as Mock).mockReturnValueOnce(false);
    render(<VoiceRecorder value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("audio-upload-input")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/voice-recorder.test.tsx`
Expected: FAIL — no `audio-upload-input`, `existingUrl` prop unknown.

- [ ] **Step 3: Implement**

Replace `components/form/VoiceRecorder.tsx` with:

```tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRecorder, isRecordingSupported } from "@/lib/audio";
import { MAX_AUDIO_SECONDS } from "@/lib/constants";
import { audioUploadError } from "@/lib/validation";

function mmss(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceRecorder({
  value, onChange, existingUrl, onClearExisting,
}: {
  value: Blob | null;
  onChange: (b: Blob | null) => void;
  existingUrl?: string | null;
  onClearExisting?: () => void;
}) {
  const supported = isRecordingSupported();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [uploadError, setUploadError] = useState("");
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const clip = value ?? recorded;
  const url = useMemo(() => (clip ? URL.createObjectURL(clip) : null), [clip]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = createRecorder(stream);
    rec.onAutoStop(() => stop());
    recorderRef.current = rec;
    rec.start();
    setRecorded(null);
    setUploadError("");
    setRecording(true);
    setElapsed(0);
    tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  async function stop() {
    if (tick.current) clearInterval(tick.current);
    const rec = recorderRef.current;
    if (!rec) return;
    const { blob } = await rec.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecorded(blob);
    onChange(blob);
  }

  function del() {
    setRecorded(null);
    setUploadError("");
    onChange(null);
  }

  function handleUpload(file: File | undefined) {
    if (!file) return;
    const err = audioUploadError(file);
    if (err) { setUploadError(err); return; }
    setUploadError("");
    setRecorded(null);
    onChange(file);
  }

  const uploadControl = (
    <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
      {clip || existingUrl ? "Replace with file" : "Upload file"}
      <input data-testid="audio-upload-input" type="file" accept="audio/*" hidden
        onChange={(e) => handleUpload(e.target.files?.[0])} />
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Pak Fan comments (voice note, optional)</span>

      {recording ? (
        <button type="button" onClick={stop}
          className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">
          Stop · {mmss(elapsed)} / {mmss(MAX_AUDIO_SECONDS)}
        </button>
      ) : clip && url ? (
        <div className="flex flex-col gap-2">
          <audio src={url} controls className="w-full" />
          <div className="flex flex-wrap gap-2">
            {supported ? (
              <button type="button" onClick={start} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Record again</button>
            ) : null}
            {uploadControl}
            <button type="button" onClick={del} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-red-600">Delete</button>
          </div>
        </div>
      ) : existingUrl ? (
        <div className="flex flex-col gap-2">
          <audio src={existingUrl} controls className="w-full" />
          <div className="flex flex-wrap gap-2">
            {supported ? (
              <button type="button" onClick={start} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Record new</button>
            ) : null}
            {uploadControl}
            <button type="button" onClick={() => onClearExisting?.()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-red-600">Delete</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {supported ? (
            <button type="button" onClick={start}
              className="self-start rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">Record</button>
          ) : (
            <span className="text-xs text-slate-500">Recording isn&apos;t supported on this device — you can upload a file instead.</span>
          )}
          {uploadControl}
        </div>
      )}

      {uploadError ? <span role="alert" className="text-xs text-red-600">{uploadError}</span> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/voice-recorder.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/form/VoiceRecorder.tsx tests/unit/voice-recorder.test.tsx
git commit -m "feat(form): VoiceRecorder accepts an uploaded audio file"
```

---

## Task 7: `PhotoCapture` — existing-media props

**Files:**
- Modify: `components/form/PhotoCapture.tsx`
- Modify: `tests/unit/photo-capture.test.tsx`

**Interfaces:**
- Consumes: `ExistingMedia` (Task 4).
- Produces: `PhotoCapture` gains optional props (all default to
  "none" and are ignored by the create flow):
  ```ts
  existingFront?: ExistingMedia | null;
  existingInner?: ExistingMedia[];
  existingQuotation?: ExistingMedia[];
  onRemoveExistingFront?: () => void;
  onRemoveExistingInner?: (storagePath: string) => void;
  onRemoveExistingQuotation?: (storagePath: string) => void;
  ```
  Existing thumbs render before pending-`File` thumbs. Inner/quotation caps count
  `existing + pending`. Removing an existing thumb calls the matching handler
  with its `storagePath` (front: no arg).

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/photo-capture.test.tsx`:

```tsx
import type { ExistingMedia } from "@/lib/validation";

const ex = (p: string): ExistingMedia => ({ storagePath: p, url: `https://x/${p}` });

describe("PhotoCapture — edit mode", () => {
  it("renders existing inner thumbs and removes one by storagePath", async () => {
    const onRemoveExistingInner = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={vi.fn()}
      existingInner={[ex("u/s/inner-0.jpg"), ex("u/s/inner-1.jpg")]}
      onRemoveExistingInner={onRemoveExistingInner} />);
    const removes = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removes[0]);
    expect(onRemoveExistingInner).toHaveBeenCalledWith("u/s/inner-0.jpg");
  });

  it("counts existing + pending against the inner cap", async () => {
    const existingInner = Array.from({ length: 9 }, (_, i) => ex(`u/s/inner-${i}.jpg`));
    const current = [new File([new Uint8Array(8)], "p.jpg", { type: "image/jpeg" })];
    const onInnerChange = vi.fn();
    render(<PhotoCapture front={null} inner={current} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={onInnerChange} onQuotationChange={vi.fn()}
      existingInner={existingInner} />);
    await userEvent.upload(screen.getByTestId("inner-gallery-input"),
      new File([new Uint8Array(8)], "x.jpg", { type: "image/jpeg" }));
    expect(onInnerChange).not.toHaveBeenCalled();
    expect(screen.getByText(/maximum of 10 inner photos/i)).toBeInTheDocument();
  });

  it("removes an existing front photo", async () => {
    const onRemoveExistingFront = vi.fn();
    render(<PhotoCapture front={null} inner={[]} quotation={[]}
      onFrontChange={vi.fn()} onInnerChange={vi.fn()} onQuotationChange={vi.fn()}
      existingFront={ex("u/s/front.jpg")} onRemoveExistingFront={onRemoveExistingFront} />);
    await userEvent.click(screen.getByRole("button", { name: /remove front/i }));
    expect(onRemoveExistingFront).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/photo-capture.test.tsx`
Expected: FAIL — new props unknown, no existing thumbs rendered.

- [ ] **Step 3: Implement**

In `components/form/PhotoCapture.tsx`:

1. Import the type: `import { MAX_INNER_PHOTOS, MAX_QUOTATION_PHOTOS } from "@/lib/constants";`
   stays; add `import type { ExistingMedia } from "@/lib/validation";`.

2. Add an `ExistingThumb` component next to `Thumb`:

```tsx
function ExistingThumb({ media, onRemove }: { media: ExistingMedia; onRemove: () => void }) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.url} alt={media.storagePath} className="h-full w-full object-cover" />
      <button type="button" onClick={onRemove} aria-label={`Remove ${media.storagePath}`}
        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">✕</button>
    </div>
  );
}
```

3. Extend `Props`:

```ts
interface Props {
  front: File | null;
  inner: File[];
  quotation: File[];
  onFrontChange: (f: File | null) => void;
  onInnerChange: (files: File[]) => void;
  onQuotationChange: (files: File[]) => void;
  existingFront?: ExistingMedia | null;
  existingInner?: ExistingMedia[];
  existingQuotation?: ExistingMedia[];
  onRemoveExistingFront?: () => void;
  onRemoveExistingInner?: (storagePath: string) => void;
  onRemoveExistingQuotation?: (storagePath: string) => void;
}
```

4. In the component signature destructure the new props with defaults:

```tsx
export function PhotoCapture({
  front, inner, quotation, onFrontChange, onInnerChange, onQuotationChange,
  existingFront = null, existingInner = [], existingQuotation = [],
  onRemoveExistingFront, onRemoveExistingInner, onRemoveExistingQuotation,
}: Props) {
```

5. In `addPhotos`, change the `room` calculation to accept an `existingCount`:

```tsx
  async function addPhotos(
    files: FileList | null, current: File[], existingCount: number, max: number,
    compress: (f: File) => Promise<File>, onChange: (files: File[]) => void, noun: string,
  ) {
    if (!files || busy.current) return;
    busy.current = true;
    try {
      const room = max - current.length - existingCount;
      if (room <= 0) { setNotice(`You can attach a maximum of ${max} ${noun}.`); return; }
      const picked = Array.from(files).slice(0, room);
      if (picked.length < files.length) setNotice(`Only ${room} more ${noun} could be added (max ${max}).`);
      else setNotice("");
      const compressed = await Promise.all(picked.map(compress));
      onChange([...current, ...compressed]);
    } finally {
      busy.current = false;
    }
  }

  const handleInner = (files: FileList | null) =>
    addPhotos(files, inner, existingInner.length, MAX_INNER_PHOTOS, compressImage, onInnerChange, "inner photos");
  const handleQuotation = (files: FileList | null) =>
    addPhotos(files, quotation, existingQuotation.length, MAX_QUOTATION_PHOTOS, compressDocument, onQuotationChange, "quotation photos");
```

6. In `handleFront`, when an existing front is present, replacing it should clear
   it:

```tsx
  async function handleFront(files: FileList | null) {
    if (!files?.[0]) return;
    onRemoveExistingFront?.();
    onFrontChange(await compressImage(files[0]));
  }
```

7. In the JSX, render existing thumbs before the pending ones:
   - Front block: before `{front ? <div…><Thumb …/></div> : null}` add
     ```tsx
     {existingFront ? (
       <div className="flex"><ExistingThumb media={existingFront} onRemove={() => onRemoveExistingFront?.()} /></div>
     ) : null}
     ```
   - Inner count label: `Inner photos ({existingInner.length + inner.length}/{MAX_INNER_PHOTOS})`.
     In the thumb wrap:
     ```tsx
     <div className="flex flex-wrap gap-2">
       {existingInner.map((m) => (
         <ExistingThumb key={m.storagePath} media={m} onRemove={() => onRemoveExistingInner?.(m.storagePath)} />
       ))}
       {inner.map((f, i) => (
         <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => onInnerChange(inner.filter((_, j) => j !== i))} />
       ))}
     </div>
     ```
   - Quotation block: mirror the inner change with `existingQuotation` /
     `onRemoveExistingQuotation` and label
     `Quotation photo — optional ({existingQuotation.length + quotation.length}/{MAX_QUOTATION_PHOTOS})`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/photo-capture.test.tsx`
Expected: PASS (existing create-mode tests + new edit-mode tests).

- [ ] **Step 5: Commit**

```bash
git add components/form/PhotoCapture.tsx tests/unit/photo-capture.test.tsx
git commit -m "feat(form): PhotoCapture shows and removes already-uploaded media"
```

---

## Task 8: `SurveyFields` extraction + `SurveyForm` refactor

**Files:**
- Create: `components/form/SurveyFields.tsx`
- Modify: `components/form/SurveyForm.tsx`
- Create: `tests/unit/survey-fields.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function SurveyFields(props: {
    v: SurveyFormValues;
    set: <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => void;
    errors: Record<string, string>;
    photos: React.ReactNode;   // slot rendered between GPS and the brand fields
    voice: React.ReactNode;    // slot rendered after the brand fields
  }): JSX.Element
  ```
- `SurveyForm`'s public API (`{ onSubmit, onDirty }`) and create behaviour are
  unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/survey-fields.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurveyFields } from "@/components/form/SurveyFields";
import { EMPTY_SURVEY } from "@/components/form/SurveyForm";

describe("SurveyFields", () => {
  it("renders every scalar field and both slots", () => {
    render(<SurveyFields v={EMPTY_SURVEY} set={vi.fn()} errors={{}}
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

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/survey-fields.test.tsx`
Expected: FAIL — `SurveyFields` does not exist.

- [ ] **Step 3: Implement `SurveyFields`**

Create `components/form/SurveyFields.tsx`:

```tsx
"use client";
import type React from "react";
import { TextField } from "./TextField";
import { SelectField } from "./SelectField";
import { BrandField } from "./BrandField";
import { GpsCapture } from "./GpsCapture";
import { MARKETS, SHOP_SIZES } from "@/lib/constants";
import type { SurveyFormValues } from "@/lib/validation";

export function SurveyFields({
  v, set, errors, photos, voice,
}: {
  v: SurveyFormValues;
  set: <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) => void;
  errors: Record<string, string>;
  photos: React.ReactNode;
  voice: React.ReactNode;
}) {
  return (
    <>
      <TextField label="Shop name" name="shop_name" value={v.shop_name}
        onChange={(x) => set("shop_name", x)} error={errors.shop_name} />
      <SelectField label="Market" name="market" value={v.market}
        onChange={(x) => set("market", x)} error={errors.market} options={MARKETS} placeholder="Choose a market" />
      <SelectField label="Shop size" name="shop_size" value={v.shop_size}
        onChange={(x) => set("shop_size", x)} error={errors.shop_size} options={SHOP_SIZES} placeholder="Select a size" />
      <TextField label="Customer name" name="customer_name" value={v.customer_name}
        onChange={(x) => set("customer_name", x)} error={errors.customer_name} />
      <TextField label="Customer number" name="customer_number" type="tel" inputMode="tel"
        value={v.customer_number} onChange={(x) => set("customer_number", x)} error={errors.customer_number} />

      <div data-region="gps" data-invalid={errors.gps ? "true" : undefined}>
        <GpsCapture value={v.gps} onChange={(f) => set("gps", f)} />
        {errors.gps ? <span role="alert" className="text-xs text-red-600">{errors.gps}</span> : null}
      </div>

      {photos}

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

      {voice}
    </>
  );
}
```

- [ ] **Step 4: Refactor `SurveyForm` to use it**

In `components/form/SurveyForm.tsx`, replace the JSX between `<h1>` and the fixed
submit bar with:

```tsx
      <h1 className="text-xl font-semibold">New shop survey</h1>

      <SurveyFields
        v={v}
        set={set}
        errors={errors}
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
```

Update imports: drop the now-unused `TextField`, `SelectField`, `BrandField`,
`GpsCapture`, `MARKETS`, `SHOP_SIZES` imports from `SurveyForm.tsx`; add
`import { SurveyFields } from "./SurveyFields";`. Keep `PhotoCapture`,
`VoiceRecorder`, `validateSurvey`, `SurveyFormValues`, `GpsFix`, `EMPTY`.

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run tests/unit/survey-fields.test.tsx tests/unit/survey-form-validation.test.tsx tests/unit/brand-field.test.tsx tests/unit/gps-capture.test.tsx`
Expected: PASS — `SurveyForm` validation behaviour unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/form/SurveyFields.tsx components/form/SurveyForm.tsx tests/unit/survey-fields.test.tsx
git commit -m "refactor(form): extract SurveyFields shared by create and edit"
```

---

## Task 9: `extFromAudioMime` + `uploadEditedMedia`

**Files:**
- Modify: `lib/upload.ts`
- Create: `tests/unit/upload-edited-media.test.ts`

**Interfaces:**
- Produces (in `lib/upload.ts`):
  ```ts
  export type MediaSlot = { keep: string } | { file: File };
  export type AudioSlot = { keep: string } | { file: Blob } | null;
  export function extFromAudioMime(type: string): string;
  export async function uploadEditedMedia(
    supabase: SupabaseClient, repUid: string, surveyId: string,
    media: { front: MediaSlot; inner: MediaSlot[]; quotation: MediaSlot[]; audio: AudioSlot },
  ): Promise<{ front: string; inner: string[]; quotation: string[]; audio: string | null }>;
  ```
  `keep` entries pass straight through. `file` entries upload to
  `${repUid}/${surveyId}/${kind}-${crypto.randomUUID()}.jpg` (photos) or
  `.../comment-${uuid}.${extFromAudioMime(type)}` (audio). Return arrays are in
  input order. Throws `Photo upload failed: …` / `Voice note upload failed: …` on
  a storage error.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/upload-edited-media.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { uploadEditedMedia, extFromAudioMime } from "@/lib/upload";

function fakeSupabase(uploadImpl: any) {
  const upload = vi.fn(uploadImpl);
  return { client: { storage: { from: () => ({ upload }) } } as any, upload };
}

describe("extFromAudioMime", () => {
  it("maps known types", () => {
    expect(extFromAudioMime("audio/mpeg")).toBe("mp3");
    expect(extFromAudioMime("audio/webm")).toBe("webm");
    expect(extFromAudioMime("audio/x-m4a")).toBe("m4a");
    expect(extFromAudioMime("audio/wut")).toBe("bin");
  });
});

describe("uploadEditedMedia", () => {
  it("keeps existing paths and uploads only new files", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    const { client, upload } = fakeSupabase(async () => ({ error: null }));
    const res = await uploadEditedMedia(client, "rep1", "surv1", {
      front: { keep: "rep1/surv1/front.jpg" },
      inner: [{ keep: "rep1/surv1/inner-0.jpg" }, { file: new File(["x"], "n.jpg", { type: "image/jpeg" }) }],
      quotation: [],
      audio: { file: new File(["a"], "n.mp3", { type: "audio/mpeg" }) },
    });
    expect(res.front).toBe("rep1/surv1/front.jpg");
    expect(res.inner).toEqual(["rep1/surv1/inner-0.jpg", "rep1/surv1/inner-uuid.jpg"]);
    expect(res.audio).toBe("rep1/surv1/comment-uuid.mp3");
    expect(upload).toHaveBeenCalledTimes(2); // 1 inner + 1 audio
    vi.unstubAllGlobals();
  });

  it("throws when a photo upload fails", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    const { client } = fakeSupabase(async () => ({ error: { message: "boom" } }));
    await expect(uploadEditedMedia(client, "rep1", "surv1", {
      front: { file: new File(["x"], "f.jpg", { type: "image/jpeg" }) },
      inner: [{ keep: "rep1/surv1/inner-0.jpg" }], quotation: [], audio: null,
    })).rejects.toThrow(/Photo upload failed/);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/upload-edited-media.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement**

Append to `lib/upload.ts`:

```ts
export type MediaSlot = { keep: string } | { file: File };
export type AudioSlot = { keep: string } | { file: Blob } | null;

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export function extFromAudioMime(type: string): string {
  return AUDIO_EXT[type] ?? "bin";
}

export async function uploadEditedMedia(
  supabase: SupabaseClient,
  repUid: string,
  surveyId: string,
  media: { front: MediaSlot; inner: MediaSlot[]; quotation: MediaSlot[]; audio: AudioSlot },
): Promise<{ front: string; inner: string[]; quotation: string[]; audio: string | null }> {
  const base = `${repUid}/${surveyId}`;

  async function putPhoto(slot: MediaSlot, kind: string): Promise<string> {
    if ("keep" in slot) return slot.keep;
    const path = `${base}/${kind}-${crypto.randomUUID()}.jpg`;
    const res = await supabase.storage.from(PHOTO_BUCKET).upload(path, slot.file, { contentType: "image/jpeg" });
    if (res.error) throw new Error(`Photo upload failed: ${res.error.message}`);
    return path;
  }

  const front = await putPhoto(media.front, "front");
  const inner: string[] = [];
  for (const s of media.inner) inner.push(await putPhoto(s, "inner"));
  const quotation: string[] = [];
  for (const s of media.quotation) quotation.push(await putPhoto(s, "quotation"));

  let audio: string | null = null;
  if (media.audio) {
    if ("keep" in media.audio) {
      audio = media.audio.keep;
    } else {
      const type = media.audio.file.type || "application/octet-stream";
      const path = `${base}/comment-${crypto.randomUUID()}.${extFromAudioMime(media.audio.file.type)}`;
      const res = await supabase.storage.from(AUDIO_BUCKET).upload(path, media.audio.file, { contentType: type });
      if (res.error) throw new Error(`Voice note upload failed: ${res.error.message}`);
      audio = path;
    }
  }

  return { front, inner, quotation, audio };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/upload-edited-media.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/upload.ts tests/unit/upload-edited-media.test.ts
git commit -m "feat(upload): uploadEditedMedia — keep or replace media on edit"
```

---

## Task 10: `updateSurvey` library function

**Files:**
- Modify: `lib/submitSurvey.ts`
- Create: `tests/unit/update-survey.test.ts`

**Interfaces:**
- Consumes: `uploadEditedMedia`, `MediaSlot`, `AudioSlot` (Task 9);
  `buildSurveyPayload` (`lib/validation.ts`).
- Produces:
  ```ts
  export interface SurveyEditInput {
    values: SurveyFormValues;
    media: { front: MediaSlot; inner: MediaSlot[]; quotation: MediaSlot[]; audio: AudioSlot };
    originalPhotoPaths: string[];
    originalAudioPath: string | null;
  }
  export async function updateSurvey(surveyId: string, input: SurveyEditInput): Promise<void>;
  ```
  Uploads new media, calls `rpc("update_survey", { payload })` with
  `payload.id === surveyId`, throws `Could not save your changes: …` on RPC
  error, then best-effort removes photo paths present originally but not in the
  new set and the old audio path if it changed.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/update-survey.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const uploadMock = vi.fn(async () => ({ error: null }));
const rpcMock = vi.fn();
const removeMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "rep-uid-1" } } }) },
    storage: { from: () => ({ upload: uploadMock, remove: removeMock }) },
    rpc: rpcMock,
  }),
}));

import { updateSurvey, type SurveyEditInput } from "@/lib/submitSurvey";
import type { SurveyFormValues } from "@/lib/validation";

const values: SurveyFormValues = {
  shop_name: "Al Madina", market: "Arambagh", shop_size: "Small",
  customer_name: "B", customer_number: "03001234567",
  gps: { lat: 24.86, lng: 67.02, accuracy: 10 },
  most_selling_fan: "GFC", rec_30w_1: "Tamoor", rec_30w_2: "", rec_50w_1: "Royal", rec_50w_2: "",
  most_selling_fan_other: "", rec_30w_1_other: "", rec_30w_2_other: "", rec_50w_1_other: "", rec_50w_2_other: "",
  frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
};

const baseInput: SurveyEditInput = {
  values,
  media: {
    front: { keep: "rep-uid-1/s1/front.jpg" },
    inner: [{ keep: "rep-uid-1/s1/inner-0.jpg" }],
    quotation: [],
    audio: null,
  },
  originalPhotoPaths: ["rep-uid-1/s1/front.jpg", "rep-uid-1/s1/inner-0.jpg", "rep-uid-1/s1/inner-1.jpg"],
  originalAudioPath: "rep-uid-1/s1/comment.webm",
};

describe("updateSurvey", () => {
  it("calls update_survey with the survey id and removes dropped media", async () => {
    rpcMock.mockResolvedValue({ data: "s1", error: null });
    removeMock.mockClear();
    await updateSurvey("s1", baseInput);
    const payload = rpcMock.mock.calls[0][1].payload;
    expect(payload.id).toBe("s1");
    expect(payload.photos).toHaveLength(2);
    // inner-1.jpg dropped, old audio dropped
    expect(removeMock).toHaveBeenCalledWith(["rep-uid-1/s1/inner-1.jpg"]);
    expect(removeMock).toHaveBeenCalledWith(["rep-uid-1/s1/comment.webm"]);
  });

  it("throws and skips cleanup on an RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "not editable" } });
    removeMock.mockClear();
    await expect(updateSurvey("s1", baseInput)).rejects.toThrow(/Could not save your changes/);
    expect(removeMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/update-survey.test.ts`
Expected: FAIL — `updateSurvey` not exported.

- [ ] **Step 3: Implement**

In `lib/submitSurvey.ts` update imports and append:

```ts
import { uploadSurveyMedia, uploadEditedMedia, type MediaSlot, type AudioSlot } from "@/lib/upload";
```

(keep the existing `uploadSurveyMedia` import target; merge the names.)

```ts
export interface SurveyEditInput {
  values: SurveyFormValues;
  media: { front: MediaSlot; inner: MediaSlot[]; quotation: MediaSlot[]; audio: AudioSlot };
  originalPhotoPaths: string[];
  originalAudioPath: string | null;
}

export async function updateSurvey(surveyId: string, input: SurveyEditInput): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const paths = await uploadEditedMedia(supabase, user.id, surveyId, input.media);
  const payload = buildSurveyPayload(surveyId, input.values, paths);

  const { error } = await supabase.rpc("update_survey", { payload });
  if (error) throw new Error(`Could not save your changes: ${error.message}`);

  const kept = new Set<string>([paths.front, ...paths.inner, ...paths.quotation]);
  const removedPhotos = input.originalPhotoPaths.filter((p) => !kept.has(p));
  if (removedPhotos.length) await supabase.storage.from("survey-photos").remove(removedPhotos);
  if (input.originalAudioPath && input.originalAudioPath !== paths.audio) {
    await supabase.storage.from("survey-audio").remove([input.originalAudioPath]);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/update-survey.test.ts tests/unit/submit-survey.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add lib/submitSurvey.ts lib/upload.ts tests/unit/update-survey.test.ts
git commit -m "feat(lib): updateSurvey — upload changed media, call update_survey RPC, sweep orphans"
```

---

## Task 11: `SurveyEditForm` component

**Files:**
- Create: `components/form/SurveyEditForm.tsx`
- Create: `tests/unit/survey-edit-form.test.tsx`

**Interfaces:**
- Consumes: `SurveyFields` (Task 8), `PhotoCapture` (Task 7), `VoiceRecorder`
  (Task 6), `validateSurveyEdit` (Task 5), `updateSurvey` / `SurveyEditInput`
  (Task 10), `ExistingMedia` (Task 4).
- Produces:
  ```ts
  export function SurveyEditForm(props: {
    survey: SurveyWithRelations;
    media: { photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[]; audioUrl: string | null };
    onSaved: () => void;   // navigation, injected by the page
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/survey-edit-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateSurveyMock = vi.fn(async () => {});
vi.mock("@/lib/submitSurvey", () => ({ updateSurvey: (...a: any[]) => updateSurveyMock(...a) }));
vi.mock("@/components/form/VoiceRecorder", () => ({ VoiceRecorder: () => <div data-testid="voice" /> }));

import { SurveyEditForm } from "@/components/form/SurveyEditForm";

const survey: any = {
  id: "s1", rep_id: "r1", shop_name: "Al Madina", market: "Arambagh", shop_size: "Medium",
  customer_name: "Bilal", customer_number: "03001234567",
  gps_lat: 24.86, gps_lng: 67.02, gps_accuracy: 10,
  most_selling_fan: "GFC", most_selling_fan_other: null,
  rec_30w_1: "Tamoor", rec_30w_1_other: null, rec_30w_2: null, rec_30w_2_other: null,
  rec_50w_1: "Royal", rec_50w_1_other: null, rec_50w_2: null, rec_50w_2_other: null,
  audio_path: null, created_at: "2026-09-08T10:00:00Z", updated_at: "2026-09-08T10:00:00Z", edited_at: null,
  rep: { id: "r1", username: "rep.one", full_name: "Rep One" }, photos: [],
};
const media = {
  photos: [
    { kind: "front" as const, url: "https://x/f", storagePath: "r1/s1/front.jpg" },
    { kind: "inner" as const, url: "https://x/i0", storagePath: "r1/s1/inner-0.jpg" },
  ],
  audioUrl: null,
};

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("SurveyEditForm", () => {
  it("prefills scalar fields from the survey", () => {
    render(<SurveyEditForm survey={survey} media={media} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/shop name/i)).toHaveValue("Al Madina");
    expect(screen.getByLabelText(/customer number/i)).toHaveValue("03001234567");
  });

  it("submits an update payload built from existing media plus edits", async () => {
    const onSaved = vi.fn();
    render(<SurveyEditForm survey={survey} media={media} onSaved={onSaved} />);
    await userEvent.clear(screen.getByLabelText(/shop name/i));
    await userEvent.type(screen.getByLabelText(/shop name/i), "Renamed Shop");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateSurveyMock).toHaveBeenCalledTimes(1);
    const [id, input] = updateSurveyMock.mock.calls[0];
    expect(id).toBe("s1");
    expect(input.values.shop_name).toBe("Renamed Shop");
    expect(input.media.front).toEqual({ keep: "r1/s1/front.jpg" });
    expect(input.media.inner).toEqual([{ keep: "r1/s1/inner-0.jpg" }]);
    expect(input.originalPhotoPaths.sort()).toEqual(["r1/s1/front.jpg", "r1/s1/inner-0.jpg"]);
    expect(onSaved).toHaveBeenCalled();
  });

  it("blocks save when the only inner photo is removed", async () => {
    render(<SurveyEditForm survey={survey} media={media} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /remove r1\/s1\/inner-0\.jpg/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateSurveyMock).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one inner photo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/survey-edit-form.test.tsx`
Expected: FAIL — `SurveyEditForm` does not exist.

- [ ] **Step 3: Implement**

Create `components/form/SurveyEditForm.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import { SurveyFields } from "./SurveyFields";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceRecorder } from "./VoiceRecorder";
import { validateSurveyEdit, type SurveyFormValues, type ExistingMedia } from "@/lib/validation";
import { updateSurvey, type SurveyEditInput } from "@/lib/submitSurvey";
import type { MediaSlot, AudioSlot } from "@/lib/upload";
import type { SurveyWithRelations } from "@/lib/types";

type EditMedia = {
  photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[];
  audioUrl: string | null;
};

function initialValues(s: SurveyWithRelations): SurveyFormValues {
  return {
    shop_name: s.shop_name,
    market: s.market,
    shop_size: s.shop_size,
    customer_name: s.customer_name,
    customer_number: s.customer_number,
    gps: { lat: s.gps_lat, lng: s.gps_lng, accuracy: s.gps_accuracy },
    most_selling_fan: s.most_selling_fan,
    rec_30w_1: s.rec_30w_1,
    rec_30w_2: s.rec_30w_2 ?? "",
    rec_50w_1: s.rec_50w_1,
    rec_50w_2: s.rec_50w_2 ?? "",
    most_selling_fan_other: s.most_selling_fan_other ?? "",
    rec_30w_1_other: s.rec_30w_1_other ?? "",
    rec_30w_2_other: s.rec_30w_2_other ?? "",
    rec_50w_1_other: s.rec_50w_1_other ?? "",
    rec_50w_2_other: s.rec_50w_2_other ?? "",
    frontPhoto: null, innerPhotos: [], quotationPhotos: [], audio: null,
  };
}

const asExisting = (m: { url: string; storagePath: string }): ExistingMedia =>
  ({ url: m.url, storagePath: m.storagePath });

export function SurveyEditForm({
  survey, media, onSaved,
}: {
  survey: SurveyWithRelations;
  media: EditMedia;
  onSaved: () => void;
}) {
  const [v, setV] = useState<SurveyFormValues>(() => initialValues(survey));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const originalPhotoPaths = useMemo(() => media.photos.map((p) => p.storagePath), [media]);
  const originalAudioPath = survey.audio_path;

  const [existingFront, setExistingFront] = useState<ExistingMedia | null>(
    media.photos.filter((p) => p.kind === "front").map(asExisting)[0] ?? null,
  );
  const [existingInner, setExistingInner] = useState<ExistingMedia[]>(
    media.photos.filter((p) => p.kind === "inner").map(asExisting),
  );
  const [existingQuotation, setExistingQuotation] = useState<ExistingMedia[]>(
    media.photos.filter((p) => p.kind === "quotation").map(asExisting),
  );
  const [audioKept, setAudioKept] = useState<boolean>(!!media.audioUrl);

  const set = <K extends keyof SurveyFormValues>(k: K, val: SurveyFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  function frontSlot(): MediaSlot {
    if (v.frontPhoto) return { file: v.frontPhoto };
    if (existingFront) return { keep: existingFront.storagePath };
    return { file: undefined as unknown as File }; // guarded by validation (front count 0)
  }
  function listSlots(existing: ExistingMedia[], added: File[]): MediaSlot[] {
    return [...existing.map((e) => ({ keep: e.storagePath })), ...added.map((f) => ({ file: f }))];
  }
  function audioSlot(): AudioSlot {
    if (v.audio) return { file: v.audio };
    if (audioKept && originalAudioPath) return { keep: originalAudioPath };
    return null;
  }

  const counts = {
    front: (existingFront ? 1 : 0) + (v.frontPhoto ? 1 : 0),
    inner: existingInner.length + v.innerPhotos.length,
    quotation: existingQuotation.length + v.quotationPhotos.length,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const errs = validateSurveyEdit(v, counts);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      document.querySelector('[aria-invalid="true"], [data-invalid="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const input: SurveyEditInput = {
      values: v,
      media: {
        front: frontSlot(),
        inner: listSlots(existingInner, v.innerPhotos),
        quotation: listSlots(existingQuotation, v.quotationPhotos),
        audio: audioSlot(),
      },
      originalPhotoPaths,
      originalAudioPath,
    };
    setBusy(true);
    try {
      await updateSurvey(survey.id, input);
      onSaved();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-28">
      <h1 className="text-xl font-semibold">Edit survey</h1>
      {formError ? <p role="alert" className="text-sm text-red-600">{formError}</p> : null}

      <SurveyFields
        v={v}
        set={set}
        errors={errors}
        photos={
          <div data-region="photos" data-invalid={errors.frontPhoto || errors.innerPhotos || errors.quotationPhotos ? "true" : undefined}>
            <PhotoCapture
              front={v.frontPhoto} inner={v.innerPhotos} quotation={v.quotationPhotos}
              onFrontChange={(f) => set("frontPhoto", f)}
              onInnerChange={(files) => set("innerPhotos", files)}
              onQuotationChange={(files) => set("quotationPhotos", files)}
              existingFront={existingFront}
              existingInner={existingInner}
              existingQuotation={existingQuotation}
              onRemoveExistingFront={() => setExistingFront(null)}
              onRemoveExistingInner={(sp) => setExistingInner((xs) => xs.filter((x) => x.storagePath !== sp))}
              onRemoveExistingQuotation={(sp) => setExistingQuotation((xs) => xs.filter((x) => x.storagePath !== sp))}
            />
            {errors.frontPhoto ? <span role="alert" className="text-xs text-red-600">{errors.frontPhoto}</span> : null}
            {errors.innerPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.innerPhotos}</span> : null}
            {errors.quotationPhotos ? <span role="alert" className="block text-xs text-red-600">{errors.quotationPhotos}</span> : null}
          </div>
        }
        voice={
          <div data-region="voice">
            <VoiceRecorder
              value={v.audio}
              onChange={(b) => set("audio", b)}
              existingUrl={audioKept ? media.audioUrl : null}
              onClearExisting={() => setAudioKept(false)}
            />
            {errors.audio ? <span role="alert" className="block text-xs text-red-600">{errors.audio}</span> : null}
          </div>
        }
      />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 text-base font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
```

Note on `frontSlot()`: the `{ file: undefined }` branch is never reached at
submit time because `validateSurveyEdit` returns a `frontPhoto` error whenever
`counts.front !== 1`, which aborts before `input` is built.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/survey-edit-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/form/SurveyEditForm.tsx tests/unit/survey-edit-form.test.tsx
git commit -m "feat(form): SurveyEditForm — prefilled edit with hybrid media state"
```

---

## Task 12: `getSignedMediaUrls` gains `storagePath`; `/survey/[id]/edit` route

**Files:**
- Modify: `app/survey/[id]/actions.ts`
- Create: `app/survey/[id]/edit/page.tsx`
- Create: `app/survey/[id]/edit/EditClient.tsx`
- Modify: `tests/unit/signed-urls.test.ts` (if it asserts the return shape — extend, don't break)

**Interfaces:**
- Consumes: `SurveyEditForm` (Task 11), `getSessionProfile` (`lib/auth.ts`).
- Produces: `getSignedMediaUrls(surveyId)` return type becomes
  ```ts
  { photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[]; audio: string | null }
  ```
  (additive — existing `photos[].kind` / `photos[].url` and `audio` unchanged).

- [ ] **Step 1: Check the existing signed-urls test**

Run: `npx vitest run tests/unit/signed-urls.test.ts`
Read it. If it asserts exact object equality on `photos[]` entries, update those
assertions to include `storagePath`. If it only checks `url` / `audio`, leave it.

- [ ] **Step 2: Extend `getSignedMediaUrls`**

In `app/survey/[id]/actions.ts`, change the `photos` mapping and the return type
so each photo carries its `storage_path`:

```ts
export async function getSignedMediaUrls(surveyId: string): Promise<{
  photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[];
  audio: string | null;
}> {
  // …unchanged up to `const photos = ordered` …
  const photos = ordered
    .map((p) => ({
      kind: p.kind as "front" | "inner" | "quotation",
      url: byPath.get(p.storage_path) as string,
      storagePath: p.storage_path as string,
    }))
    .filter((p) => !!p.url);
  // …unchanged audio handling and return…
}
```

- [ ] **Step 3: Create the edit route**

`SurveyEditForm` needs an `onSaved` callback that runs client-side navigation.
The page is a server component, so it delegates rendering to a tiny client
wrapper (`EditClient`) that owns the router.

Create `app/survey/[id]/edit/EditClient.tsx`:

```tsx
"use client";
import { useRouter } from "next/navigation";
import { SurveyEditForm } from "@/components/form/SurveyEditForm";
import { useToast } from "@/components/Toast";
import type { SurveyWithRelations } from "@/lib/types";

export function EditClient({ survey, media }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner" | "quotation"; url: string; storagePath: string }[]; audioUrl: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  return (
    <SurveyEditForm
      survey={survey}
      media={media}
      onSaved={() => { toast("Changes saved", "success"); router.push(`/survey/${survey.id}`); }}
    />
  );
}
```

Then create `app/survey/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
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

  return (
    <EditClient
      survey={data as SurveyWithRelations}
      media={{ photos: signed.photos, audioUrl: signed.audio }}
    />
  );
}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit`
Expected: passes.

Run: `npx vitest run tests/unit/signed-urls.test.ts tests/unit/survey-edit-form.test.tsx`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add app/survey/[id]/actions.ts app/survey/[id]/edit/page.tsx app/survey/[id]/edit/EditClient.tsx tests/unit/signed-urls.test.ts
git commit -m "feat(survey): /survey/[id]/edit route for the owning rep"
```

---

## Task 13: `SurveyDetail` — Edit link + "Edited" line; page passes `canEdit`

**Files:**
- Modify: `components/SurveyDetail.tsx`
- Modify: `app/survey/[id]/page.tsx`
- Modify: `tests/unit/survey-detail.test.tsx`

**Interfaces:**
- Consumes: `relativeDate` (`lib/format.ts`).
- Produces: `SurveyDetail` gains optional `canEdit?: boolean`. When true, renders
  a link `Edit survey` to `/survey/${survey.id}/edit`. When
  `survey.edited_at` is set, renders `Edited · {relativeDate(survey.edited_at)}`
  in the header.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/survey-detail.test.tsx`:

```tsx
it("shows an Edit link only when canEdit is true", () => {
  const { rerender } = render(<SurveyDetail survey={baseSurvey} media={{ photos: [], audio: null }} />);
  expect(screen.queryByRole("link", { name: /edit survey/i })).not.toBeInTheDocument();
  rerender(<SurveyDetail survey={baseSurvey} media={{ photos: [], audio: null }} canEdit />);
  expect(screen.getByRole("link", { name: /edit survey/i })).toHaveAttribute("href", "/survey/s1/edit");
});

it("shows an Edited marker when edited_at is set", () => {
  render(<SurveyDetail survey={{ ...baseSurvey, edited_at: "2026-09-08T12:00:00Z" }}
    media={{ photos: [], audio: null }} />);
  expect(screen.getByText(/edited/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/survey-detail.test.tsx`
Expected: FAIL — no Edit link / Edited marker.

- [ ] **Step 3: Implement**

In `components/SurveyDetail.tsx`:

- Add `import Link from "next/link";` and `relativeDate` to the `@/lib/format`
  import.
- Extend the signature: `canEdit`, plus `edited_at` is already on
  `SurveyWithRelations`.

```tsx
export function SurveyDetail({ survey, media, canDelete, canEdit }: {
  survey: SurveyWithRelations;
  media: { photos: { kind: "front" | "inner" | "quotation"; url: string }[]; audio: string | null };
  canDelete?: boolean;
  canEdit?: boolean;
}) {
```

- In the `<header>`, under the existing `<p>`:

```tsx
        {survey.edited_at ? (
          <p className="text-xs text-amber-700">Edited · {relativeDate(survey.edited_at)}</p>
        ) : null}
        {canEdit ? (
          <Link href={`/survey/${survey.id}/edit`}
            className="mt-2 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            Edit survey
          </Link>
        ) : null}
```

In `app/survey/[id]/page.tsx`, pass the prop:

```tsx
  return (
    <SurveyDetail
      survey={data as SurveyWithRelations}
      media={media}
      canDelete={profile.role === "admin"}
      canEdit={profile.id === data.rep_id}
    />
  );
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/survey-detail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SurveyDetail.tsx app/survey/[id]/page.tsx tests/unit/survey-detail.test.tsx
git commit -m "feat(survey): Edit link + Edited marker on the detail page"
```

---

## Task 14: Dashboard "Edited" tag + `getRepSurveys` carries `edited_at`

**Files:**
- Modify: `lib/queries.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `tests/unit` — add `tests/unit/rep-queries.test.ts`

**Interfaces:**
- Produces: `SurveyListItem` gains `edited_at: string | null`; `getRepSurveys`
  selects and maps it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/rep-queries.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { getRepSurveys } from "@/lib/queries";

function fakeSupabase(rows: any[]) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: async () => ({ data: rows, error: null }),
  };
  return { from: () => chain } as any;
}

describe("getRepSurveys", () => {
  it("maps edited_at through", async () => {
    const rows = [{
      id: "s1", shop_name: "A", market: "Malir", created_at: "2026-09-01T00:00:00Z",
      edited_at: "2026-09-02T00:00:00Z",
      survey_photos: [{ kind: "front", storage_path: "u/s1/front.jpg" }],
    }];
    const [item] = await getRepSurveys(fakeSupabase(rows), "rep1");
    expect(item.edited_at).toBe("2026-09-02T00:00:00Z");
    expect(item.front_thumb_path).toBe("u/s1/front.jpg");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/rep-queries.test.ts`
Expected: FAIL — `edited_at` missing from `SurveyListItem` / not mapped.

- [ ] **Step 3: Implement**

In `lib/queries.ts`:

```ts
export type SurveyListItem = {
  id: string;
  shop_name: string;
  market: Market;
  created_at: string;
  edited_at: string | null;
  front_thumb_path: string | null;
};
```

```ts
    .select("id, shop_name, market, created_at, edited_at, survey_photos!inner(storage_path, kind)")
```

```ts
  return (data ?? []).map((row: any) => ({
    id: row.id,
    shop_name: row.shop_name,
    market: row.market,
    created_at: row.created_at,
    edited_at: row.edited_at ?? null,
    front_thumb_path: row.survey_photos?.find((p: any) => p.kind === "front")?.storage_path ?? null,
  }));
```

In `app/dashboard/page.tsx`, inside the list `<span>` block, after the market /
date line:

```tsx
              <span className="block text-xs text-slate-500">
                {s.market} · {relativeDate(s.created_at)}
                {s.edited_at ? <span className="ml-1 text-amber-700">· Edited</span> : null}
              </span>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/rep-queries.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts app/dashboard/page.tsx tests/unit/rep-queries.test.ts
git commit -m "feat(dashboard): mark edited surveys in the rep's list"
```

---

## Task 15: Admin list badge + export column + export route media classification

**Files:**
- Modify: `lib/adminQueries.ts`
- Modify: `components/admin/SurveyTable.tsx`
- Modify: `lib/exportSurveys.ts`
- Modify: `app/admin/surveys/export/route.ts`
- Modify: `tests/unit/export-surveys.test.ts`

**Interfaces:**
- Produces: `AdminSurveyRow.edited_at: string | null`; `ExportRow.edited_at:
  string`; `EXPORT_COLUMNS` gains `"edited_at"` in second position (after
  `submitted_at`).

- [ ] **Step 1: Write the failing test**

In `tests/unit/export-surveys.test.ts`, extend the `survey` fixture with
`edited_at: "2026-09-06T09:00:00Z"` and add:

```ts
  it("includes edited_at (blank when never edited)", () => {
    const [edited] = toExportRows([survey], signed);
    expect(edited.edited_at).toBe("2026-09-06T09:00:00Z");
    const [fresh] = toExportRows([{ ...survey, edited_at: null }], signed);
    expect(fresh.edited_at).toBe("");
    expect(buildCsv([fresh]).split("\n")[0].split(",")[1]).toBe("edited_at");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/export-surveys.test.ts`
Expected: FAIL — `edited_at` not on `ExportRow`, not in header.

- [ ] **Step 3: Implement**

`lib/exportSurveys.ts`:

```ts
export interface ExportRow {
  submitted_at: string; edited_at: string; rep: string; shop_name: string; market: string; shop_size: string;
  // …rest unchanged…
}

export const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  "submitted_at", "edited_at", "rep", "shop_name", "market", "shop_size", "customer_name", "customer_number",
  "most_selling_fan", "rec_30w_1", "rec_30w_2", "rec_50w_1", "rec_50w_2",
  "gps_lat", "gps_lng", "gps_accuracy", "maps_link", "front_photo_url", "inner_photo_urls", "quotation_photo_urls", "voice_note_url",
];
```

In `toExportRows`, in the returned object add right after `submitted_at`:

```ts
      submitted_at: s.created_at,
      edited_at: s.edited_at ?? "",
```

`lib/adminQueries.ts`:

```ts
export interface AdminSurveyRow {
  id: string;
  created_at: string;
  edited_at: string | null;
  rep_username: string;
  // …rest unchanged…
}
```

In `getSurveysPage`, add `edited_at` to the select string and the mapped row:

```ts
    .select(
      "id, created_at, edited_at, shop_name, market, shop_size, most_selling_fan, most_selling_fan_other, profiles!surveys_rep_id_fkey(username), survey_photos(kind, storage_path, sort_order)",
      { count: "exact" },
    );
```
```ts
    id: r.id,
    created_at: r.created_at,
    edited_at: r.edited_at ?? null,
```

`components/admin/SurveyTable.tsx` — in the Shop cell:

```tsx
              <td>
                <Link href={`/survey/${r.id}`} className="block">{r.shop_name}</Link>
                {r.edited_at ? <span className="text-xs text-amber-700">Edited</span> : null}
              </td>
```

`app/admin/surveys/export/route.ts` — replace the extension-based split with a
source-based one so non-`.webm/.mp4` audio (mp3, m4a, …) signs against the right
bucket:

```ts
  const photoPaths = new Set<string>();
  const audioPaths = new Set<string>();
  (surveys ?? []).forEach((s: any) => {
    (s.survey_photos ?? []).forEach((p: any) => photoPaths.add(p.storage_path));
    if (s.audio_path) audioPaths.add(s.audio_path);
  });
  const signedByPath = new Map<string, string>();
  if (photoPaths.size) {
    const { data } = await db.storage.from("survey-photos").createSignedUrls([...photoPaths], SIGNED_URL_TTL);
    (data ?? []).forEach((d: any) => d.signedUrl && signedByPath.set(d.path, d.signedUrl));
  }
  for (const p of audioPaths) {
    const { data } = await db.storage.from("survey-audio").createSignedUrl(p, SIGNED_URL_TTL);
    if (data?.signedUrl) signedByPath.set(p, data.signedUrl);
  }
```

(Delete the old `const paths = new Set…`, `photoPaths`, `audioPaths` filter
block it replaces.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/export-surveys.test.ts tests/unit/admin-survey-query.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add lib/adminQueries.ts components/admin/SurveyTable.tsx lib/exportSurveys.ts app/admin/surveys/export/route.ts tests/unit/export-surveys.test.ts
git commit -m "feat(admin): surface edited_at in the survey list and exports"
```

---

## Task 16: e2e — rep edits a survey, admin sees the change

**Files:**
- Create: `tests/e2e/survey-edit.spec.ts`
- Create: `tests/e2e/fixtures/note.mp3`

**Interfaces:**
- Consumes: `login`, `mockGeolocation` from `tests/e2e/helpers.ts`; local stack +
  dev server (as the other e2e specs require).

- [ ] **Step 1: Create the audio fixture**

```bash
printf 'ID3\x03\x00\x00\x00\x00\x00\x00' > tests/e2e/fixtures/note.mp3
```

(A few bytes with an `ID3` header — Playwright infers `audio/mpeg` from the
`.mp3` extension, which the `survey-audio` bucket accepts.)

- [ ] **Step 2: Write the spec**

Create `tests/e2e/survey-edit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { login, mockGeolocation } from "./helpers";
import path from "node:path";

const FIXTURE = path.join(__dirname, "fixtures", "shop.jpg");
const AUDIO = path.join(__dirname, "fixtures", "note.mp3");

test("a rep edits a submitted survey and the admin sees the change", async ({ page, context }) => {
  await mockGeolocation(context);
  await login(page, "rep.two");
  await expect(page).toHaveURL(/\/dashboard$/);

  // Create a survey to edit.
  await page.getByRole("link", { name: /new survey/i }).click();
  await page.getByLabel("Shop name").fill("Editable Fans");
  await page.getByLabel("Market").selectOption("Waterpump");
  await page.getByLabel("Shop size").selectOption("Medium");
  await page.getByLabel("Customer name").fill("Test Customer");
  await page.getByLabel("Customer number").fill("03007654321");
  await page.getByRole("button", { name: /capture location/i }).click();
  await expect(page.getByText(/±\s*\d+\s*m/)).toBeVisible();
  await page.getByTestId("front-gallery-input").setInputFiles(FIXTURE);
  await page.getByTestId("inner-gallery-input").setInputFiles(FIXTURE);
  await page.getByLabel("Most selling fan").selectOption("GFC");
  await page.getByLabel("30W — Recommend 1").selectOption("Tamoor");
  await page.getByLabel("50W — Recommend 1").selectOption("Royal");
  await page.getByRole("button", { name: /submit survey/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Open it, go to edit.
  await page.getByText("Editable Fans").click();
  await page.getByRole("link", { name: /edit survey/i }).click();
  await expect(page).toHaveURL(/\/survey\/.+\/edit$/);

  // Change the name, replace the front photo, upload a voice note.
  await page.getByLabel("Shop name").fill("Edited Fans");
  await page.getByTestId("front-camera-input").setInputFiles(FIXTURE);
  await page.getByTestId("audio-upload-input").setInputFiles(AUDIO);
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page).toHaveURL(/\/survey\/[^/]+$/);
  await expect(page.getByText("Edited Fans")).toBeVisible();
  await expect(page.getByText(/edited/i)).toBeVisible();

  // Admin sees the new name and the Edited badge.
  await page.context().clearCookies();
  await login(page, "admin");
  await page.goto("/admin/surveys");
  await page.getByLabel("Search").fill("Edited Fans");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Edited Fans")).toBeVisible();
  await expect(page.getByText("Edited", { exact: true })).toBeVisible();
});
```

- [ ] **Step 3: Run**

Run: `npm run e2e -- survey-edit`
Expected: pass. (Needs `npm run db:start` + `npm run db:reset` + the dev server
per the repo's Playwright config. If the stack is unavailable, commit and note it
was not executed.)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/survey-edit.spec.ts tests/e2e/fixtures/note.mp3
git commit -m "test(e2e): rep edits a survey; admin sees the change + Edited badge"
```

---

## Task 17: Docs — `CLAUDE.md`, `docs/DEPLOYMENT.md`, unit-test count

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Update `CLAUDE.md` hard rules**

Replace the bullet:

> - **Reps cannot update or delete surveys, or their own submitted media.**
>   Enforced by RLS + storage policies, not just UI. Only the admin edits/deletes
>   surveys.

with:

> - **Reps can edit their own surveys** (all fields, no time limit) at
>   `/survey/[id]/edit` → the `update_survey` RPC, which mirrors `create_survey`'s
>   guards and stamps `surveys.edited_at`. Enforced at the DB layer:
>   `surveys_rep_update` / `survey_photos_rep_{update,delete}` RLS and storage
>   `survey_{photos,audio}_rep_{update,delete}` policies, all scoped to
>   `rep_id = auth.uid()` / the caller's own object prefix and all re-checking
>   `profiles.active`. Reps still **cannot** touch another rep's data, reassign
>   `rep_id`, or **delete a survey** — only the admin deletes.

- [ ] **Step 2: Update `CLAUDE.md` "Required survey fields"**

Append a sentence: *"An uploaded voice note (alternative to recording) must be an
audio MIME type ≤ `MAX_AUDIO_UPLOAD_MB` (25 MB); enforced client-side
(`validateAudioUpload`) and by the `survey-audio` bucket's `file_size_limit` /
`allowed_mime_types`."*

- [ ] **Step 3: Update `CLAUDE.md` Layout + Migrations**

- Layout `app/` line: add `survey/[id]/edit`.
- Layout `components/` line: note `form/SurveyFields` + `form/SurveyEditForm`.
- Layout `lib/` line: add `updateSurvey` (in `submitSurvey`), `uploadEditedMedia`.
- Development "Migrations" note: add
  *"`0006` (rep survey editing) is idempotent-guarded (`add column if not
  exists`, `drop policy if exists` before each `create policy`, `create or
  replace function`)."*

- [ ] **Step 4: Update `docs/DEPLOYMENT.md`**

- Add `0006_survey_edit.sql` to the migration list / count.
- Under the hosted-apply step, add: *"Apply `0006` via the Supabase SQL Editor
  (as with `0005`), or via `supabase db push` only after the `0005` migration
  ledger row has been inserted (Step 2b) — otherwise `db push` re-runs `0005`
  then `0006`."*
- Note the `survey-audio` bucket now has `file_size_limit` (25 MiB) and an
  `allowed_mime_types` allowlist.

- [ ] **Step 5: Refresh the unit-test count**

Run: `npm test`
Expected: all green. Note the printed total.

Run: `npx tsc --noEmit && npm run build`
Expected: both pass; only the two allowed `no-img-element` warnings.

In `CLAUDE.md` "Status", update `(81 unit tests)` to the new total.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/DEPLOYMENT.md
git commit -m "docs: rep survey editing — hard-rule, layout, migration, test-count updates"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §1.1 `edited_at` column | 1 |
| §1.2 `surveys_rep_update` RLS | 1; tested 2, 3 |
| §1.3 `survey_photos_rep_{update,delete}` RLS | 1; used by RPC in 1, tested 2 |
| §1.4 storage rep update/delete policies | 1; tested 3 |
| §1.5 `survey-audio` bucket limits | 1; tested 3 |
| §1.6 `update_survey` RPC | 1; tested 2 |
| §2 media model (existing vs new, uuid paths, orphan cleanup) | 9 (paths), 10 (cleanup), 11 (hybrid state) |
| §3 `/survey/[id]/edit` owner-only route | 12 |
| §3 `/survey/[id]` Edit link + Edited line | 13 |
| §3 dashboard Edited tag | 14 |
| §3 admin list Edited badge | 15 |
| §4.1 `SurveyFields` | 8 |
| §4.2 `SurveyForm` refactor | 8 |
| §4.3 `SurveyEditForm` | 11 |
| §4.4 `VoiceRecorder` upload + existing playback | 6 |
| §4.5 `PhotoCapture` existing-media props | 7 |
| §4.6 `validateAudioUpload` / `validateScalarFields` / `validateSurveyEdit` | 4, 5 |
| §4.7 constants | 4 |
| §4.8 `uploadEditedMedia` | 9 |
| §4.9 `updateSurvey` | 10 |
| §4.10 `edited_at` display surfaces (queries, adminQueries, detail, dashboard, admin, export) | 12, 13, 14, 15 |
| §6.1 unit tests | every task's test steps |
| §6.2 integration tests | 2, 3 |
| §6.3 e2e | 16 |
| §6.4 gates (`npm test` / `tsc` / `build`) | 17 (final), plus per-task `tsc` |
| §7 docs (`CLAUDE.md`, `DEPLOYMENT.md`) | 17 |
| §8 risks — export route extension-sniff bug | 15 (source-based classification) |

No gaps.

**2. Placeholder scan** — every code step carries real code. The one
deliberately-unreachable branch (`frontSlot()`'s `{ file: undefined }`) is
annotated with why it can't execute and what guards it. No "TBD", no "add error
handling", no "similar to Task N".

**3. Type consistency**

- `ExistingMedia = { storagePath: string; url: string }` — defined in
  `lib/validation.ts` (Task 4), consumed identically in Tasks 7, 11.
- `MediaSlot = { keep: string } | { file: File }`, `AudioSlot = { keep: string }
  | { file: Blob } | null` — defined `lib/upload.ts` (Task 9), consumed in Tasks
  10, 11 with the same shape.
- `getSignedMediaUrls` photo entries: `{ kind, url, storagePath }` — produced in
  Task 12, consumed by `SurveyEditForm`'s `media.photos` (Task 11) and
  `EditClient` (Task 12) with matching field names.
- `SurveyEditForm` prop `media` = `{ photos: […], audioUrl: string | null }` —
  Task 11 defines, Task 12 passes exactly that (`audioUrl: signed.audio`).
- `SurveyEditInput` — Task 10 defines `{ values, media, originalPhotoPaths,
  originalAudioPath }`; Task 11 builds exactly those keys.
- `edited_at` type: `string | null` on `Survey` (Task 1), `SurveyListItem` (14),
  `AdminSurveyRow` (15); `ExportRow.edited_at` is `string` (15, blank-not-null by
  design for the spreadsheet).
- `validateSurveyEdit(v, counts)` signature identical in Tasks 5 (def) and 11
  (call): `counts: { front; inner; quotation }`.
- `VoiceRecorder` props `{ value, onChange, existingUrl?, onClearExisting? }` —
  Task 6 defines, Task 11 passes all four; Task 8 (create form) passes the first
  two only (optionals absent) — consistent.

No mismatches found.

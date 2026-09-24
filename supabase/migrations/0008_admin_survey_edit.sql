-- Admin may edit any survey (all fields, any rep's media), not just delete it.
--
-- Re-runnable: every `create policy` is preceded by a matching `drop policy if
-- exists`, and the RPC is `create or replace`.
--
-- DB-layer note: `surveys_admin_update` (0002) and `survey_photos_admin_write`
-- (0002) already let an admin UPDATE any survey / survey_photos row — table
-- RLS was never the blocker. Two things were:
--   1. storage.objects had no admin INSERT/DELETE policy (only admin SELECT,
--      from 0003), so an admin session couldn't upload a replacement photo or
--      remove an orphaned one via the browser client.
--   2. update_survey's photo-reconciliation loop required every photo's
--      storage_path to sit under auth.uid()'s own prefix. That is correct for
--      a rep editing their own survey, but breaks the moment an admin saves a
--      survey while *keeping* the original rep's untouched photos (their
--      storage_path is under the rep's uid, not the admin's).

-- 1. Admin may INSERT/DELETE any object in the survey media buckets (SELECT
--    already granted by 0003's survey_{photos,audio}_admin_read).
drop policy if exists "survey_photos_admin_write" on storage.objects;
create policy "survey_photos_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'survey-photos' and public.is_admin());

drop policy if exists "survey_photos_admin_delete" on storage.objects;
create policy "survey_photos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'survey-photos' and public.is_admin());

drop policy if exists "survey_audio_admin_write" on storage.objects;
create policy "survey_audio_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'survey-audio' and public.is_admin());

drop policy if exists "survey_audio_admin_delete" on storage.objects;
create policy "survey_audio_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'survey-audio' and public.is_admin());

-- 2. update_survey: a photo's storage_path may sit under the CALLER's own uid
--    prefix (freshly uploaded by whoever is editing) OR under the survey's
--    existing rep_id prefix (an untouched original the editor kept as-is).
--    For a rep editing their own survey these are the same prefix, so rep
--    behaviour is unchanged; this only widens the check for an admin editor.
create or replace function public.update_survey(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (payload->>'id')::uuid;
  v_rep_id uuid;
  v_photo jsonb;
  v_front int := 0;
  v_inner int := 0;
  v_quotation int := 0;
begin
  if v_id is null then
    raise exception 'payload.id is required';
  end if;

  select rep_id into v_rep_id from public.surveys where id = v_id;
  if v_rep_id is null then
    raise exception 'survey not found or not editable';
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
    if (v_photo->>'storage_path') not like auth.uid()::text || '/%'
       and (v_photo->>'storage_path') not like v_rep_id::text || '/%' then
      raise exception 'photo storage_path must be under the caller or survey owner prefix';
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

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

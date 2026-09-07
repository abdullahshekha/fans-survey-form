insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', false),
       ('survey-audio', 'survey-audio', false)
on conflict (id) do nothing;

-- Reps may only INSERT and SELECT objects under their own uid prefix.
-- They must never UPDATE or DELETE submitted media (CLAUDE.md: "reps cannot
-- update or delete"). submitSurvey mints a fresh uuid per submit, so upload
-- paths never collide and no upsert/overwrite is needed.
create policy "survey_photos_rep_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_photos_rep_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_photos_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-photos' and public.is_admin());

create policy "survey_audio_rep_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_audio_rep_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_audio_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-audio' and public.is_admin());

insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', false),
       ('survey-audio', 'survey-audio', false)
on conflict (id) do nothing;

create policy "survey_photos_rep_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_photos_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-photos' and public.is_admin());

create policy "survey_audio_rep_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'survey-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "survey_audio_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'survey-audio' and public.is_admin());

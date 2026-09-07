create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  );
$$;

alter table public.profiles enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_photos enable row level security;

-- profiles
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- surveys
create policy surveys_rep_insert on public.surveys
  for insert with check (rep_id = auth.uid());
create policy surveys_select_own_or_admin on public.surveys
  for select using (rep_id = auth.uid() or public.is_admin());
create policy surveys_admin_update on public.surveys
  for update using (public.is_admin()) with check (public.is_admin());
create policy surveys_admin_delete on public.surveys
  for delete using (public.is_admin());

-- survey_photos
create policy survey_photos_rep_insert on public.survey_photos
  for insert with check (exists (
    select 1 from public.surveys s where s.id = survey_id and s.rep_id = auth.uid()));
create policy survey_photos_select on public.survey_photos
  for select using (exists (
    select 1 from public.surveys s
    where s.id = survey_id and (s.rep_id = auth.uid() or public.is_admin())));
create policy survey_photos_admin_write on public.survey_photos
  for all using (public.is_admin()) with check (public.is_admin());

-- Local development seed ONLY. Not used in production.
-- Creates auth users + profiles for manual testing and integration tests.
do $$
declare
  admin_id uuid := '10000000-0000-0000-0000-000000000001';
  rep1_id  uuid := '10000000-0000-0000-0000-000000000002';
  rep2_id  uuid := '10000000-0000-0000-0000-000000000003';
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    (admin_id, 'authenticated', 'authenticated', 'admin@survey.local',  crypt('test-pass-123', gen_salt('bf')), now(), now(), now()),
    (rep1_id,  'authenticated', 'authenticated', 'rep.one@survey.local', crypt('test-pass-123', gen_salt('bf')), now(), now(), now()),
    (rep2_id,  'authenticated', 'authenticated', 'rep.two@survey.local', crypt('test-pass-123', gen_salt('bf')), now(), now(), now())
  on conflict (id) do nothing;

  insert into public.profiles (id, username, full_name, role, active)
  values
    (admin_id, 'admin',   'Site Admin',  'admin', true),
    (rep1_id,  'rep.one', 'Rep One',     'rep',   true),
    (rep2_id,  'rep.two', 'Rep Two',     'rep',   true)
  on conflict (id) do nothing;
end $$;

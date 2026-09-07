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

-- Two sample surveys owned by rep.one, for manual testing of /survey/[id].
-- Storage objects are NOT seeded; the detail gallery renders broken images in
-- local dev, which is acceptable here.
insert into public.surveys (
  id, rep_id, shop_name, market, shop_size, customer_name, customer_number,
  gps_lat, gps_lng, gps_accuracy, most_selling_fan,
  rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, audio_path
) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Arambagh Electronics', 'Arambagh', 'Medium', 'Bilal Ahmed', '03001234567',
   24.85620, 67.02310, 12.5, 'GFC',
   'GFC', 'Tamoor', 'Royal', 'SK', null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   'Malir Fan House', 'Malir', 'Large', 'Sana Khalid', '03009876543',
   24.89340, 67.19080, 8.0, 'Pak Fans',
   'Pak Fans', null, 'Tamoor', null, '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/comment.webm')
on conflict (id) do nothing;

insert into public.survey_photos (survey_id, kind, storage_path, sort_order) values
  ('20000000-0000-0000-0000-000000000001', 'front', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000001/front.jpg', 0),
  ('20000000-0000-0000-0000-000000000001', 'inner', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000001/inner-0.jpg', 0),
  ('20000000-0000-0000-0000-000000000001', 'inner', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000001/inner-1.jpg', 1),
  ('20000000-0000-0000-0000-000000000002', 'front', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/front.jpg', 0),
  ('20000000-0000-0000-0000-000000000002', 'inner', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/inner-0.jpg', 0),
  ('20000000-0000-0000-0000-000000000002', 'inner', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/inner-1.jpg', 1);

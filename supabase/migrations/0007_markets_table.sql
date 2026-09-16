-- Markets become admin-managed (add/rename) instead of a hardcoded CHECK list.
-- Idempotent: safe to re-run against an already-migrated database.

create table if not exists public.markets (
  name text primary key,
  color text not null,
  sort_order int not null,
  created_at timestamptz not null default now()
);

insert into public.markets (name, color, sort_order) values
  ('Arambagh', '#e6194b', 1),
  ('MA Jinnah', '#3cb44b', 2),
  ('Waterpump', '#e6a700', 3),
  ('Bohrapir', '#4363d8', 4),
  ('Johar Mor', '#f58231', 5),
  ('UP', '#911eb4', 6),
  ('Liaquatabad', '#009fb0', 7),
  ('Shah Faisal Colony', '#f032e6', 8),
  ('Orangi Town', '#7a9a01', 9),
  ('Baldia Town', '#c26f9d', 10),
  ('Malir', '#469990', 11),
  ('Landhi/Korangi', '#9a6324', 12)
on conflict (name) do nothing;

alter table public.surveys drop constraint if exists surveys_market_check;

alter table public.surveys drop constraint if exists surveys_market_fkey;
alter table public.surveys
  add constraint surveys_market_fkey
  foreign key (market) references public.markets(name)
  on update cascade
  on delete restrict;

alter table public.markets enable row level security;

drop policy if exists markets_select on public.markets;
create policy markets_select on public.markets
  for select to authenticated
  using (true);

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_write on public.markets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

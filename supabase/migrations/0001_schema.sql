create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  role text not null default 'rep' check (role in ('admin', 'rep')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.profiles(id),
  shop_name text not null,
  market text not null check (market in (
    'Arambagh', 'MA Jinnah', 'Waterpump', 'Bohrapir', 'Johar Mor', 'UP',
    'Liaquatabad', 'Shah Faisal Colony', 'Orangi Town', 'Baldia Town', 'Malir', 'Landhi/Korangi')),
  shop_size text not null check (shop_size in ('Small', 'Medium', 'Large')),
  customer_name text not null,
  customer_number text not null check (customer_number ~ '^03[0-9]{9}$'),
  gps_lat double precision not null,
  gps_lng double precision not null,
  gps_accuracy double precision,
  most_selling_fan text not null check (most_selling_fan in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_30w_1 text not null check (rec_30w_1 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_30w_2 text check (rec_30w_2 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_50w_1 text not null check (rec_50w_1 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  rec_50w_2 text check (rec_50w_2 in (
    'Tamoor', 'Khurshid', 'SK', 'GFC', 'Royal', 'Pak Fans', 'Lahore Fans')),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index surveys_rep_id_idx on public.surveys (rep_id);
create index surveys_market_idx on public.surveys (market);
create index surveys_created_at_idx on public.surveys (created_at desc);

create table public.survey_photos (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  kind text not null check (kind in ('front', 'inner')),
  storage_path text not null,
  sort_order int not null default 0
);
create index survey_photos_survey_id_idx on public.survey_photos (survey_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger surveys_set_updated_at
  before update on public.surveys
  for each row execute function public.set_updated_at();

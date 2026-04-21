create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  icao24 text not null,
  callsign text,
  origin_country text,
  longitude double precision,
  latitude double precision,
  baro_altitude double precision,
  velocity double precision,
  true_track double precision,
  vertical_rate double precision,
  on_ground boolean not null default false,
  last_contact timestamptz,
  observed_at timestamptz not null default timezone('utc', now()),
  region_key text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists flights_region_key_idx on public.flights (region_key);
create index if not exists flights_observed_at_idx on public.flights (observed_at desc);
create index if not exists flights_icao24_idx on public.flights (icao24);

drop trigger if exists flights_set_updated_at on public.flights;
create trigger flights_set_updated_at
before update on public.flights
for each row
execute function public.set_updated_at();

create table if not exists public.user_regions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  region_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, region_key)
);

create index if not exists user_regions_user_id_idx on public.user_regions (user_id);

create table if not exists public.worker_status (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null unique,
  status text not null,
  last_heartbeat_at timestamptz not null default timezone('utc', now()),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists worker_status_set_updated_at on public.worker_status;
create trigger worker_status_set_updated_at
before update on public.worker_status
for each row
execute function public.set_updated_at();

alter table public.flights enable row level security;
alter table public.user_regions enable row level security;
alter table public.worker_status enable row level security;

drop policy if exists "Public read access for flights" on public.flights;
create policy "Public read access for flights"
on public.flights
for select
to anon, authenticated
using (true);

drop policy if exists "Owners can read user regions" on public.user_regions;
create policy "Owners can read user regions"
on public.user_regions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Owners can insert user regions" on public.user_regions;
create policy "Owners can insert user regions"
on public.user_regions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Owners can delete user regions" on public.user_regions;
create policy "Owners can delete user regions"
on public.user_regions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Owners can update user regions" on public.user_regions;
create policy "Owners can update user regions"
on public.user_regions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Read worker status" on public.worker_status;
create policy "Read worker status"
on public.worker_status
for select
to anon, authenticated
using (true);

alter table public.flights
  add constraint flights_icao24_key unique (icao24);

create index if not exists flights_region_observed_at_idx
on public.flights (region_key, observed_at desc);

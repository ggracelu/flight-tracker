# Supabase Phase 2

## Overview

Phase 2 uses Supabase as the real system foundation for:

- database storage for shared flight telemetry
- authentication for user accounts
- row-level security for personalization
- realtime broadcasting from the `flights` table in later phases

## Schema

### `flights`

Shared telemetry table intended for future OpenSky ingestion.

Important fields:

- `icao24` unique aircraft identifier from OpenSky
- `callsign` flight callsign when available
- `origin_country` aircraft origin country
- `longitude` and `latitude` current position
- `baro_altitude`, `velocity`, `true_track`, `vertical_rate`, `on_ground`
- `last_contact` source timestamp from OpenSky
- `observed_at` ingestion observation timestamp
- `region_key` normalized region bucket for frontend filtering
- `updated_at` mutation timestamp

### `user_regions`

Stores per-user personalization choices. Each record links one authenticated user to one selected region.

Constraints:

- `user_id` references `auth.users`
- `unique(user_id, region_key)` prevents duplicate region selections

### `worker_status`

Reserved for the future Railway worker heartbeat and simple operational metadata.

## Auth Model

- Supabase Auth provides email/password sign up and sign in.
- The frontend uses the public anon key.
- `user_regions` is protected by RLS so each user can only manage their own rows.
- `flights` is readable to both anonymous and authenticated users because telemetry is intended to be public.
- `worker_status` is readable for inspection but not writable by frontend clients.

## Realtime Role

The `flights` table is the shared public feed. In later phases:

- the worker will upsert telemetry into `flights`
- Supabase Realtime can stream changes to the frontend
- users will filter the shared stream by region and preferences

Phase 2 does not yet enable the ingestion worker or live map UI.

## Manual Supabase Setup

1. Create a new Supabase project.
2. In Supabase SQL Editor, run the migration from `supabase/migrations/20260421_phase2_foundation.sql`.
3. In `Authentication -> Providers`, keep email/password enabled.
4. In `Authentication -> URL Configuration`, add your local development URL, typically `http://localhost:3000`.
5. In `Project Settings -> API`, copy:
   - `Project URL`
   - `anon public` key
6. Put those values into `apps/web/.env.local`.
7. For later phases, keep the service role key private for `apps/worker` only.
8. In `Database -> Replication`, ensure the `flights` table is available for Realtime when you reach Phase 3.

## Phase 3 Preview

Phase 3 will implement:

- `apps/worker` telemetry polling from OpenSky
- upsert logic into `flights`
- `worker_status` heartbeat writes
- frontend subscription to shared telemetry updates
- richer flight list or regional live views before the map phase

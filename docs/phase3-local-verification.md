# Phase 3 Local Verification

This phase verifies the real assignment loop:

`OpenSky -> apps/worker -> Supabase -> Realtime -> apps/web`

## Prerequisites

1. Run the SQL migrations in order:
   - `supabase/migrations/20260421_phase2_foundation.sql`
   - `supabase/migrations/20260421_phase3_live_loop.sql`
2. In Supabase Auth settings, keep email/password enabled.
3. In Supabase URL configuration, allow `http://localhost:3000`.
4. In Supabase Database Replication, ensure Realtime is enabled for:
   - `public.flights`
   - `public.worker_status`

## Required Environment Variables

### `apps/web/.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### `apps/worker/.env`

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENSKY_USERNAME=
OPENSKY_PASSWORD=
POLL_INTERVAL_MS=30000
```

## Commands

```bash
npm install
npm run dev:web
npm run dev:worker
```

## What To Check

1. Start the worker and confirm console output shows polling cycles.
2. In Supabase Table Editor or SQL, confirm `public.worker_status` has a row for `opensky-worker`.
3. Confirm `public.flights` begins receiving upserted rows keyed by `icao24`.
4. Open `http://localhost:3000` and verify the dashboard loads flights.
5. Leave the page open while the worker runs and verify:
   - the heartbeat timestamp updates
   - flight list values change without a browser refresh
6. Sign in, add one or more saved regions, and confirm the dashboard narrows to those `region_key` values.
7. Add `Global` as a saved region and confirm the full shared feed returns while signed in.

## Manual Supabase Steps Still Required

- Run the migrations manually in your Supabase project.
- Enable Realtime replication for `flights` and `worker_status`.
- Create at least one user account through the app if you want to test personalized filtering.

## Expected Worker Behavior

- Polls OpenSky on `POLL_INTERVAL_MS`
- Handles missing coordinates and fields safely
- Falls back to `global` when region classification is unavailable
- Writes heartbeat metadata after successful cycles and error cycles

## Known Local Caveats

- OpenSky may rate-limit anonymous traffic.
- If the worker cannot reach OpenSky, the dashboard can still render existing Supabase rows.
- Phase 3 does not add the map layer yet; verification is list/dashboard based only.

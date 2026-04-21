# Flight Tracker

Flight Tracker is being rebuilt as a phased monorepo for monitoring live aircraft positions worldwide. Phase 3 adds the first real live-data loop while preserving the existing assignment architecture and the restored Phase 2 foundation.

## Architecture

The project architecture for this assignment is fixed:

`OpenSky Network -> Background Worker (Railway later) -> Supabase (database + Realtime + Auth) -> Next.js frontend (Vercel later)`

Phase 3 currently includes:

- `apps/web` with Supabase auth, saved regions, live flight queries, and Realtime subscriptions
- `apps/worker` as the Node/TypeScript OpenSky polling service
- `supabase/migrations` with schema, RLS, and the narrow Phase 3 upsert/index migration
- `docs/` with setup and local verification notes

## Phase 3 Deliverables

- OpenSky polling worker in `apps/worker`
- normalized flight upserts into `public.flights`
- worker heartbeat writes into `public.worker_status`
- live dashboard list view in `apps/web`
- Supabase Realtime subscriptions for `flights` and `worker_status`
- basic region filtering using `user_regions`
- updated scripts and verification documentation

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the frontend environment file:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

3. Copy the worker environment file:

```bash
cp apps/worker/.env.example apps/worker/.env
```

4. Fill in:

- `apps/web/.env.local`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `apps/worker/.env`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENSKY_USERNAME` optional
  - `OPENSKY_PASSWORD` optional
  - `POLL_INTERVAL_MS`

5. Run the frontend:

```bash
npm run dev:web
```

6. In another terminal, run the worker:

```bash
npm run dev:worker
```

7. Open `http://localhost:3000`.

## Supabase Setup

Manual setup is documented in [docs/supabase-phase2.md](/Users/gracelu/Desktop/flight-tracker/docs/supabase-phase2.md).
Phase 3 local verification is documented in [docs/phase3-local-verification.md](/Users/gracelu/Desktop/flight-tracker/docs/phase3-local-verification.md).

## Required Environment Variables

- Frontend:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Worker:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `POLL_INTERVAL_MS`
  - `OPENSKY_USERNAME` optional
  - `OPENSKY_PASSWORD` optional

## Known Phase 3 Limitations

- Region assignment is a simple fixed coordinate bucket: `global`, `north-america`, `europe`, `asia`.
- OpenSky polling is subject to upstream rate limits, especially without credentials.
- The UI is a live list/dashboard only; the map layer is intentionally deferred.
- Deployment to Railway and Vercel is intentionally deferred.

## What Phase 4 Will Add

- live flight map rendering in the frontend
- richer spatial presentation on top of the Phase 3 realtime feed
- possible stale-flight cleanup and additional dashboard polish if needed

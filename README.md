# Flight Tracker

Flight Tracker is being built as a phased monorepo for monitoring live aircraft positions worldwide. Phase 2 establishes the Supabase database, auth, and realtime-ready foundation while preserving the existing `apps/web` Next.js scaffold.

## Architecture

The project architecture for this assignment is fixed:

`OpenSky Network -> Background Worker (Railway later) -> Supabase (database + Realtime + Auth) -> Next.js frontend (Vercel later)`

Phase 2 intentionally stops at the Supabase and frontend foundation:

- `apps/web` contains the Next.js user interface and Supabase auth/personalization scaffold.
- `apps/worker` is a placeholder for the future Railway worker that will ingest OpenSky data.
- `supabase/migrations` contains the SQL schema and Row Level Security policies.
- `docs/` contains setup notes and phase-specific documentation.

## Phase 2 Deliverables

- Supabase schema for `flights`, `user_regions`, and `worker_status`
- RLS policies aligned to public telemetry plus user-owned personalization
- Next.js auth scaffold for sign up, sign in, sign out
- "My Regions" personalization UI backed by Supabase
- Environment templates and manual setup documentation

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the frontend environment file:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.

4. Run the app:

```bash
npm run dev:web
```

5. Open `http://localhost:3000`.

## Supabase Setup

Manual setup is documented in [docs/supabase-phase2.md](/Users/gracelu/Desktop/flight-tracker/docs/supabase-phase2.md).

## What Comes In Phase 3

Phase 3 will add the actual background worker and telemetry ingestion pipeline:

- OpenSky polling from `apps/worker`
- writes into `flights`
- worker heartbeat updates in `worker_status`
- frontend live flight feed usage from Supabase Realtime
- initial region-based telemetry views before the full live map phase

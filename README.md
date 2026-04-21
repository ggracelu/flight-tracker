# Flight Tracker

Flight Tracker is a live flight browsing app built on the required multi-service course architecture. It keeps the existing worker-to-database-to-web pipeline intact while presenting the data as a polished user-facing product.

`OpenSky Network -> Background Worker (Railway) -> Supabase (database + Realtime + Auth) -> Next.js frontend (Vercel)`

The browser does not fetch OpenSky directly. `apps/worker` is still the only service that polls upstream data.

## Product Summary

- browse a public worldwide live flight feed without signing in
- explore the same flights on a synced map and flight list
- sign in to save preferred regions for a personalized view
- keep live updates flowing through Supabase Realtime
- deploy the worker on Railway and the frontend on Vercel without changing the architecture

## Repo Structure

- `apps/web`: Next.js frontend for Vercel
- `apps/worker`: Node/TypeScript polling worker for Railway
- `supabase/migrations`: schema and Phase 2/3 database changes
- `docs/`: setup, verification, deployment, and submission notes

## Current UX

- immediate signed-out browsing on the public global feed
- saved regions that personalize the map and flight list for signed-in users
- a selected-flight details panel tied to both the map and the list
- friendlier empty, loading, degraded-realtime, and auth messages
- clean presentation with operational details kept in the background

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Copy local environment files.

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
```

3. Fill in the frontend env vars in `apps/web/.env.local`.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Fill in the worker env vars in `apps/worker/.env`.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLL_INTERVAL_MS`
- `OPENSKY_CLIENT_ID` optional
- `OPENSKY_CLIENT_SECRET` optional

5. Start the frontend.

```bash
npm run dev:web
```

6. Start the worker in a second terminal.

```bash
npm run dev:worker
```

7. Open `http://localhost:3000`.

## Verification Commands

```bash
npm run build:web
npm run build:worker
npm run lint:web
```

## Deployment Docs

- Supabase setup: [docs/supabase-phase2.md](/Users/gracelu/Desktop/flight-tracker/docs/supabase-phase2.md)
- Phase 3 local verification: [docs/phase3-local-verification.md](/Users/gracelu/Desktop/flight-tracker/docs/phase3-local-verification.md)
- Deployment guide: [docs/phase4-deployment.md](/Users/gracelu/Desktop/flight-tracker/docs/phase4-deployment.md)
- Submission checklist: [docs/submission-checklist.md](/Users/gracelu/Desktop/flight-tracker/docs/submission-checklist.md)

## Deployment Summary

### `apps/worker` on Railway

- root directory: `apps/worker`
- build command: `npm install && npm run build`
- start command: `npm run start`
- required env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `POLL_INTERVAL_MS`
- optional env vars:
  - `OPENSKY_CLIENT_ID`
  - `OPENSKY_CLIENT_SECRET`

### `apps/web` on Vercel

- project root: `apps/web`
- framework preset: `Next.js`
- build command: `npm run build`
- install command: `npm install`
- required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Known Limits

- Region assignment still uses the simple Phase 3 bounding-box strategy.
- OpenSky availability and rate limits remain upstream constraints.
- Realtime degradation falls back to the latest fetched data; it does not add polling in the browser.

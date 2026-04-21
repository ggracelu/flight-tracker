# Phase 4 Deployment

This phase keeps the same data path:

`OpenSky Network -> Railway worker -> Supabase -> Vercel frontend`

## Railway: `apps/worker`

### Service Settings

- root directory: `apps/worker`
- install command: `npm install`
- build command: `npm install && npm run build`
- start command: `npm run start`

### Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLL_INTERVAL_MS`

### Optional Environment Variables

- `OPENSKY_USERNAME`
- `OPENSKY_PASSWORD`

### Railway Verification

1. Deploy the service.
2. Open Railway logs and confirm lines like `cycle=... fetched=... upserted=...`.
3. Confirm `public.worker_status` shows a recent `last_heartbeat_at`.
4. Confirm rows in `public.flights` continue to update.

## Vercel: `apps/web`

### Project Settings

- root directory: `apps/web`
- framework preset: `Next.js`
- install command: `npm install`
- build command: `npm run build`

### Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Vercel Verification

1. Deploy the app.
2. Load the site while signed out and confirm the public global map/list view renders.
3. Sign up or sign in.
4. Save one or more regions.
5. Confirm the map and list both narrow to the same filtered dataset.
6. Confirm a new worker cycle updates the dashboard without a page refresh.

## Production Auth and Supabase Checks

- Supabase Auth email/password must be enabled.
- The deployed frontend must point at the same Supabase project the Railway worker writes into.
- Realtime must be enabled for the tables the dashboard reads: `public.flights` and `public.worker_status`.
- Test with a brand-new user account to confirm classmates can sign up and use the app.

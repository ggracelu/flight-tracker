# Worker

`apps/worker` is the polling service for the assignment architecture:

`OpenSky Network -> apps/worker -> Supabase`

## Responsibilities

- poll OpenSky state vectors on an interval
- normalize aircraft state into the shared `public.flights` schema
- assign a simple Phase 3 `region_key`
- upsert flights with the Supabase service role key
- update `public.worker_status` heartbeat and status details

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLL_INTERVAL_MS`

## Optional Environment Variables

- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`

OpenSky OAuth2 client credentials are optional for local development, but unauthenticated requests are more likely to hit rate limits. When provided, the worker fetches and caches a bearer token, then uses that token for `https://opensky-network.org/api/states/all`.

## Local Run

```bash
cp apps/worker/.env.example apps/worker/.env
npm install
npm run dev:worker
```

The worker loads `apps/worker/.env` automatically via `dotenv`.

## Data Written

### `public.flights`

Upserts by `icao24` with the latest normalized telemetry:

- callsign
- origin country
- latitude / longitude
- altitude / velocity / track / vertical rate
- on-ground flag
- `last_contact`
- `observed_at`
- `region_key`

### `public.worker_status`

Maintains a single row for `worker_name = 'opensky-worker'` containing:

- `status`
- `last_heartbeat_at`
- JSON `details` including cycle counts, fetched rows, upsert counts, poll interval, and last error

## Region Strategy

The worker assigns one of:

- `global`
- `north-america`
- `europe`
- `asia`

If coordinates are missing or outside the simple bounding boxes, the fallback is `global`.

## Railway Deployment

- root directory: `apps/worker`
- install command: `npm install`
- build command: `npm install && npm run build`
- start command: `npm run start`

### Required Railway Env Vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POLL_INTERVAL_MS`

### Optional Railway Env Vars

- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`

### Railway Notes

- The worker logs one line per cycle plus clear failure lines, which is enough for Railway log inspection.
- Use a persistent service, not a one-off job.
- After deploy, confirm that `public.worker_status.last_heartbeat_at` is updating and `public.flights` is receiving fresh rows.

## Known Limitations

- The project still uses a coarse coordinate bucket strategy, not a true aviation geo model.
- OpenSky response volume and availability depend on upstream rate limits.
- Stale flight pruning is still intentionally out of scope for this phase.

# Worker

`apps/worker` is the Phase 3 polling service for the assignment architecture:

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

- `OPENSKY_USERNAME`
- `OPENSKY_PASSWORD`

OpenSky credentials are optional for local development, but unauthenticated requests are more likely to hit rate limits.

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

## Phase 3 Region Strategy

The worker assigns one of:

- `global`
- `north-america`
- `europe`
- `asia`

If coordinates are missing or outside the simple Phase 3 bounding boxes, the fallback is `global`.

## Known Limitations

- Phase 3 uses a coarse coordinate bucket strategy, not a true aviation geo model.
- OpenSky response volume and availability depend on upstream rate limits.
- Stale flights are not pruned yet; Phase 4 can add richer retention behavior if needed.

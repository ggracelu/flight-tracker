# Worker Placeholder

`apps/worker` is intentionally a placeholder in Phase 2.

Its future responsibility is fixed:

`OpenSky Network -> apps/worker -> Supabase`

Phase 3 will add:

- OpenSky polling
- normalization into the `flights` schema
- worker heartbeat writes into `worker_status`
- deployment-oriented configuration for Railway

Do not move this work into the frontend.

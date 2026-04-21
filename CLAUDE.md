# CLAUDE.md

## Project
**Flight Tracker** — a multi-service realtime system for monitoring live aircraft positions worldwide using OpenSky Network data, with region-based personalization and a frontend that updates without page refresh.

This project follows the Week 4 course architecture exactly:

**OpenSky Network -> Background Worker (Railway) -> Supabase (Postgres + Auth + Realtime) -> Next.js Frontend (Vercel)**

The browser must **not** call OpenSky directly.  
The frontend must read from Supabase and subscribe to Realtime updates.  
The worker is the only service that fetches external flight data.

---

## Assignment Goal
Build and deploy a working multi-service system where:

- a background worker polls a live or frequently updated data source,
- the worker writes normalized records into Supabase,
- the frontend reads from Supabase,
- the frontend updates live through Supabase Realtime,
- users can sign in and personalize what they see,
- the deployed app works for classmates end to end.

---

## Core Product Idea
Users can:

- view live flights,
- view the same live flights on a realtime map,
- filter flights by region,
- save preferred regions,
- watch flight data update in realtime,
- compare the synced list and map views in one dashboard.

Primary data source:
- **OpenSky Network** for aircraft state vectors

Primary personalization concept:
- **user-selected regions** (for example: global, north-america, europe, asia)

---

## Repository Structure
Expected monorepo structure:

```text
.
├── CLAUDE.md
├── README.md
├── package.json
├── docs/
├── supabase/
│   └── migrations/
├── apps/
│   ├── web/        # Next.js frontend -> Vercel
│   └── worker/     # Node/TypeScript worker -> Railway
```

## Current Phase 4 Expectations

- keep the ingestion path exactly as `OpenSky -> worker -> Supabase -> Next.js`
- do not move OpenSky fetching into the browser
- keep `public.flights` and `public.worker_status` as the operational data source for the UI
- logged-out users see the public global feed
- logged-in users see results filtered by `user_regions`
- map and list must stay aligned to the same filtered dataset
- deployment docs must cover Railway and Vercel setup clearly

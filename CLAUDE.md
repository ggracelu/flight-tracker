# CLAUDE.md

## Project Intent

This repository is the rebuilt Assignment 4 codebase for Design, Build, Ship. The work should continue from the restored Phase 1 baseline, not from any lost later-phase implementation.

## Locked Architecture

Follow this architecture exactly:

`OpenSky Network -> Background Worker (Railway later) -> Supabase (database + Realtime + Auth) -> Next.js frontend (Vercel later)`

Constraints:

- Do not move ingestion into the frontend.
- Do not replace Supabase with local JSON persistence.
- Do not build a Python CLI.
- Do not drift into deployment work during Phase 2.

## Phase 2 Scope

Phase 2 is limited to:

- Supabase schema and migrations
- auth and RLS foundation
- realtime-ready `flights` table foundation
- frontend auth scaffold
- frontend personalization scaffold using `user_regions`
- documentation and environment setup

## Not In Scope Yet

- OpenSky polling worker implementation
- live aircraft map
- deployment to Railway or Vercel
- production hardening beyond the assignment baseline

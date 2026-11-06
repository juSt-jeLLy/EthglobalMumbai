# Plan B PostgreSQL infrastructure

This directory contains the production PostgreSQL schema for Plan B's durable
social-trading records: Caller Cards, Signal Passports, revisions, source
checks, follower plans, Flash order events, and caller subscriptions.

It is deliberately **not connected** to the current hackathon runtime. The
running Node backend continues to use `backend/data/*.json`, so local demos
remain self-contained and require no database service.

## Local production-schema rehearsal

```bash
cd infra/postgres
cp .env.example .env
# Set a real local password in .env.
docker compose up -d
docker compose ps
```

PostgreSQL listens on `localhost:54329` by default. The first startup applies
`migrations/001_plan_b.sql`; Docker's named volume preserves the database
between restarts.

To start again from an empty local database, remove only this named volume:

```bash
docker compose down -v
```

## Production connection contract

Provision a managed PostgreSQL database (for example Neon, Supabase, or an
equivalent pooled PostgreSQL service) and configure the backend deployment with
these values:

```env
DATABASE_URL=postgresql://...
DATABASE_SSL=true
DATABASE_POOL_MAX=10
```

`DATABASE_URL` is intentionally unused by the current runtime. Connecting it
requires a separate, reviewed repository migration from the JSON stores in
`backend/plans.js`, `backend/signals.js`, and `backend/radar.js`; it must not be
enabled merely by setting an environment variable. This prevents a half-migrated
demo from writing some records to JSON and some to Postgres.

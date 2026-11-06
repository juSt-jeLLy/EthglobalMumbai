# Plan B PostgreSQL infrastructure

This directory contains the production PostgreSQL schema for Plan B's durable
social-trading records: Caller Cards, Signal Passports, revisions, source
checks, follower plans, Flash order events, and caller subscriptions.

The backend uses PostgreSQL as its only runtime store. It will fail fast if
`DATABASE_URL` is absent or unreachable; it never silently falls back to
`backend/data/*.json`.

## Local production-schema rehearsal

```bash
cd infra/postgres
cp .env.example .env
# Set a real local password in .env.
docker compose up -d
docker compose ps
```

PostgreSQL listens on `localhost:54329` by default. The first startup applies
the schema automatically when the backend starts; Docker's named volume
preserves the database between restarts.

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

On startup the backend applies ordered migrations and loads durable plans,
signals, subscriptions, and World verification records from `runtime_documents`.
The normalized tables in `001_plan_b.sql` are retained for future analytical
projections; the document store preserves the current API records (including
Passport evidence) without lossy field mapping.

For local development, copy `backend/.env.example` to `backend/.env`, set the
same password used by `infra/postgres/.env`, and use:

```env
DATABASE_URL=postgresql://plan_b:YOUR_PASSWORD@localhost:54329/plan_b
DATABASE_SSL=false
```

Then run `npm run db:migrate` from `backend/`, or simply start the backend.
To preserve an existing local JSON demo before switching, run the explicit
one-time `npm run db:import-json` command while the backend is stopped.

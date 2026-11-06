-- Plan B production data model (PostgreSQL 16+).
-- This schema is intentionally not wired into backend/*.js yet. The hackathon
-- runtime continues to use backend/data/*.json until a deliberate migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE callers (
  signer_address TEXT PRIMARY KEY,
  display_handle TEXT,
  world_human_verified_at TIMESTAMPTZ,
  world_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  creator_signer TEXT NOT NULL REFERENCES callers(signer_address),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  source_tweet_id TEXT,
  source_url TEXT,
  author_handle TEXT,
  text_hash TEXT,
  asset_chain TEXT NOT NULL,
  asset_address TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  draft JSONB NOT NULL,
  strategy JSONB NOT NULL,
  recommendation JSONB,
  integrity JSONB,
  passport JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_tweet_id),
  UNIQUE (asset_chain, asset_address, text_hash)
);

CREATE INDEX signals_creator_created_idx ON signals (creator_signer, created_at DESC);
CREATE INDEX signals_asset_created_idx ON signals (asset_chain, asset_address, created_at DESC);
CREATE INDEX signals_verified_created_idx ON signals (created_at DESC) WHERE verified;

CREATE TABLE signal_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  signer_address TEXT NOT NULL REFERENCES callers(signer_address),
  reason TEXT,
  draft JSONB NOT NULL,
  strategy JSONB NOT NULL,
  recommendation JSONB,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (signal_id, revision)
);

CREATE TABLE signal_source_checks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  availability_status TEXT NOT NULL,
  verification_status TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX signal_source_checks_recent_idx ON signal_source_checks (signal_id, checked_at DESC);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_order_id TEXT NOT NULL UNIQUE,
  flash_bracket_order_id TEXT UNIQUE,
  signal_id TEXT REFERENCES signals(id) ON DELETE SET NULL,
  funder_address TEXT NOT NULL,
  source_tweet_id TEXT,
  author_handle TEXT,
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  strategy_type TEXT,
  strategy_version INTEGER NOT NULL DEFAULT 1 CHECK (strategy_version > 0),
  strategy JSONB,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  state TEXT NOT NULL,
  flash_status TEXT NOT NULL,
  result TEXT,
  transaction_id TEXT,
  receipt JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX plans_funder_created_idx ON plans (funder_address, created_at DESC);
CREATE INDEX plans_signal_created_idx ON plans (signal_id, created_at DESC);
CREATE INDEX plans_author_state_idx ON plans (author_handle, state);

CREATE TABLE plan_order_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flash_order_id TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  event_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX plan_order_events_order_idx ON plan_order_events (flash_order_id, received_at DESC);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_address TEXT NOT NULL,
  creator_signer TEXT NOT NULL REFERENCES callers(signer_address),
  latest_signal_id TEXT REFERENCES signals(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funder_address, creator_signer)
);

CREATE INDEX subscriptions_funder_enabled_idx ON subscriptions (funder_address) WHERE enabled;

CREATE TABLE world_human_verifications (
  action TEXT NOT NULL,
  nullifier NUMERIC(78, 0) NOT NULL,
  signer_address TEXT NOT NULL REFERENCES callers(signer_address),
  environment TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (action, nullifier),
  UNIQUE (action, signer_address)
);

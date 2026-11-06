-- Runtime persistence. Existing application records are retained as JSONB so
-- the current API shape can evolve without losing Passport evidence, while the
-- normalized tables in 001 remain available for analytical projections.
CREATE TABLE runtime_documents (
  collection TEXT NOT NULL CHECK (collection IN ('plans', 'signals', 'subscriptions', 'world_human')),
  id TEXT NOT NULL,
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX runtime_documents_collection_updated_idx ON runtime_documents (collection, updated_at DESC);

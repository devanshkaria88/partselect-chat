-- Runs once, first, on a fresh Postgres volume (docker-entrypoint-initdb.d).
-- Extensions must exist before any table/index that depends on them, so this
-- file is numbered ahead of the table DDL.

CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector: semantic search (1024-dim Voyage embeddings)
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram fuzzy/keyword search over names + symptoms

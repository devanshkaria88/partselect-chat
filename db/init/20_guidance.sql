-- Enrichment + session/transaction + observability tables. Enrichment tables
-- (compatibility / install_guides / symptoms) are populated by the offline scrape
-- (Phase 2) and loaded by the seed; they start empty and the app degrades to honest
-- "not available yet" fallbacks until populated.

-- ── UC2: part ↔ model compatibility (scraped model lists) ────────────────────────
CREATE TABLE IF NOT EXISTS compatibility (
    part_ps_number TEXT NOT NULL REFERENCES products(ps_number) ON DELETE CASCADE,
    model_number   TEXT NOT NULL,
    brand          TEXT,
    appliance      TEXT,
    source         TEXT NOT NULL DEFAULT 'scraped',   -- scraped | fixture
    PRIMARY KEY (part_ps_number, model_number)
);
CREATE INDEX IF NOT EXISTS idx_compat_model ON compatibility (model_number);

-- ── UC1: installation guides (scraped steps + how-to video) ──────────────────────
CREATE TABLE IF NOT EXISTS install_guides (
    ps_number      TEXT PRIMARY KEY REFERENCES products(ps_number) ON DELETE CASCADE,
    available      BOOLEAN NOT NULL DEFAULT false,     -- false ⇒ tool returns honest 'unavailable'
    difficulty     TEXT,                                -- Easy | Really Easy | Moderate | ...
    time_estimate  TEXT,                                -- "15 - 30 mins"
    video_url      TEXT,                                -- youtube how-to
    tools          JSONB NOT NULL DEFAULT '[]',         -- ["Nut driver", "Putty knife"]
    steps          JSONB NOT NULL DEFAULT '[]',         -- [{"n":1,"text":"..."}] (agent may compose from stories)
    repair_stories JSONB NOT NULL DEFAULT '[]',         -- raw scraped customer install narratives (grounding)
    source_url     TEXT
);

-- ── UC3: symptom → cause → recommended part (scraped repair-help) ─────────────────
CREATE TABLE IF NOT EXISTS symptoms (
    id                SERIAL PRIMARY KEY,
    appliance         TEXT NOT NULL,                   -- Refrigerator | Dishwasher
    brand             TEXT,
    symptom           TEXT NOT NULL,                   -- "Ice maker not making ice"
    likely_causes     JSONB NOT NULL DEFAULT '[]',     -- [{"rank":1,"cause":"...","recommended_ps":"PS..."}]
    repair_steps      JSONB NOT NULL DEFAULT '[]',     -- [{"n":1,"text":"..."}]
    recommended_parts JSONB NOT NULL DEFAULT '[]',     -- ["PS...","PS..."] (FK-validated at seed)
    source_url        TEXT
);
CREATE INDEX IF NOT EXISTS idx_symptoms_appl_brand ON symptoms (appliance, brand);
CREATE INDEX IF NOT EXISTS idx_symptoms_text_trgm  ON symptoms USING gin (symptom gin_trgm_ops);

-- ── pgvector semantic search (embeddings precomputed offline, loaded by seed) ─────
CREATE TABLE IF NOT EXISTS product_embeddings (
    ps_number TEXT PRIMARY KEY REFERENCES products(ps_number) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL                    -- Voyage voyage-3.5
);
CREATE INDEX IF NOT EXISTS idx_prod_emb_hnsw
    ON product_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS symptom_embeddings (
    symptom_id INTEGER PRIMARY KEY REFERENCES symptoms(id) ON DELETE CASCADE,
    embedding  vector(1024) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_symp_emb_hnsw
    ON symptom_embeddings USING hnsw (embedding vector_cosine_ops);

-- ── Session memory (resolves "this part" / "my model", holds the cart) ───────────
CREATE TABLE IF NOT EXISTS sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_number TEXT,
    last_part_ps TEXT,
    cart         JSONB NOT NULL DEFAULT '[]',          -- [{"ps_number","name","qty","unit_price"}]
    context      JSONB NOT NULL DEFAULT '{}',
    messages     JSONB NOT NULL DEFAULT '[]',          -- compact turn history for the agent
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Simulated orders (seeded fixtures; swap for a real API later) ─────────────────
CREATE TABLE IF NOT EXISTS orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    status       TEXT NOT NULL DEFAULT 'processing',   -- processing | shipped | delivered
    eta          TEXT,
    total        NUMERIC(10,2),
    items        JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Observability: one row per agent turn (the "transparent loop" made literal) ──
CREATE TABLE IF NOT EXISTS agent_traces (
    turn_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       TEXT,
    user_message     TEXT,
    model_tier       TEXT,                              -- haiku | sonnet | opus
    scope_verdict    TEXT,                              -- in_scope | out_of_scope | ambiguous->...
    steps_json       JSONB NOT NULL DEFAULT '[]',       -- [{tool,args,result_summary,ms}]
    ttft_ms          INTEGER,
    total_ms         INTEGER,
    input_tokens     INTEGER,
    output_tokens    INTEGER,
    cache_read_tokens INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_traces_session ON agent_traces (session_id, created_at DESC);

-- One seeded fixture order so "where is my order PS-100200?" demos out of the box.
INSERT INTO orders (order_number, status, eta, total, items)
VALUES ('PS-100200', 'shipped', 'Arrives Jun 8', 47.40,
        '[{"ps_number":"PS11752778","name":"Refrigerator Door Shelf Bin","qty":1}]'::jsonb)
ON CONFLICT (order_number) DO NOTHING;

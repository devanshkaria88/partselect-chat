#!/usr/bin/env python3
"""Offline embedding step. Writes 1024-dim vectors into the SQLite snapshot so the
deterministic seed can load them into Postgres/pgvector — no API call at boot.

Backends (one `EmbeddingService` interface; swap freely):
  • voyage  — Voyage `voyage-3.5` @ 1024-dim (production path; needs VOYAGE_API_KEY).
              pip install voyageai
  • local   — fastembed `BAAI/bge-large-en-v1.5` @ 1024-dim (no key, fully offline).
              pip install fastembed

Backend is auto-selected: voyage if VOYAGE_API_KEY is set (and --local not passed),
else local. Both yield 1024-dim vectors that fit the `vector(1024)` schema.

Embeds:
  • products  -> product_embeddings(ps_number, embedding)   [name+brand+part_type+description]
  • symptoms  -> symptoms.embedding                          [symptom + appliance + recommended part names]

Usage:  python scripts/embed.py            # auto backend
        python scripts/embed.py --local    # force local model
"""
import argparse
import json
import os
import sqlite3
import time

SQLITE_PATH = os.environ.get("SQLITE_PATH", "scraper/data/partselect.db")
DIM = 1024
# Voyage free tier (no payment method) = 3 RPM / 10K TPM. Stay under both: small
# batches and a paced gap between requests. Override via env for a paid key.
VOYAGE_BATCH = int(os.environ.get("VOYAGE_BATCH", 24))
VOYAGE_GAP_S = float(os.environ.get("VOYAGE_GAP_S", 21))


# ── backends ──────────────────────────────────────────────────────────────────────
class VoyageBackend:
    name = "voyage:voyage-3.5"

    def __init__(self):
        import voyageai

        self.voyageai = voyageai
        self.client = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])

    def _embed_batch(self, batch, input_type, attempt=0):
        try:
            r = self.client.embed(batch, model="voyage-3.5", input_type=input_type, output_dimension=DIM)
            return r.embeddings
        except self.voyageai.error.RateLimitError:
            if attempt >= 6:
                raise
            wait = 30 * (attempt + 1)
            print(f"  rate-limited; backing off {wait}s…", flush=True)
            time.sleep(wait)
            return self._embed_batch(batch, input_type, attempt + 1)

    def embed(self, texts, input_type):
        out = []
        n = max(1, (len(texts) + VOYAGE_BATCH - 1) // VOYAGE_BATCH)
        for idx, i in enumerate(range(0, len(texts), VOYAGE_BATCH)):
            out.extend(self._embed_batch(texts[i : i + VOYAGE_BATCH], input_type))
            print(f"  voyage batch {idx + 1}/{n}", flush=True)
            if i + VOYAGE_BATCH < len(texts):
                time.sleep(VOYAGE_GAP_S)
        return out


class LocalBackend:
    name = "local:BAAI/bge-large-en-v1.5"

    def __init__(self):
        from fastembed import TextEmbedding

        self.model = TextEmbedding("BAAI/bge-large-en-v1.5")

    def embed(self, texts, input_type):
        return [v.tolist() for v in self.model.embed(texts)]


def pick_backend(force_local):
    if not force_local and os.environ.get("VOYAGE_API_KEY"):
        return VoyageBackend()
    return LocalBackend()


# ── text builders ─────────────────────────────────────────────────────────────────
def product_text(r):
    desc = (r["description"] or "")[:320]
    parts = [r["name"], r["brand"], r["part_type"], desc]
    return " — ".join(p for p in parts if p)


def symptom_text(con, r):
    names = []
    for ps in json.loads(r["recommended_parts"] or "[]")[:8]:
        row = con.execute("SELECT name FROM products WHERE ps_number=?", (ps,)).fetchone()
        if row and row[0]:
            names.append(row[0])
    bits = [r["symptom"], r["appliance"]] + names
    return " — ".join(b for b in bits if b)


def has_table(con, name):
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def column_exists(con, table, col):
    return any(c[1] == col for c in con.execute(f"PRAGMA table_info({table})"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="force the local model backend")
    args = ap.parse_args()

    con = sqlite3.connect(SQLITE_PATH)
    con.row_factory = sqlite3.Row
    con.execute(
        "CREATE TABLE IF NOT EXISTS product_embeddings (ps_number TEXT PRIMARY KEY, embedding TEXT)"
    )

    backend = pick_backend(args.local)
    print(f"embedding backend: {backend.name}  ({DIM}-dim)")

    # products
    prods = con.execute(
        "SELECT ps_number, name, brand, part_type, description FROM products"
    ).fetchall()
    texts = [product_text(r) for r in prods]
    vecs = backend.embed(texts, input_type="document")
    for r, v in zip(prods, vecs):
        con.execute(
            "INSERT OR REPLACE INTO product_embeddings (ps_number, embedding) VALUES (?, ?)",
            (r["ps_number"], json.dumps([round(float(x), 6) for x in v])),
        )
    con.commit()
    print(f"  products embedded: {len(prods)}")

    # symptoms (if the enrich step produced them)
    n_sym = 0
    if has_table(con, "symptoms"):
        if not column_exists(con, "symptoms", "embedding"):
            con.execute("ALTER TABLE symptoms ADD COLUMN embedding TEXT")
        syms = con.execute(
            "SELECT symptom_key, symptom, appliance, recommended_parts FROM symptoms"
        ).fetchall()
        if syms:
            stexts = [symptom_text(con, r) for r in syms]
            svecs = backend.embed(stexts, input_type="document")
            for r, v in zip(syms, svecs):
                con.execute(
                    "UPDATE symptoms SET embedding=? WHERE symptom_key=?",
                    (json.dumps([round(float(x), 6) for x in v]), r["symptom_key"]),
                )
            con.commit()
            n_sym = len(syms)
    print(f"  symptoms embedded: {n_sym}")
    con.close()


if __name__ == "__main__":
    main()

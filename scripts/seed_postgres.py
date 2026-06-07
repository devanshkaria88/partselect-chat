#!/usr/bin/env python3
"""Seed Postgres from the scraped SQLite snapshot. Deterministic, offline, idempotent.

This is the ONLY thing that runs on `make up` (via the compose `seed` service). It does
NOT scrape and does NOT call any paid API — it just loads the committed snapshot
(scraper/data/partselect.db) into Postgres, so a clean clone boots reproducibly.

What it loads:
  • products            — always (225 rows): type coercion, part_type cleanup,
                          Ice Maker/Freezer → Refrigerator remap, in_scope flags.
  • compatibility       — if the offline scrape populated it (Phase 2).
  • install_guides      — if present.
  • symptoms            — if present (+ FK-validated recommended_parts).
  • product/symptom embeddings — if `make embed` precomputed them.

Schema is owned by db/init/*.sql; this script only INSERT/UPSERTs (enrichment tables
are fully derived, so they are truncated + reloaded for idempotency).

Deps:  pip install psycopg2-binary
Env :  SQLITE_PATH   (default: scraper/data/partselect.db)
       DATABASE_URL  (default: postgresql://partselect:partselect@localhost:5432/partselect)
"""
import json
import os
import sqlite3
import sys

import psycopg2
from psycopg2.extras import execute_values

SQLITE_PATH = os.environ.get("SQLITE_PATH", "scraper/data/partselect.db")
PG_DSN = os.environ.get(
    "DATABASE_URL", "postgresql://partselect:partselect@localhost:5432/partselect"
)

PRODUCT_COLS = [
    "ps_number", "mpn", "name", "brand", "price", "currency", "availability",
    "rating", "review_count", "description", "image", "appliance", "part_type",
    "in_scope", "url", "scraped_at",
]

# Cross-listed appliances that are out of the Refrigerator/Dishwasher scope.
OUT_OF_SCOPE_APPLIANCES = {"Washer", "Dryer", "Range"}
# Fridge sub-systems surfaced under their own breadcrumb — fold into Refrigerator.
REMAP_TO_REFRIGERATOR = {"Ice Maker", "Freezer"}


# ── value coercion ───────────────────────────────────────────────────────────────
def nz(v):
    return v if v not in ("", None) else None


def as_float(v):
    v = nz(v)
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def as_int(v):
    v = nz(v)
    try:
        return int(float(v)) if v is not None else None
    except (TypeError, ValueError):
        return None


def clean_part_type(v):
    """Drop numeric-code breadcrumb extractions (e.g. '4396881100') — they aren't real types."""
    v = nz(v)
    if v is None or v.isdigit():
        return None
    return v


def sqlite_has_table(con, name):
    row = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone()
    return row is not None


def vec_literal(embedding):
    """Turn a JSON array / list into a pgvector text literal: '[0.1,0.2,...]'."""
    arr = embedding if isinstance(embedding, list) else json.loads(embedding)
    return "[" + ",".join(repr(float(x)) for x in arr) + "]"


# ── loaders ──────────────────────────────────────────────────────────────────────
def load_products(src, cur):
    rows = src.execute("SELECT * FROM products").fetchall()
    records = []
    for r in rows:
        d = dict(r)
        appliance = nz(d["appliance"])
        in_scope = appliance not in OUT_OF_SCOPE_APPLIANCES
        if appliance in REMAP_TO_REFRIGERATOR:
            appliance = "Refrigerator"
        records.append((
            nz(d["ps_number"]), nz(d["mpn"]), nz(d["name"]), nz(d["brand"]),
            as_float(d["price"]), nz(d["currency"]), nz(d["availability"]),
            as_float(d["rating"]), as_int(d["review_count"]), nz(d["description"]),
            nz(d["image"]), appliance, clean_part_type(d["part_type"]),
            in_scope, nz(d["url"]), nz(d["scraped_at"]),
        ))
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in PRODUCT_COLS if c != "ps_number")
    sql = (
        f"INSERT INTO products ({', '.join(PRODUCT_COLS)}) VALUES %s "
        f"ON CONFLICT (ps_number) DO UPDATE SET {updates}"
    )
    execute_values(cur, sql, records)
    valid_ps = {rec[0] for rec in records}
    return len(records), valid_ps


def load_compatibility(src, cur, valid_ps):
    if not sqlite_has_table(src, "compatibility"):
        return 0
    cur.execute("TRUNCATE compatibility")
    rows = [dict(r) for r in src.execute("SELECT * FROM compatibility").fetchall()]
    records = [
        (nz(r["part_ps_number"]), nz(r["model_number"]), nz(r.get("brand")),
         nz(r.get("appliance")), r.get("source") or "scraped")
        for r in rows
        if nz(r["part_ps_number"]) in valid_ps and nz(r["model_number"])
    ]
    if records:
        execute_values(
            cur,
            "INSERT INTO compatibility (part_ps_number, model_number, brand, appliance, source) "
            "VALUES %s ON CONFLICT DO NOTHING",
            records,
        )
    return len(records)


def load_install_guides(src, cur, valid_ps):
    if not sqlite_has_table(src, "install_guides"):
        return 0
    cur.execute("TRUNCATE install_guides")
    rows = [dict(r) for r in src.execute("SELECT * FROM install_guides").fetchall()]
    records = []
    for r in rows:
        ps = nz(r["ps_number"])
        if ps not in valid_ps:
            continue
        records.append((
            ps, bool(r.get("available")), nz(r.get("difficulty")),
            nz(r.get("time_estimate")), nz(r.get("video_url")),
            json.dumps(json.loads(r.get("tools") or "[]")),
            json.dumps(json.loads(r.get("steps") or "[]")),
            json.dumps(json.loads(r.get("repair_stories") or "[]")),
            nz(r.get("source_url")),
        ))
    if records:
        execute_values(
            cur,
            "INSERT INTO install_guides "
            "(ps_number, available, difficulty, time_estimate, video_url, tools, steps, repair_stories, source_url) "
            "VALUES %s",
            records,
            template="(%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s)",
        )
    return len(records)


def load_symptoms(src, cur, valid_ps):
    """Insert symptoms and (if present) their precomputed embeddings, keyed by the
    Postgres SERIAL id returned per row."""
    if not sqlite_has_table(src, "symptoms"):
        return 0, 0
    cur.execute("TRUNCATE symptoms RESTART IDENTITY CASCADE")
    rows = [dict(r) for r in src.execute("SELECT * FROM symptoms").fetchall()]
    n_sym, n_emb = 0, 0
    for r in rows:
        recommended = [p for p in json.loads(r.get("recommended_parts") or "[]") if p in valid_ps]
        cur.execute(
            "INSERT INTO symptoms (appliance, brand, symptom, likely_causes, repair_steps, "
            "recommended_parts, source_url) VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s) "
            "RETURNING id",
            (
                nz(r["appliance"]), nz(r.get("brand")), nz(r["symptom"]),
                json.dumps(json.loads(r.get("likely_causes") or "[]")),
                json.dumps(json.loads(r.get("repair_steps") or "[]")),
                json.dumps(recommended), nz(r.get("source_url")),
            ),
        )
        sym_id = cur.fetchone()[0]
        n_sym += 1
        emb = r.get("embedding")
        if nz(emb):
            cur.execute(
                "INSERT INTO symptom_embeddings (symptom_id, embedding) VALUES (%s, %s::vector)",
                (sym_id, vec_literal(emb)),
            )
            n_emb += 1
    return n_sym, n_emb


def load_product_embeddings(src, cur, valid_ps):
    if not sqlite_has_table(src, "product_embeddings"):
        return 0
    cur.execute("TRUNCATE product_embeddings")
    rows = [dict(r) for r in src.execute("SELECT * FROM product_embeddings").fetchall()]
    records = [
        (nz(r["ps_number"]), vec_literal(r["embedding"]))
        for r in rows
        if nz(r["ps_number"]) in valid_ps and nz(r["embedding"])
    ]
    if records:
        execute_values(
            cur,
            "INSERT INTO product_embeddings (ps_number, embedding) VALUES %s",
            records,
            template="(%s, %s::vector)",
        )
    return len(records)


def main():
    if not os.path.exists(SQLITE_PATH):
        sys.exit(f"FATAL: SQLite snapshot not found at {SQLITE_PATH}")

    src = sqlite3.connect(SQLITE_PATH)
    src.row_factory = sqlite3.Row

    pg = psycopg2.connect(PG_DSN)
    with pg, pg.cursor() as cur:
        # Trust db/init/*.sql for the schema; fail clearly if it didn't run.
        cur.execute("SELECT to_regclass('public.products')")
        if cur.fetchone()[0] is None:
            sys.exit(
                "FATAL: 'products' table missing — db/init DDL did not run.\n"
                "       Run `make reset` to recreate the volume with the init scripts."
            )

        n_products, valid_ps = load_products(src, cur)
        n_compat = load_compatibility(src, cur, valid_ps)
        n_install = load_install_guides(src, cur, valid_ps)
        n_symptoms, n_sym_emb = load_symptoms(src, cur, valid_ps)
        n_prod_emb = load_product_embeddings(src, cur, valid_ps)

        cur.execute("SELECT count(*) FROM products")
        total = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM products WHERE in_scope")
        in_scope = cur.fetchone()[0]

    pg.close()
    src.close()

    print(
        f"seeded: products={n_products} (table now {total}, in_scope={in_scope}) | "
        f"compatibility={n_compat} | install_guides={n_install} | "
        f"symptoms={n_symptoms} | product_embeddings={n_prod_emb} | symptom_embeddings={n_sym_emb}"
    )


if __name__ == "__main__":
    main()

# Context — seed the PartSelect catalog into Postgres (Docker)

**Audience:** an AI agent tasked with standing up a Postgres instance in Docker and
seeding it with the scraped PartSelect catalog. This file is self-contained: the
task, the data location + schema, and a copy-pasteable seeding path.

---

## 1. Task context

We're building a **chat agent for the PartSelect e-commerce site**, scoped to
**Refrigerator and Dishwasher parts**. It answers product questions, checks
part↔model compatibility, gives installation/repair guidance, and assists with
(simulated) transactions. Full product spec is in [`PRD.md`](./PRD.md).

The agent's backend needs the product catalog in **Postgres** for structured
lookups and filtering (and, later, `pgvector` for semantic search). The catalog
has already been scraped into a SQLite file (see below). **Your job:** run
Postgres in a Docker container and load that catalog into it, idempotently.

> Load **all** rows as-is. Note `appliance` contains a few cross-listed values
> beyond Refrigerator/Dishwasher (Washer, Freezer, Dryer, Range, Ice Maker) — those
> are real parts surfaced via brand pages; scope-filtering is an application
> concern, not a seeding concern.

## 2. Data source

- **Path:** `scraper/data/partselect.db` (SQLite, relative to repo root)
- **Table to load:** `products` — **225 rows**
- (Ignore the other table `visited`; it is internal scraper crawl state.)

### Source schema (SQLite `products`)

SQLite columns are dynamically typed (no declared types in the DDL). Intended
types and notes:

| Column | Source type | Notes / quirks |
|---|---|---|
| `ps_number` | text | **Primary key** (e.g. `PS11752778`) |
| `mpn` | text | Manufacturer part number (100% populated) |
| `name` | text | |
| `brand` | text | e.g. Whirlpool, Frigidaire, GE, Bosch, Samsung |
| `price` | real (float) | e.g. `88.88`; **3 rows are NULL** |
| `currency` | text | `USD` (NULL where price is NULL) |
| `availability` | text | e.g. `InStock` |
| `rating` | **text** | e.g. `"4.85"`; **NULL for ~38%** (no reviews) → cast to numeric |
| `review_count` | **text** | e.g. `"494"`; same NULLs as rating → cast to integer |
| `description` | text | may be NULL |
| `image` | text | CDN URL; may be NULL |
| `appliance` | text | from breadcrumb (see cross-listing note above) |
| `part_type` | text | e.g. `Tray or Shelf`, `Spray Arm` |
| `url` | text | source PartSelect product page |
| `scraped_at` | text | ISO-8601 UTC, e.g. `2026-06-05T12:23:53Z` → cast to timestamptz |

## 3. Target: Postgres in Docker

Create `docker-compose.yml` (repo root or `backend/`). The `pgvector/pgvector`
image is used so the `vector` extension is available later without swapping
images.

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: partselect-pg
    environment:
      POSTGRES_DB: partselect
      POSTGRES_USER: partselect
      POSTGRES_PASSWORD: partselect
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U partselect -d partselect"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  pgdata:
```

Bring it up and wait for health:

```bash
docker compose up -d
until docker exec partselect-pg pg_isready -U partselect -d partselect; do sleep 1; done
```

**Connection string:** `postgresql://partselect:partselect@localhost:5432/partselect`

### Target schema (Postgres DDL)

Improves a few types vs. the source (price/rating → numeric, review_count →
integer, scraped_at → timestamptz):

```sql
CREATE TABLE IF NOT EXISTS products (
    ps_number     TEXT PRIMARY KEY,
    mpn           TEXT,
    name          TEXT,
    brand         TEXT,
    price         NUMERIC(10,2),
    currency      TEXT,
    availability  TEXT,
    rating        NUMERIC(3,2),
    review_count  INTEGER,
    description   TEXT,
    image         TEXT,
    appliance     TEXT,
    part_type     TEXT,
    url           TEXT,
    scraped_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_products_appliance ON products (appliance);
CREATE INDEX IF NOT EXISTS idx_products_brand      ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_part_type  ON products (part_type);
CREATE INDEX IF NOT EXISTS idx_products_mpn        ON products (mpn);
```

## 4. Seeding (recommended: Python ETL — robust + idempotent)

Create `scripts/seed_postgres.py`. It reads the SQLite DB, coerces the text
numeric/timestamp fields, and **upserts** on `ps_number` (safe to re-run).

```python
#!/usr/bin/env python3
"""Seed scraper/data/partselect.db (SQLite) -> Postgres. Idempotent (upsert on ps_number).

Deps:  pip install psycopg2-binary
Env :  SQLITE_PATH    (default: scraper/data/partselect.db)
       DATABASE_URL   (default: postgresql://partselect:partselect@localhost:5432/partselect)
"""
import os
import sqlite3

import psycopg2
from psycopg2.extras import execute_values

SQLITE_PATH = os.environ.get("SQLITE_PATH", "scraper/data/partselect.db")
PG_DSN = os.environ.get("DATABASE_URL",
                        "postgresql://partselect:partselect@localhost:5432/partselect")

COLUMNS = ["ps_number", "mpn", "name", "brand", "price", "currency", "availability",
           "rating", "review_count", "description", "image", "appliance",
           "part_type", "url", "scraped_at"]

DDL = """
CREATE TABLE IF NOT EXISTS products (
    ps_number     TEXT PRIMARY KEY,
    mpn           TEXT,
    name          TEXT,
    brand         TEXT,
    price         NUMERIC(10,2),
    currency      TEXT,
    availability  TEXT,
    rating        NUMERIC(3,2),
    review_count  INTEGER,
    description   TEXT,
    image         TEXT,
    appliance     TEXT,
    part_type     TEXT,
    url           TEXT,
    scraped_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_products_appliance ON products (appliance);
CREATE INDEX IF NOT EXISTS idx_products_brand      ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_part_type  ON products (part_type);
CREATE INDEX IF NOT EXISTS idx_products_mpn        ON products (mpn);
"""


def nz(v):                       # normalize '' -> None
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


def main():
    src = sqlite3.connect(SQLITE_PATH)
    src.row_factory = sqlite3.Row
    rows = src.execute(f"SELECT {', '.join(COLUMNS)} FROM products").fetchall()

    records = []
    for r in rows:
        d = dict(r)
        records.append((
            nz(d["ps_number"]), nz(d["mpn"]), nz(d["name"]), nz(d["brand"]),
            as_float(d["price"]), nz(d["currency"]), nz(d["availability"]),
            as_float(d["rating"]), as_int(d["review_count"]), nz(d["description"]),
            nz(d["image"]), nz(d["appliance"]), nz(d["part_type"]), nz(d["url"]),
            nz(d["scraped_at"]),
        ))

    pg = psycopg2.connect(PG_DSN)
    with pg, pg.cursor() as cur:
        cur.execute(DDL)
        updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in COLUMNS if c != "ps_number")
        sql = (f"INSERT INTO products ({', '.join(COLUMNS)}) VALUES %s "
               f"ON CONFLICT (ps_number) DO UPDATE SET {updates}")
        execute_values(cur, sql, records)
        cur.execute("SELECT COUNT(*) FROM products")
        print(f"seeded {len(records)} rows; products table now has {cur.fetchone()[0]}")
    pg.close()


if __name__ == "__main__":
    main()
```

Run it (from repo root, with the container up):

```bash
pip install psycopg2-binary
python scripts/seed_postgres.py
# expect: seeded 225 rows; products table now has 225
```

## 5. Alternative: CSV + `COPY` (no Python)

Postgres casts CSV text into the typed columns on import; `NULL ''` maps empty
fields to NULL. Column order matches the DDL.

```bash
sqlite3 -header -csv scraper/data/partselect.db "SELECT * FROM products;" > products.csv

docker exec -i partselect-pg psql -U partselect -d partselect <<'SQL'
-- (run the Target DDL from §3 first)
\copy products (ps_number,mpn,name,brand,price,currency,availability,rating,review_count,description,image,appliance,part_type,url,scraped_at) FROM 'products.csv' WITH (FORMAT csv, HEADER true, NULL '')
SQL
```
(`\copy` runs client-side, so the CSV path is local; if running inside the
container, mount or `docker cp` the CSV first.)

## 6. Verify

```sql
SELECT COUNT(*) FROM products;                              -- 225
SELECT appliance, COUNT(*) FROM products GROUP BY appliance ORDER BY 2 DESC;
SELECT ps_number, brand, price, rating, review_count
FROM products WHERE ps_number = 'PS11752778';              -- spot check a known row
SELECT COUNT(*) FROM products WHERE price IS NULL;          -- 3
```

## 7. Forward-looking (optional, not required to seed)

For the agent's semantic search later:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1024);  -- match your embedder dims
```
Embeddings would be generated over `name + description + brand + part_type` in a
later step; the `pgvector` image above already supports this.

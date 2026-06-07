-- Source of truth for the catalog (225 scraped rows). The seed script ONLY
-- inserts/upserts into these tables — this file is the single owner of the schema.

CREATE TABLE IF NOT EXISTS products (
    ps_number     TEXT PRIMARY KEY,             -- e.g. PS11752778
    mpn           TEXT,                          -- manufacturer part number
    name          TEXT,
    brand         TEXT,                          -- Whirlpool | Frigidaire | GE | Bosch | Samsung | ...
    price         NUMERIC(10,2),                 -- 3 rows NULL (no price listed)
    currency      TEXT,
    availability  TEXT,                          -- InStock | OnOrder | SpecialOrder | NULL
    rating        NUMERIC(3,2),                  -- ~38% NULL (no reviews)
    review_count  INTEGER,
    description   TEXT,
    image         TEXT,                          -- CDN url
    appliance     TEXT,                          -- Refrigerator | Dishwasher (Ice Maker/Freezer remapped at seed)
    part_type     TEXT,                          -- numeric-code breadcrumb errors nulled at seed
    in_scope      BOOLEAN NOT NULL DEFAULT true, -- false for cross-listed Washer/Dryer/Range
    url           TEXT,                          -- source PartSelect product page
    scraped_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_appliance ON products (appliance);
CREATE INDEX IF NOT EXISTS idx_products_brand     ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_part_type ON products (part_type);
CREATE INDEX IF NOT EXISTS idx_products_mpn       ON products (mpn);
CREATE INDEX IF NOT EXISTS idx_products_in_scope  ON products (in_scope);
-- trigram index powers fuzzy keyword search ("door bin", "ice maker tray") on the catalog.
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

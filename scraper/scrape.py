"""Organic, polite crawler for PartSelect refrigerator + dishwasher parts.

Strategy (the whole game is getting past Akamai Bot Manager):
  1. Drive a REAL, un-leaky Chrome via `nodriver` (hides the CDP/automation tells
     that get vanilla Playwright/Puppeteer flagged). The browser runs Akamai's JS
     sensor for real, so it earns a *validated* _abck cookie.
  2. Navigate slowly and organically (hub -> listing -> product) with human-like
     jitter. This is what stops the "second navigation 403" we observed.
  3. On a 403, back off and recycle the browser to mint a fresh cookie.
  4. Parse the schema.org microdata (parser.py) — no JS needed once you have HTML.

Runs from your own residential IP, which already has good reputation. For larger
crawls add residential proxies and the curl_cffi cookie-reuse hybrid (see README).

Usage:
  pip install -r requirements.txt
  python scrape.py --max-products 25          # small validation run first!
  python scrape.py --appliances refrigerator dishwasher --max-products 2000
"""
import argparse
import asyncio
import json
import random
import re
import sqlite3
import sys
import time
from pathlib import Path

import nodriver as uc

from extractors import parse_compatibility, parse_install, parse_symptoms_fixed
from parser import PS_RE, extract_links, is_blocked, parse_product

# Fridge sub-systems fold into Refrigerator so symptom inversion lines up with the
# seed's appliance remap (keeps the UC3 ice-maker path under Refrigerator).
REMAP_TO_REFRIGERATOR = {"Ice Maker", "Freezer"}

ENRICH_DDL = [
    """CREATE TABLE IF NOT EXISTS compatibility (
         part_ps_number TEXT, model_number TEXT, brand TEXT, appliance TEXT,
         source TEXT DEFAULT 'scraped', PRIMARY KEY (part_ps_number, model_number))""",
    """CREATE TABLE IF NOT EXISTS install_guides (
         ps_number TEXT PRIMARY KEY, available INTEGER, difficulty TEXT, time_estimate TEXT,
         video_url TEXT, tools TEXT, steps TEXT, repair_stories TEXT, source_url TEXT)""",
    """CREATE TABLE IF NOT EXISTS part_symptoms (
         ps_number TEXT, appliance TEXT, symptom TEXT, PRIMARY KEY (ps_number, symptom))""",
    """CREATE TABLE IF NOT EXISTS symptoms (
         symptom_key TEXT PRIMARY KEY, appliance TEXT, brand TEXT, symptom TEXT,
         likely_causes TEXT, repair_steps TEXT, recommended_parts TEXT,
         source_url TEXT, embedding TEXT)""",
]

DB = Path(__file__).resolve().parent / "data" / "partselect.db"
HUBS = {
    "refrigerator": "https://www.partselect.com/Refrigerator-Parts.htm",
    "dishwasher": "https://www.partselect.com/Dishwasher-Parts.htm",
}
COLUMNS = [
    "ps_number", "mpn", "name", "brand", "price", "currency", "availability",
    "rating", "review_count", "description", "image", "appliance", "part_type",
    "url", "scraped_at",
]


def db_connect():
    DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    con.execute(f"CREATE TABLE IF NOT EXISTS products ({', '.join(COLUMNS)}, PRIMARY KEY (ps_number))")
    con.execute("CREATE TABLE IF NOT EXISTS visited (url TEXT PRIMARY KEY)")
    con.commit()
    return con


def save_product(con, p):
    p = {**p, "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    con.execute(
        f"INSERT OR REPLACE INTO products VALUES ({', '.join(':' + c for c in COLUMNS)})", p
    )
    con.commit()


class Crawler:
    def __init__(self, args):
        self.args = args
        self.con = db_connect()
        self.visited = {r[0] for r in self.con.execute("SELECT url FROM visited")}
        self.scraped = {r[0] for r in self.con.execute("SELECT ps_number FROM products")}
        self.browser = None
        self.tab = None
        self.loads = 0

    async def start_browser(self):
        self.browser = await uc.start(headless=False)  # headful survives Akamai far better
        self.tab = await self.browser.get("about:blank")
        self.loads = 0

    async def recycle(self):
        try:
            self.browser.stop()
        except Exception:
            pass
        await asyncio.sleep(2)
        await self.start_browser()

    async def get(self, url):
        """Fetch a URL's HTML, retrying with backoff + a fresh browser on 403."""
        for attempt in range(4):
            await self.tab.get(url)
            await self.tab.sleep(random.uniform(1.5, 3.0))  # let the sensor run / _abck validate
            html = await self.tab.get_content()
            if not is_blocked(html):
                self.loads += 1
                if self.loads >= self.args.recycle_every:
                    await self.recycle()
                return html
            wait = 5 * (attempt + 1) + random.uniform(0, 5)
            print(f"  [403] {url} — backoff {wait:.0f}s + fresh browser", file=sys.stderr)
            await self.recycle()
            await asyncio.sleep(wait)
        print(f"  [give up] {url}", file=sys.stderr)
        return None

    def mark_visited(self, url):
        self.con.execute("INSERT OR IGNORE INTO visited VALUES (?)", (url,))
        self.con.commit()
        self.visited.add(url)

    async def pace(self):
        await asyncio.sleep(random.uniform(self.args.min_delay, self.args.max_delay))

    async def run(self):
        await self.start_browser()
        appliances = self.args.appliances
        listing_queue = [HUBS[a] for a in appliances]
        seen_listing = set(listing_queue)
        product_queue, seen_product = [], set()

        # Phase 1 — discover product URLs by walking listing/brand pages.
        while listing_queue and len(product_queue) < self.args.max_products:
            if len(seen_listing) - len(listing_queue) > self.args.max_listings:
                break
            url = listing_queue.pop(0)
            # NOTE: listing/hub pages are the discovery index — always re-crawl them
            # (don't gate on `visited`, which is for already-scraped *product* pages).
            html = await self.get(url)
            if html is None:
                continue
            products, listings = extract_links(html)
            for p in products:
                if p not in seen_product and p not in self.visited:
                    seen_product.add(p)
                    product_queue.append(p)
            for l in listings:
                if l not in seen_listing and any(a.capitalize() in l for a in appliances):
                    seen_listing.add(l)
                    listing_queue.append(l)
            print(f"[listing] {url}  (+{len(products)} products | queue listings={len(listing_queue)} products={len(product_queue)})")
            await self.pace()

        # Phase 2 — fetch + parse product detail pages.
        count = 0
        for url in product_queue:
            if count >= self.args.max_products:
                break
            if url in self.visited:
                continue
            html = await self.get(url)
            self.mark_visited(url)
            if html is None:
                continue
            p = parse_product(html, url)
            if p and p["ps_number"] not in self.scraped:
                save_product(self.con, p)
                self.scraped.add(p["ps_number"])
                count += 1
                print(f"[{count}] {p['ps_number']}  {p['brand']}  ${p['price']}  — {p['name']}")
            await self.pace()

        self.browser.stop()
        print(f"\nDone. {count} new products this run. Total in {DB}: {len(self.scraped)}.")

    # ── enrichment: re-visit known product pages, extract compat/install/symptoms ──
    async def enrich(self):
        for ddl in ENRICH_DDL:
            self.con.execute(ddl)
        self.con.commit()

        rows = self.con.execute(
            "SELECT ps_number, url, appliance, brand FROM products "
            "WHERE url IS NOT NULL AND url != '' ORDER BY ps_number"
        ).fetchall()
        # Resume: skip products already enriched (so a 403/crash mid-run is recoverable).
        done = {r[0] for r in self.con.execute("SELECT ps_number FROM install_guides")}
        if done:
            rows = [r for r in rows if r[0] not in done]
            print(f"[enrich] resuming — {len(done)} already done, {len(rows)} remaining")
        if self.args.max_products:
            rows = rows[: self.args.max_products]

        await self.start_browser()
        n_ok = n_compat = n_install = n_symptom_links = 0
        for i, (ps, url, appliance, brand) in enumerate(rows, 1):
            html = await self.get(url)
            if html is None:
                print(f"[{i}/{len(rows)}] {ps}  — no html", file=sys.stderr)
                continue
            appl = "Refrigerator" if appliance in REMAP_TO_REFRIGERATOR else appliance

            compat = parse_compatibility(html, ps)
            for c in compat:
                self.con.execute(
                    "INSERT OR REPLACE INTO compatibility "
                    "(part_ps_number, model_number, brand, appliance, source) "
                    "VALUES (?,?,?,?, 'scraped')",
                    (c["part_ps_number"], c["model_number"], c["brand"], c["appliance"]),
                )
            n_compat += len(compat)

            ins = parse_install(html, ps, url)
            self.con.execute(
                "INSERT OR REPLACE INTO install_guides "
                "(ps_number, available, difficulty, time_estimate, video_url, tools, steps, repair_stories, source_url) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (ps, int(ins["available"]), ins["difficulty"], ins["time_estimate"],
                 ins["video_url"], json.dumps(ins["tools"]), json.dumps(ins["steps"]),
                 json.dumps(ins["repair_stories"]), ins["source_url"]),
            )
            if ins["available"]:
                n_install += 1

            for sym in parse_symptoms_fixed(html):
                self.con.execute(
                    "INSERT OR REPLACE INTO part_symptoms (ps_number, appliance, symptom) VALUES (?,?,?)",
                    (ps, appl, sym),
                )
                n_symptom_links += 1

            self.con.commit()
            n_ok += 1
            print(f"[{i}/{len(rows)}] {ps}  compat={len(compat)} video={'y' if ins['video_url'] else '-'} "
                  f"symptoms={len(parse_symptoms_fixed(html))}")
            await self.pace()

        self.browser.stop()
        n_sym = self.build_symptom_index()
        print(f"\nEnriched {n_ok}/{len(rows)} products: compatibility={n_compat}, "
              f"install_guides(available)={n_install}, part_symptom_links={n_symptom_links}, "
              f"symptom_docs={n_sym}.")

    # ── targeted: scrape /Models/{MODEL}/ pages and record which CATALOG parts fit them ──
    async def enrich_models(self, models):
        for ddl in ENRICH_DDL:
            self.con.execute(ddl)
        self.con.commit()
        catalog = {r[0] for r in self.con.execute("SELECT ps_number FROM products")}
        await self.start_browser()
        for model in models:
            model_u = model.strip().upper()
            url = f"https://www.partselect.com/Models/{model_u}/"
            html = await self.get(url)
            if html is None:
                print(f"[model {model_u}] no html", file=sys.stderr)
                continue
            products, _ = extract_links(html)
            page_ps = set()
            for u in products:
                m = PS_RE.search(u)
                if m:
                    page_ps.add(m.group(1))
            hits = page_ps & catalog
            for ps in sorted(hits):
                self.con.execute(
                    "INSERT OR REPLACE INTO compatibility "
                    "(part_ps_number, model_number, brand, appliance, source) VALUES (?,?,?,?, 'scraped')",
                    (ps, model_u, None, None),
                )
            self.con.commit()
            print(f"[model {model_u}] page_parts={len(page_ps)} catalog_hits={len(hits)}: {sorted(hits)}")
            await self.pace()
        self.browser.stop()

    def build_symptom_index(self):
        """Invert part_symptoms into a symptom -> recommended-parts index (the symptoms
        table). Causes/repair steps stay empty — the agent composes them at request time
        from the recommended parts' real descriptions (grounding over generation)."""
        self.con.execute("DELETE FROM symptoms")
        groups = {}
        for ps, appliance, symptom in self.con.execute(
            "SELECT ps_number, appliance, symptom FROM part_symptoms"
        ):
            norm = re.sub(r"\s+", " ", symptom.strip().lower())
            key = f"{appliance}::{norm}"
            groups.setdefault(key, {"appliance": appliance, "symptom": symptom.strip(), "parts": []})
            groups[key]["parts"].append(ps)
        for key, g in groups.items():
            self.con.execute(
                "INSERT OR REPLACE INTO symptoms "
                "(symptom_key, appliance, brand, symptom, likely_causes, repair_steps, recommended_parts, source_url, embedding) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (key, g["appliance"], None, g["symptom"], "[]", "[]",
                 json.dumps(sorted(set(g["parts"]))), None, None),
            )
        self.con.commit()
        return len(groups)


def main():
    ap = argparse.ArgumentParser(description="Polite PartSelect refrigerator/dishwasher parts crawler.")
    ap.add_argument("--appliances", nargs="+", default=["refrigerator", "dishwasher"], choices=list(HUBS))
    ap.add_argument("--max-products", type=int, default=25, help="stop after N new products")
    ap.add_argument("--max-listings", type=int, default=200, help="cap listing/brand pages crawled")
    ap.add_argument("--recycle-every", type=int, default=30, help="restart browser every N page loads (fresh _abck)")
    ap.add_argument("--min-delay", type=float, default=3.0, help="min seconds between pages")
    ap.add_argument("--max-delay", type=float, default=7.0, help="max seconds between pages")
    ap.add_argument("--enrich", action="store_true",
                    help="re-visit known product pages to extract compat/install/symptom data")
    ap.add_argument("--models", nargs="+", default=None,
                    help="scrape /Models/{MODEL}/ pages and record which catalog parts fit them")
    args = ap.parse_args()
    crawler = Crawler(args)
    if args.models:
        uc.loop().run_until_complete(crawler.enrich_models(args.models))
    elif args.enrich:
        uc.loop().run_until_complete(crawler.enrich())
    else:
        uc.loop().run_until_complete(crawler.run())


if __name__ == "__main__":
    main()

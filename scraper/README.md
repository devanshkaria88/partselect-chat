# PartSelect parts scraper (refrigerator + dishwasher)

A polite, self-hosted scraper for PartSelect product data. **There is no product
API** — PartSelect is a server-rendered ASP.NET site that bakes product data into
the HTML as schema.org microdata. The *only* hard problem is getting past
**Akamai Bot Manager**; once you have the HTML, parsing is trivial.

## How it works

- `scrape.py` drives a real, un-leaky Chrome via [`nodriver`](https://github.com/ultrafunkamsterdam/nodriver).
  A real browser runs Akamai's JS sensor and earns a *validated* `_abck` cookie —
  which plain `requests`/`curl` can never do (they get an instant `403 Access Denied`,
  even with a perfect User-Agent). Vanilla Playwright/Puppeteer also fail because
  Akamai detects the automation protocol itself; `nodriver` hides it.
- It crawls **organically and slowly** (category hub → listing/brand pages →
  product pages) with randomized delays. This is what avoids the "first page OK,
  second page 403" behavior — Akamai scores you behaviorally.
- On a `403` it backs off and **recycles the browser** to mint a fresh cookie.
- `parser.py` extracts the microdata: `ps_number` (PartSelect #, primary key),
  `mpn` (manufacturer #), `name`, `brand`, `price`, `currency`, `availability`,
  `rating`, `review_count`, `description`, `image`, and `appliance`/`part_type`
  from the breadcrumb. Results go to a resumable **SQLite** DB (`data/partselect.db`).

## Run it

`nodriver` needs **Python 3.10+**. From inside `scraper/`:

```bash
python3.12 -m venv .venv                          # 3.10+ required
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scrape.py --max-products 25      # START SMALL — this is the feasibility test
```

If the small run returns products, scale up:

```bash
.venv/bin/python scrape.py --appliances refrigerator dishwasher --max-products 2000 \
  --min-delay 4 --max-delay 9
```

The catalog is written to `data/partselect.db` (created automatically). It's
resumable — re-running skips PS numbers already stored. Inspect / export:

```bash
sqlite3 data/partselect.db "SELECT brand, price, name FROM products LIMIT 20;"
sqlite3 -header -csv data/partselect.db "SELECT * FROM products;" > data/parts.csv
```

> A reference dataset of ~225 products (100 refrigerator + 100 dishwasher + 25
> seed) is already checked in at `data/partselect.db`. The `samples/` directory
> holds real captured pages used as offline parser fixtures.

## Expectations (read this)

- **First run is the real test.** From your home (residential) IP with the
  default slow pacing, a modest crawl should work. If you still hit persistent
  `403`s, your IP/fingerprint is being scored — escalate (below).
- **Akamai rotates its sensor script.** This *will* break eventually and need
  re-tuning. That maintenance is the real cost of the DIY path.
- **Discovery is link-driven.** `sitemap.xml`/`robots.txt` are themselves `403`,
  so the category hubs are the index. Part-type pages list only ~10 *popular*
  parts each; broaden coverage via brand pages (`{Brand}-Refrigerator-Parts.htm`,
  ~30 brands) — already followed automatically — and, for the deepest coverage,
  model pages (`/Models/{MODEL}/`), which are intentionally not crawled by default
  to keep request volume (and Akamai exposure) down.
- **Don't brute-force PS numbers.** Sparse keyspace, every probe is an
  Akamai-gated request that spikes ban risk. Follow links instead.

## Scaling up (residential proxies + curl_cffi hybrid)

For tens of thousands of pages, running a full browser per page is slow and your
single home IP gets rate-flagged. The standard pattern:

1. Use a few `nodriver` browsers **only to mint** validated `_abck`/`bm_*` cookie
   bundles over **residential proxies** (~$3–10/GB; datacenter IPs won't work).
2. Hand each cookie bundle to a fast [`curl_cffi`](https://github.com/lexiforest/curl_cffi)
   fetcher (`impersonate="chrome"`) — but you **must** keep the *same egress IP
   and TLS fingerprint* the cookie was minted under, or Akamai rejects it.
3. Re-mint on `403`. Pin each cookie bundle to its proxy IP.

If this maintenance burden isn't worth it, a managed unblocker (e.g. ScrapFly's
`asp=true`, ~98% Akamai success, free 1,000-credit trial) does it for you.

## Be a good citizen / legal

Reading public product *facts* (prices, part numbers, availability) is low CFAA
risk (post–*Van Buren* / *hiQ v. LinkedIn*), but: respect the site. Keep delays
generous, low concurrency, run off-peak, and **store facts — not verbatim
description prose or images** (those carry copyright). Aggressively evading
Akamai weakens the "public data" posture, so stay gentle. This is informational,
not legal advice; check PartSelect's Terms of Use for your use case.

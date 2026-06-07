"""Parse PartSelect product and listing pages.

PartSelect serves product data as schema.org *microdata* (itemprop="...") plus a
BreadcrumbList JSON-LD block, baked into the HTML document. So once you have the
HTML (the hard part — see scrape.py), extraction needs no JavaScript at all.
"""
import json
import re

from selectolax.parser import HTMLParser

PS_RE = re.compile(r"/(PS\d{5,})-")
# A page is a listing/category page if its path looks like one of PartSelect's
# .htm hubs for refrigerator/dishwasher (part-type, brand, or brand+type pages).
LISTING_RE = re.compile(r"/(?:[A-Za-z]+-)?(?:Refrigerator|Dishwasher)[A-Za-z-]*\.htm$")

BASE = "https://www.partselect.com"


def is_blocked(html: str) -> bool:
    """True if the response is an Akamai 'Access Denied' interstitial, not real HTML."""
    head = html[:3000]
    return "Access Denied" in head or "errors.edgesuite.net" in head


def _norm_price(raw):
    if not raw:
        return None
    try:
        return round(float(raw.replace(",", "").replace("$", "").strip()), 2)
    except ValueError:
        return None


def parse_product(html: str, url: str = ""):
    """Return a dict of product fields, or None if this isn't a product detail page
    (e.g. a category page or an Akamai block)."""
    if is_blocked(html):
        return None
    tree = HTMLParser(html)

    def ip(name):
        el = tree.css_first(f'[itemprop="{name}"]')
        if el is None:
            return None
        val = el.attributes.get("content") or el.text(strip=True)
        return val.strip() if val else None

    def img():
        el = tree.css_first('[itemprop="image"]')
        if el is None:
            return None
        # The image URL may live in content=, href=, src=, or a child <img>.
        val = el.attributes.get("content") or el.attributes.get("href")
        if not val and el.tag == "img":
            val = el.attributes.get("src") or el.attributes.get("data-src")
        if not val:
            child = el.css_first("img")
            if child is not None:
                val = child.attributes.get("src") or child.attributes.get("data-src")
        return val.strip() if val else None

    ps = ip("productID")
    if not ps:
        m = PS_RE.search(url)
        ps = m.group(1) if m else None
    if not ps:
        return None  # not a product page

    # Category hierarchy from the BreadcrumbList JSON-LD.
    breadcrumb = []
    for node in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(node.text())
        except (json.JSONDecodeError, TypeError):
            continue
        for item in (data if isinstance(data, list) else [data]):
            if isinstance(item, dict) and item.get("@type") == "BreadcrumbList":
                breadcrumb = [e.get("name") for e in item.get("itemListElement", []) if e.get("name")]

    availability = ip("availability")
    if availability:
        availability = availability.rsplit("/", 1)[-1]  # "http://schema.org/InStock" -> "InStock"

    return {
        "ps_number": ps,
        "mpn": ip("mpn"),
        "name": ip("name"),
        "brand": ip("brand"),
        "price": _norm_price(ip("price")),
        "currency": ip("priceCurrency"),
        "availability": availability,
        "rating": ip("ratingValue"),
        "review_count": ip("reviewCount"),
        "description": ip("description"),
        "image": img(),
        # breadcrumb e.g. ["Home", "Refrigerator", "Tray or Shelf", "WPW10321304"]
        "appliance": breadcrumb[1] if len(breadcrumb) > 1 else None,
        "part_type": breadcrumb[2] if len(breadcrumb) > 2 else None,
        "url": url,
    }


def extract_links(html: str):
    """Return (product_urls, listing_urls) discovered on a page, absolute and de-querystring'd."""
    tree = HTMLParser(html)
    products, listings = set(), set()
    for a in tree.css("a[href]"):
        href = (a.attributes.get("href") or "").split("#")[0].split("?")[0]
        if not href:
            continue
        if href.startswith("/"):
            href = BASE + href
        if not href.startswith(BASE):
            continue
        if "/PS" in href and PS_RE.search(href):
            products.add(href)
        elif LISTING_RE.search(href):
            listings.add(href)
    return products, listings

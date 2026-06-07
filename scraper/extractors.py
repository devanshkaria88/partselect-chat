"""Extract enrichment data from a *rendered* PartSelect product page.

These run over the same HTML the catalog parser sees, pulling the three things the
chat agent's depth tools need but the schema.org microdata doesn't carry:

  • compatibility  — the "Model Cross Reference" table (#ModelCrossReference /
                     .pd__crossref__list): real appliance model numbers + brand.
  • install        — the how-to video (#PartVideos [data-yt-init]) + customer
                     "repair stories" (raw install narrative; the LLM enrich step
                     composes clean numbered steps/difficulty/tools from these).
  • symptoms_fixed — the "This part fixes the following symptoms" list
                     (#Troubleshooting ul.list-disc); inverted later into a
                     symptom -> recommended-parts index.

The Model Cross Reference list is infinite-scroll/AJAX; a static fetch captures the
first page of models (plenty for grounding), a live nodriver scroll captures more.
"""
import re

from selectolax.parser import HTMLParser

YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,15}$")


def _tree(html):
    return html if isinstance(html, HTMLParser) else HTMLParser(html)


def _ancestor_contains(node, phrase, depth=4):
    """True if any ancestor (up to `depth`) contains `phrase` in its text."""
    anc = node
    for _ in range(depth):
        anc = anc.parent
        if anc is None:
            return False
        if phrase in (anc.text() or "").lower():
            return True
    return False


def _sibling_el(node, attr):
    """Nearest element sibling in direction `attr` ('prev'|'next'), skipping text nodes."""
    sib = getattr(node, attr)
    while sib is not None:
        if sib.tag and sib.tag != "-text":
            return sib
        sib = getattr(sib, attr)
    return None


def parse_compatibility(html, ps_number):
    """-> list of {part_ps_number, model_number, brand, appliance} (deduped)."""
    tree = _tree(html)
    out, seen = [], set()
    for row in tree.css(".pd__crossref__list .row"):
        link = row.css_first('a[href^="/Models/"]')
        if link is None:
            continue
        model = link.text(strip=True)
        if not model:
            continue
        # Row layout: <div>Brand</div> <a>Model</a> <div>Appliance</div>. Navigate from
        # the model link's element siblings so wrapper divs can't leak the whole row.
        brand_el = _sibling_el(link, "prev")
        appliance_el = _sibling_el(link, "next")
        brand = brand_el.text(strip=True) if brand_el else None
        appliance = appliance_el.text(strip=True) if appliance_el else None
        key = (ps_number, model)
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "part_ps_number": ps_number,
            "model_number": model,
            "brand": brand or None,
            "appliance": appliance or None,
        })
    return out


def parse_video_url(html):
    """-> the how-to YouTube URL, or None."""
    tree = _tree(html)
    el = tree.css_first("[data-yt-init]")
    if el is not None:
        vid = (el.attributes.get("data-yt-init") or "").strip()
        if YT_ID_RE.match(vid):
            return f"https://www.youtube.com/watch?v={vid}"
    iframe = tree.css_first("iframe[src*='youtube']")
    if iframe is not None:
        src = iframe.attributes.get("src") or ""
        m = re.search(r"/embed/([A-Za-z0-9_-]{6,15})", src)
        if m:
            return f"https://www.youtube.com/watch?v={m.group(1)}"
    return None


def parse_repair_stories(html, limit=6):
    """-> list of cleaned customer repair-story texts (real install narrative)."""
    tree = _tree(html)
    stories = []
    for el in tree.css(".pd__cust-review__submitted-review"):
        txt = " ".join(el.text(separator=" ", strip=True).split())
        txt = txt.replace("★", "").strip()
        if len(txt) > 25:
            stories.append(txt[:600])
        if len(stories) >= limit:
            break
    return stories


def parse_install(html, ps_number, source_url=None):
    """-> install_guide dict. steps/difficulty/tools are left for the LLM enrich step
    to compose from `repair_stories` (kept on the row); `available` reflects whether we
    found *any* real install material (video or stories)."""
    video_url = parse_video_url(html)
    stories = parse_repair_stories(html)
    return {
        "ps_number": ps_number,
        "available": bool(video_url or stories),
        "difficulty": None,        # composed by enrich LLM step from stories
        "time_estimate": None,     # composed by enrich LLM step
        "video_url": video_url,
        "tools": [],               # composed by enrich LLM step
        "steps": [],               # composed by enrich LLM step
        "repair_stories": stories, # raw grounding material (not a Postgres column)
        "source_url": source_url,
    }


def parse_symptoms_fixed(html):
    """-> list of symptom names this part fixes (from the Troubleshooting section)."""
    tree = _tree(html)
    for ul in tree.css("ul.list-disc"):
        if _ancestor_contains(ul, "fixes the following symptoms"):
            items = [li.text(strip=True) for li in ul.css("li")]
            return [s for s in items if s]
    return []

"""Conservative official-page link discovery; all findings require manual verification."""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
from pathlib import Path

USER_AGENT = "OpportunityIntelligencePortal/0.1 (public opportunity discovery; contact via GitHub)"
ROOT = Path(__file__).resolve().parent
ALLOWED_CATEGORIES = {"academic", "government", "international", "research", "consultancy", "awards"}

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.words = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.words = []
    def handle_data(self, data):
        if self.href is not None:
            self.words.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            self.links.append((self.href, " ".join(" ".join(self.words).split())))
            self.href = None
            self.words = []

def get(url, headers=None):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json", **(headers or {})})
    with urlopen(req, timeout=20) as response:
        return response.read(2_000_001).decode("utf-8", errors="replace")

def permitted(url):
    parsed = urlparse(url)
    robots = parsed.scheme + "://" + parsed.netloc + "/robots.txt"
    parser = RobotFileParser()
    try:
        parser.parse(get(robots).splitlines())
        return parser.can_fetch(USER_AGENT, url)
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        print(f"Skipping {url}: cannot confirm robots.txt permission ({exc})", file=sys.stderr)
        return False

# Reject generic navigation, informational pages, and unsupported application pages.
GENERIC_LABELS = {
    "careers", "career", "jobs", "vacancies", "recruitment",
    "faculty recruitment", "job opportunities", "apply now",
    "learn more", "read more", "view all", "current openings",
    "call for proposals", "funding opportunities", "opportunities",
}
BAD_PATH_PARTS = (
    "/chatbot", "/values", "/about-us", "/our-values", "/privacy",
    "/terms", "/contact", "/faq", "/login", "/register", "/search",
    "/news", "/events", "/subscribe",
)
ROLE_TERMS = (
    "assistant professor", "associate professor", "professor of",
    "faculty position", "faculty positions", "faculty vacancy",
    "recruitment notification", "vacancy circular", "vacancy notice",
    "advertisement no", "advertisement number", "recruitment advertisement",
    "deputation post", "deputation vacancy", "lateral entry",
    "request for proposal", "expression of interest", "tender notice",
    "call for research proposals", "call for proposals", "research grant",
    "research fellowship", "applications invited", "inviting applications",
    "award nominations", "fellowship applications",
)
DOCUMENT_SUFFIXES = (".pdf", ".doc", ".docx")

def candidate_link(href, label, source):
    """Return a specific advertisement candidate, never a generic career landing page."""
    label = " ".join(label.split())
    if not 15 <= len(label) <= 220:
        return None
    lower = label.casefold()
    if lower in GENERIC_LABELS or lower.startswith(("http://", "https://", "/content/")):
        return None
    if not any(term in lower for term in source["include"]):
        return None
    url = urldefrag(urljoin(source["url"], href))[0]
    parsed = urlparse(url)
    host = (urlparse(source["url"]).hostname or "").lower()
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    if parsed.hostname.lower() != host and not parsed.hostname.lower().endswith("." + host):
        return None
    path = parsed.path.casefold()
    if any(part in path for part in BAD_PATH_PARTS):
        return None
    if url.rstrip("/") == source["url"].rstrip("/"):
        return None
    # Specific recruitment notices only; broad "jobs" and "career" are insufficient.
    specific = any(term in lower for term in ROLE_TERMS)
    numbered = bool(re.search(r"\b(?:advt\.?|advertisement|notification|vacancy|tender|rfp|eoi)\s*(?:no\.?|number|#|[:\-])?\s*[a-z0-9/-]*\d", lower))
    doc = path.endswith(DOCUMENT_SUFFIXES)
    if not (specific or numbered or (doc and any(w in lower for w in ("recruitment", "faculty", "vacancy", "proposal", "fellowship", "award", "tender")))):
        return None
    return {
        "title": label,
        "category": source["category"],
        "official_url": url,
        "status": "pending",
        "source_identifier": source["id"],
    }

def discover(source):
    page = source["url"]
    if not permitted(page):
        return []
    parser = Links()
    parser.feed(get(page))
    found = {}
    for href, label in parser.links:
        candidate = candidate_link(href, label, source)
        if candidate:
            found[candidate["official_url"]] = candidate
    return list(found.values())[:40]

def api_request(path, method="GET", payload=None, headers=None):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()
    body = json.dumps(payload).encode() if payload is not None else None
    # Legacy service_role JWT uses Bearer auth. New sb_secret_* keys use apikey only.
    auth = {"apikey": key}
    if key.startswith("eyJ"):
        auth["Authorization"] = "Bearer " + key
    request = Request(
        base + "/rest/v1/" + path, data=body, method=method,
        headers={**auth, "Content-Type": "application/json",
                 "Prefer": "return=minimal", **(headers or {})},
    )
    try:
        with urlopen(request, timeout=25) as response:
            return response.read()
    except HTTPError as exc:
        details = exc.read(1200).decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase HTTP {exc.code}: {details}") from exc

def record_run(source, status, found=0, inserted=0, error=None):
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        return
    api_request("collection_runs", method="POST", payload={
        "collector_name": source["id"], "category": source["category"],
        "run_status": status, "records_found": found,
        "records_inserted": inserted, "error_message": (error or "")[:1000] or None,
        "finished_at": datetime.now(timezone.utc).isoformat()
    })

def persist(rows):
    if not rows:
        return 0
    # Do not overwrite human-reviewed records. Ignore duplicates on official_url.
    api_request("opportunities?on_conflict=official_url", method="POST",
                payload=rows, headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
    return len(rows)  # attempted inserts, not confirmed new inserts

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print candidates without writing to Supabase")
    args = ap.parse_args()
    sources = json.loads((ROOT / "sources.json").read_text())
    if not args.dry_run and not all(os.getenv(k) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")):
        sys.exit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run:
        # Check DB permissions before contacting external sources.
        api_request("collection_runs?select=id&limit=1")
    failures = 0
    source_errors = 0
    for source in sources:
        if source["category"] not in ALLOWED_CATEGORIES:
            raise ValueError("Unknown category")
        try:
            candidates = discover(source)
            print(json.dumps({"source": source["id"], "candidate_count": len(candidates), "candidates": candidates[:5]}))
            if not args.dry_run:
                persist(candidates)
                record_run(source, "completed", len(candidates), 0)
        except (HTTPError, URLError, TimeoutError) as exc:
            # Individual official sites can be temporarily unreachable from GitHub runners.
            source_errors += 1
            print(f"Source temporarily unavailable: {source['id']}: {exc}", file=sys.stderr)
            if not args.dry_run:
                record_run(source, "failed", error=f"Source unreachable: {exc}")
        except Exception as exc:
            # Database, parsing, or unexpected errors still fail the workflow.
            failures += 1
            print(f"Collector {source['id']} failed: {exc}", file=sys.stderr)
            if not args.dry_run:
                try:
                    record_run(source, "failed", error=str(exc))
                except Exception as log_exc:
                    print(f"Logging failed: {log_exc}", file=sys.stderr)
        time.sleep(1)
    print(json.dumps({"source_unavailable": source_errors, "unexpected_failures": failures}))
    if failures:
        sys.exit(f"{failures} collector(s) failed")

if __name__ == "__main__":
    main()

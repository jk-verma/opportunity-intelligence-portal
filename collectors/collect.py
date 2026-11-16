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
from urllib.parse import urljoin, urlparse, urldefrag, quote
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

def discover(source):
    page = source["url"]
    if not permitted(page):
        return []
    parser = Links()
    parser.feed(get(page))
    host = urlparse(page).hostname or ""
    found = {}
    for href, label in parser.links:
        if not label or len(label) < 12 or len(label) > 260:
            continue
        if not any(word.lower() in label.lower() for word in source["include"]):
            continue
        absolute = urldefrag(urljoin(page, href))[0]
        parts = urlparse(absolute)
        if parts.scheme != "https" or not parts.hostname:
            continue
        # Official source page and linked official subdomains only.
        if parts.hostname != host and not parts.hostname.endswith("." + host):
            continue
        if absolute.rstrip("/") == page.rstrip("/"):
            continue
        found[absolute] = {
            "title": label,
            "category": source["category"],
            "official_url": absolute,
            "status": "pending",
            "source_identifier": source["id"],
        }
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
    for source in sources:
        if source["category"] not in ALLOWED_CATEGORIES:
            raise ValueError("Unknown category")
        try:
            candidates = discover(source)
            print(json.dumps({"source": source["id"], "candidate_count": len(candidates), "candidates": candidates[:5]}))
            if not args.dry_run:
                persist(candidates)
                record_run(source, "completed", len(candidates), 0)
        except Exception as exc:
            failures += 1
            print(f"Collector {source['id']} failed: {exc}", file=sys.stderr)
            if not args.dry_run:
                try:
                    record_run(source, "failed", error=str(exc))
                except Exception as log_exc:
                    print(f"Logging failed: {log_exc}", file=sys.stderr)
        time.sleep(1)
    if failures:
        sys.exit(f"{failures} collector(s) failed")

if __name__ == "__main__":
    main()

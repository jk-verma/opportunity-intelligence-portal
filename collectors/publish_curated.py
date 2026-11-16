"""Publish reviewed official opportunities across supported categories.

Only the reviewed records in curated_verified.json are published. The daily
discovery collector continues to save all new, unreviewed findings as pending.
This script never overwrites an existing row or invents missing dates.
"""
import json
from pathlib import Path
from urllib.parse import quote
from collect import api_request
from urllib.parse import urlencode

ROOT=Path(__file__).resolve().parent

def main():
    rows=json.loads((ROOT/"curated_verified.json").read_text(encoding="utf-8"))
    urls=set()
    for row in rows:
        url=row["official_url"]
        if not url.startswith("https://") or url in urls:
            raise ValueError("Duplicate or insecure curated official_url: "+url)
        urls.add(url)
        if not row["title"] or row["category"] not in {"academic","government","international","research","consultancy","awards"}:
            raise ValueError("Invalid curated entry")
        if row.get("deadline_at") and not row["deadline_at"].endswith("Z"):
            raise ValueError("Curated deadlines must have an explicit UTC timestamp")
    for row in rows:
        existing=api_request("opportunities?select=id,status&official_url=eq."+quote(row["official_url"],safe=""))
        found=json.loads(existing)
        if found:
            if found[0]["status"] == "pending":
                # Promote an independently reviewed candidate without changing its original URL.
                api_request("opportunities?id=eq."+quote(found[0]["id"],safe=""),method="PATCH",payload={**row,"status":"verified"})
                print(json.dumps({"url":row["official_url"],"result":"promoted_to_verified"}))
            else:
                print(json.dumps({"url":row["official_url"],"result":"already_reviewed_unchanged"}))
            continue
        payload={**row,"status":"verified"}
        api_request("opportunities",method="POST",payload=payload)
        print(json.dumps({"url":row["official_url"],"result":"published_verified"}))

if __name__=="__main__":
    main()

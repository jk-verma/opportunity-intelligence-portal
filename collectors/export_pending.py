"""Export a read-only, explicitly unverified discovery snapshot for GitHub Pages.

Never export private tables, user data, or credentials. This is a public
projection of pending opportunity advertisements only.
"""
import json
from pathlib import Path
from collect import api_request

ROOT=Path(__file__).resolve().parent.parent
FIELDS="id,title,category,location,description,eligibility,qualifications,experience_required,pay_details,published_at,deadline_at,official_url,source_identifier"
def main():
    raw=api_request("opportunities?select="+FIELDS+"&status=eq.pending&order=created_at.desc&limit=1000")
    rows=json.loads(raw)
    safe=[]
    for row in rows:
        if not isinstance(row,dict) or not str(row.get("official_url","")).startswith("https://"):
            continue
        safe.append({k:row.get(k) for k in FIELDS.split(",")})
    target=ROOT/"pending-opportunities.json"
    target.write_text(json.dumps(safe,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({"public_pending_snapshot_count":len(safe)}))
if __name__=="__main__":
    main()

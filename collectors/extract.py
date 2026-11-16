"""Conservative structured extraction from accessible official HTML advertisement pages.

Never infer dates or qualifications from site navigation. Only capture explicitly
labeled fields; ambiguous dates are left blank. PDF extraction requires a separate
source-specific adapter and is not attempted here.
"""
import re
from datetime import datetime, timezone
from html.parser import HTMLParser

class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]
        self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ("script","style","nav","footer"):
            self.skip+=1
        if tag in ("p","li","h1","h2","h3","div","tr","br"):
            self.parts.append("\n")
    def handle_endtag(self,tag):
        if tag in ("script","style","nav","footer") and self.skip:
            self.skip-=1
        if tag in ("p","li","h1","h2","h3","div","tr"):
            self.parts.append("\n")
    def handle_data(self,data):
        if not self.skip:self.parts.append(data)

def page_lines(html):
    p=PageText();p.feed(html)
    return [" ".join(line.split()) for line in "".join(p.parts).splitlines() if line.strip()]

def parse_date(value):
    """Only unambiguous YYYY-MM-DD or DD Month YYYY dates."""
    value=value.strip().rstrip(" .")
    for fmt in ("%Y-%m-%d","%d %B %Y","%d %b %Y"):
        try:return datetime.strptime(value,fmt).date().isoformat()
        except ValueError:pass
    return None

def labeled_value(lines,labels,max_length=360):
    for line in lines:
        for label in labels:
            m=re.match(r"^"+re.escape(label)+r"\s*[:\-]\s*(.+)$",line,re.I)
            if m and len(m.group(1))<=max_length:return m.group(1).strip()
    return None

def extract(html):
    lines=page_lines(html)
    data={}
    mappings={
        "eligibility":("Eligibility","Eligibility criteria"),
        "qualifications":("Qualifications","Essential qualifications","Educational qualification"),
        "experience_required":("Experience required","Minimum experience","Experience"),
        "pay_details":("Pay scale","Pay level","Salary","Remuneration"),
        "location":("Job location","Place of posting","Location"),
    }
    for field,labels in mappings.items():
        value=labeled_value(lines,labels)
        if value:data[field]=value
    published=labeled_value(lines,("Publication date","Date of publication","Advertisement date"),50)
    if published:
        parsed=parse_date(published)
        if parsed:data["published_at"]=parsed
    deadline=labeled_value(lines,("Last date to apply","Application deadline","Closing date","Last date for submission"),50)
    if deadline:
        parsed=parse_date(deadline)
        if parsed:data["deadline_at"]=parsed+"T23:59:59+00:00"
    return data

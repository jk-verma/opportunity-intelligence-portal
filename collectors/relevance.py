"""Conservative relevance filter for IT, Information Systems and management technology.

General faculty advertisements are retained when the discipline is not specified;
unrelated explicitly named disciplines are excluded.
"""
import re

FOCUS = re.compile(
    r"\b(information (?:technology|systems|management)|knowledge management|"
    r"computer science|computing|software|data (?:science|analytics|engineering|management)|"
    r"business analytics|business intelligence|artificial intelligence|machine learning|"
    r"generative ai|digital (?:transformation|technology|governance|economy|infrastructure)|"
    r"cloud computing|high.performance computing|hpc|cybersecurity|cyber security|"
    r"blockchain|quantum computing|internet of things|iot|automation|"
    r"management information systems|mis|technology management|decision support|"
    r"fintech|financial technology|enterprise systems|information security|"
    r"database|programming|python|analytics|digitalization|digitisation|digitization|"
    r"e.governance|digital public infrastructure|ict|it systems|ai/ml|"
    r"operations research|optimization|optimisation)\b",re.I)
GENERAL_FACULTY = re.compile(r"\b(faculty|professor|lecturer|teaching)\b",re.I)
UNRELATED = re.compile(
    r"\b(agriculture|agronomy|horticulture|veterinary|nursing|dentistry|"
    r"pharmacology|physiotherapy|anatomy|botany|zoology|geology|"
    r"civil engineering|mechanical engineering|chemical engineering|"
    r"literature|linguistics|history|archaeology|fine arts|music|"
    r"physical education|sports coaching)\b",re.I)

def relevant(title,category,description="",qualifications="",eligibility=""):
    title=str(title or "")
    category=str(category or "")
    detail=" ".join(str(x or "") for x in (description,qualifications,eligibility))
    if FOCUS.search(title):return True
    if UNRELATED.search(title):return False
    if FOCUS.search(detail):return True
    # Broad faculty advertisements can cover Information Systems even when
    # the short link text does not list every teaching area.
    if category=="academic" and GENERAL_FACULTY.search(title):return True
    return False

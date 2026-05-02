import re
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    import spacy
    from spacy.matcher import PhraseMatcher
    from spacy.lang.en.stop_words import STOP_WORDS as SPACY_STOP
except Exception:  # pragma: no cover
    spacy = None
    PhraseMatcher = None
    SPACY_STOP = set()

import numpy as np
from sentence_transformers import SentenceTransformer

SKILL_SYNONYMS = {
    "react": ["react.js", "reactjs", "frontend", "javascript"],
    "python": ["django", "flask", "pandas", "numpy"],
    "java": ["spring", "spring boot", "jvm"],
    "javascript": ["js", "node.js", "nodejs", "typescript", "ts"],
    "typescript": ["ts"],
    "go": ["golang"],
    "kubernetes": ["k8s", "kubectl", "helm"],
    "docker": ["containerization", "containers"],
    "sql": ["mysql", "postgresql", "postgres", "sqlite", "t-sql"],
    "linux": ["unix", "ubuntu", "rhel", "centos"],
    "aws": ["amazon web services", "ec2", "lambda", "s3", "aws certified", "aws certification"],
    "gcp": ["google cloud", "bigquery", "cloud run", "google cloud platform"],
    "azure": ["microsoft azure", "azure devops"],
    "terraform": ["iac", "infrastructure as code"],
    "kafka": ["apache kafka"],
    "spark": ["apache spark", "pyspark"],
    "mongodb": ["mongo"],
    "redis": [],
    "git": ["github", "gitlab", "version control"],
    "c++": ["cpp"],
    "rust": [],
    "ruby": ["rails", "ruby on rails"],
    "php": ["laravel"],
    "swift": [],
    "kotlin": [],
    "scala": [],
    "snowflake": [],
    "databricks": [],
    "airflow": ["apache airflow"],
    "ml": ["machine learning"],
    "nlp": ["natural language processing"],
    "deep learning": ["pytorch", "tensorflow", "keras"],
}

EDU_KEYWORDS = [
    "bachelor", "master", "phd", "b.tech", "m.tech", "mba", "b.sc", "m.sc",
    "b.e", "m.e", "degree", "b.e.", "b.tech.",
]
CERT_KEYWORDS = [
    "aws", "gcp", "azure", "pmp", "scrum", "kubernetes", "cka", "cissp",
    "linux", "sql", "coursera", "red hat", "rhcsa", "rhce", "ckad", "terraform",
]
CERT_SYNONYMS = {
    "aws": ["amazon web services", "aws certified", "aws certification", "amazon web service"],
    "gcp": ["google cloud", "google cloud platform", "gcp certified"],
    "azure": ["microsoft azure", "azure certified", "az-"],
    "pmp": ["project management professional"],
    "scrum": ["scrum master", "csm", "psm"],
    "kubernetes": ["k8s", "ckad", "certified kubernetes"],
    "cka": ["certified kubernetes administrator"],
    "cissp": ["certified information systems security professional"],
    "linux": ["linux+", "comptia linux", "lpic"],
    "sql": ["oracle sql", "microsoft sql", "sql server"],
    "coursera": ["coursera certificate", "coursera specialization"],
    "red hat": ["redhat", "red hat certified", "rhcsa", "rhce", "rhel"],
    "rhcsa": ["red hat certified system administrator"],
    "rhce": ["red hat certified engineer"],
    "ckad": ["certified kubernetes application developer"],
    "terraform": ["hashicorp terraform", "terraform associate"],
}
DEGREE_LEVELS = {
    "b.sc": 1,
    "bachelor": 1,
    "b.tech": 1,
    "b.e": 1,
    "b.e.": 1,
    "mba": 2,
    "m.sc": 2,
    "master": 2,
    "m.tech": 2,
    "m.e": 2,
    "m.e.": 2,
    "phd": 3,
    "ph.d": 3,
}

SECTION_ORDER = [
    "summary",
    "experience",
    "education",
    "skills",
    "certifications",
    "projects",
]

# Tokens that look "technical" but are generic prose.
_NON_SKILL_BLOCKLIST = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "as", "by",
    "with", "from", "into", "over", "after", "before", "between", "through", "during",
    "including", "against", "among", "throughout", "despite", "towards", "upon", "concerning",
    "team", "teams", "work", "working", "worked", "role", "roles", "job", "jobs", "position",
    "company", "companies", "client", "clients", "project", "projects", "product", "products",
    "business", "businesses", "management", "manager", "managers", "lead", "leader", "leading",
    "strong", "good", "great", "excellent", "solid", "proven", "ability", "abilities",
    "experience", "experiences", "years", "year", "plus", "including", "such", "well", "highly",
    "responsible", "responsibilities", "duty", "duties", "ensure", "ensuring", "support",
    "supporting", "develop", "developing", "development", "design", "designing", "build",
    "building", "deliver", "delivering", "collaborate", "collaboration", "communication",
    "stakeholder", "stakeholders", "environment", "environments", "office", "remote", "hybrid",
    "full", "time", "part", "contract", "permanent", "location", "locations", "based",
    "preferred", "required", "optional", "bonus", "nice", "must", "should", "need", "needs",
    "looking", "seeking", "hire", "hiring", "candidate", "candidates", "applicant",
    "opportunity", "opportunities", "description", "summary", "overview", "qualifications",
    "requirements", "requirement", "skills", "skill", "education", "certifications",
    "certification", "degree", "university", "college", "school", "gpa", "salary", "benefits",
    "equal", "employer", "visa", "sponsorship", "relocation", "travel", "us", "uk", "india",
    "monday", "tuesday", "wednesday", "thursday", "friday", "week", "month", "day", "days",
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december",
}

_CERTIFICATION_TRIGGER = re.compile(
    r"\b(?:course|certificate|certification|specialization|program|bootcamp|badge|track|nanodegree|certified)\b",
    re.IGNORECASE,
)
_CERT_PLATFORM_MARKERS = {
    "coursera",
    "udemy",
    "edx",
    "pluralsight",
    "linkedin",
    "linkedin learning",
    "red hat",
    "oracle",
}
_CERT_DISPLAY_OVERRIDES = {
    "aws": "AWS Certification",
    "gcp": "GCP Certification",
    "azure": "Azure Certification",
    "pmp": "PMP",
    "scrum": "Scrum",
    "kubernetes": "Kubernetes Certification",
    "cka": "CKA",
    "cissp": "CISSP",
    "linux": "Linux Certification",
    "sql": "SQL Certification",
    "coursera": "Coursera",
    "red hat": "Red Hat",
    "oracle": "Oracle Certification",
    "google cloud": "Google Cloud Certification",
    "amazon web services": "AWS Certification",
    "terraform": "Terraform Certification",
}

_TECH_TOKEN_RE = re.compile(r"\b[a-z][a-z0-9\+\#\.\-/]{1,28}\b")
_DEGREE_PATTERN = re.compile(
    r"\b("
    r"b\.?\s*tech\.?|b\.?\s*e\.?|bachelor(?:'s)?(?:\s+of)?|b\.?\s*sc\.?|"
    r"m\.?\s*tech\.?|m\.?\s*e\.?|master(?:'s)?(?:\s+of)?|m\.?\s*sc\.?|mba|"
    r"ph\.?\s*d\.?|doctorate"
    r")\b",
    re.IGNORECASE,
)
_YEAR_PATTERN = re.compile(r"\b((?:19|20)\d{2})\b")
# Inline headers: "Skills: … Education: …" (line-start or mid-sentence after word boundary)
_INLINE_SECTION_SPLIT = re.compile(
    r"(?i)\b(education|certifications?|technical\s+skills?|skills?|"
    r"academic\s+background|professional\s+certifications?|experience)\s*:\s*",
)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


@lru_cache(maxsize=1)
def get_stopwords() -> Set[str]:
    words: Set[str] = set(SPACY_STOP) if SPACY_STOP else set()
    try:
        import nltk
        from nltk.corpus import stopwords as nltk_stop

        try:
            words |= set(nltk_stop.words("english"))
        except LookupError:  # pragma: no cover
            nltk.download("stopwords", quiet=True)
            words |= set(nltk_stop.words("english"))
    except Exception:
        pass
    words |= _NON_SKILL_BLOCKLIST
    return words


_NLP = None
_SKILL_MATCHER = None
_SKILL_ALIAS_TO_CANONICAL: Dict[str, str] = {}
_GENERIC_SKILL_TERMS = {
    "skill", "skills", "technology", "technologies", "tool", "tools", "framework",
    "frameworks", "language", "languages", "experience", "knowledge", "platform",
}


def get_nlp():
    global _NLP
    if _NLP is not None:
        return _NLP
    if spacy is None:
        return None
    for model_name in ("en_core_web_sm", "en_core_web_md"):
        try:
            _NLP = spacy.load(model_name)
            return _NLP
        except Exception:
            continue
    _NLP = spacy.blank("en")
    return _NLP


@lru_cache(maxsize=1)
def get_sentence_model() -> SentenceTransformer:
    return SentenceTransformer("all-MiniLM-L6-v2")


def _build_skill_alias_map(synonyms: Dict[str, List[str]]) -> Dict[str, str]:
    alias_map: Dict[str, str] = {}
    for canonical, aliases in synonyms.items():
        c = canonical.lower()
        alias_map[c] = canonical
        for alias in aliases:
            alias_map[alias.lower()] = canonical
    return alias_map


def _tech_lexicon(synonyms: Dict[str, List[str]] = SKILL_SYNONYMS) -> Set[str]:
    lex = set(_build_skill_alias_map(synonyms).keys())
    for k, aliases in synonyms.items():
        lex.add(k.lower())
        for a in aliases:
            lex.add(a.lower())
    return lex


@lru_cache(maxsize=1)
def _cached_tech_lexicon() -> Set[str]:
    return _tech_lexicon(SKILL_SYNONYMS)


def get_skill_phrase_matcher(synonyms: Dict[str, List[str]] = SKILL_SYNONYMS):
    global _SKILL_MATCHER, _SKILL_ALIAS_TO_CANONICAL
    nlp = get_nlp()
    if nlp is None or PhraseMatcher is None:
        return None
    if _SKILL_MATCHER is not None:
        return _SKILL_MATCHER

    _SKILL_ALIAS_TO_CANONICAL = _build_skill_alias_map(synonyms)
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    terms = sorted(_SKILL_ALIAS_TO_CANONICAL.keys())
    patterns = [nlp.make_doc(term) for term in terms]
    matcher.add("SKILL", patterns)
    _SKILL_MATCHER = matcher
    return _SKILL_MATCHER


def _normalize_skill_phrase(
    phrase: str,
    alias_map: Dict[str, str],
    stopwords: Set[str],
) -> Optional[str]:
    phrase = normalize_text(phrase)
    phrase = re.sub(r"[^a-z0-9\+\#\.\-/ ]", " ", phrase)
    phrase = re.sub(r"\s+", " ", phrase).strip()
    phrase = phrase.rstrip(".,;:")
    if not phrase:
        return None
    if phrase in alias_map:
        return alias_map[phrase]

    if _DEGREE_PATTERN.search(phrase) or any(k in phrase for k in EDU_KEYWORDS):
        return None
    if _CERTIFICATION_TRIGGER.search(phrase):
        return None

    tokens = [tok for tok in phrase.split() if tok and tok not in stopwords]
    if not tokens:
        return None
    if all(tok in _GENERIC_SKILL_TERMS for tok in tokens):
        return None
    if len(tokens) > 4:
        return None
    if not any(re.search(r"[a-z]", tok) for tok in tokens):
        return None
    candidate = " ".join(tokens)
    return alias_map.get(candidate, candidate)


def _is_likely_skill_token(
    token: str,
    alias_map: Dict[str, str],
    stopwords: Set[str],
    tech_lex: Set[str],
) -> bool:
    t = token.lower().strip()
    if not t or t in stopwords or t in _NON_SKILL_BLOCKLIST:
        return False
    if t in _CERT_PLATFORM_MARKERS or _DEGREE_PATTERN.search(t) or any(k == t or k in t for k in EDU_KEYWORDS):
        return False
    if _CERTIFICATION_TRIGGER.search(t):
        return False
    if t in alias_map or t in tech_lex:
        return True
    if re.search(r"[0-9\+\#]", t):
        return True
    if "." in t and len(t) <= 12:
        return True
    if len(t) <= 2:
        return False
    return False


def _matcher_skill_hits(text: str, synonyms: Dict[str, List[str]]) -> Set[str]:
    found: Set[str] = set()
    matcher = get_skill_phrase_matcher(synonyms)
    alias_map = _build_skill_alias_map(synonyms)
    if matcher is not None:
        nlp = get_nlp()
        doc = nlp(normalize_text(text))
        for _, start, end in matcher(doc):
            alias = doc[start:end].text.lower().strip()
            canonical = alias_map.get(alias, _SKILL_ALIAS_TO_CANONICAL.get(alias, alias))
            found.add(canonical)
    return found


def _extract_skill_candidates_raw(text: str, synonyms: Dict[str, List[str]]) -> Set[str]:
    nlp = get_nlp()
    stopwords = get_stopwords()
    alias_map = _build_skill_alias_map(synonyms)
    candidates: Set[str] = set()
    normalized = normalize_text(text)

    for token in _TECH_TOKEN_RE.findall(normalized):
        skill = _normalize_skill_phrase(token, alias_map, stopwords)
        if skill:
            candidates.add(skill)

    if nlp is not None:
        doc = nlp(normalized)
        if doc.has_annotation("DEP"):
            for chunk in doc.noun_chunks:
                skill = _normalize_skill_phrase(chunk.text, alias_map, stopwords)
                if skill:
                    candidates.add(skill)
        else:
            for sent in doc.sents if doc.has_annotation("SENT_START") else [doc]:
                for piece in re.split(r"[,;|/]", sent.text):
                    skill = _normalize_skill_phrase(piece, alias_map, stopwords)
                    if skill:
                        candidates.add(skill)

    candidates |= _matcher_skill_hits(text, synonyms)
    return candidates


def _split_document_sections(raw: str) -> Dict[str, str]:
    text = raw or ""
    parts = _INLINE_SECTION_SPLIT.split(text)
    out: Dict[str, str] = {"_preamble": (parts[0] or "").strip()}
    i = 1
    while i < len(parts):
        header = (parts[i] or "").lower().strip()
        body = (parts[i + 1] if i + 1 < len(parts) else "") or ""
        if "certification" in header:
            key = "certifications"
        elif "skill" in header:
            key = "skills"
        elif "experience" in header:
            key = "experience"
        else:
            key = "education"
        out[key] = (out.get(key, "") + "\n" + body.strip()).strip()
        i += 2
    return out


def _resume_text_for_skills(raw: str) -> str:
    """Omit certifications (and similar) so cert product names are not treated as skills."""
    sec = _split_document_sections(raw)
    chunks = [
        sec.get("_preamble", ""),
        sec.get("skills", ""),
        sec.get("experience", ""),
    ]
    joined = "\n".join(c.strip() for c in chunks if c and c.strip()).strip()
    return joined or (raw or "")


def extract_skills(
    text: str,
    synonyms: Dict[str, List[str]] = SKILL_SYNONYMS,
    *,
    source: str = "jd",
    jd_skills: Optional[Set[str]] = None,
) -> Set[str]:
    """
    source='jd': permissive technical extraction for job descriptions.
    source='resume': same candidates, filtered to known tech / JD overlap / skills-section cues.
    """
    jd_skills = jd_skills or set()
    skill_text = _resume_text_for_skills(text) if source == "resume" else (text or "")
    raw = _extract_skill_candidates_raw(skill_text, synonyms)
    sections = _split_document_sections(text)
    skills_body = sections.get("skills", "")
    stopwords = get_stopwords()
    alias_map = _build_skill_alias_map(synonyms)
    tech_lex = _cached_tech_lexicon()

    if source == "jd":
        filtered: Set[str] = set()
        for s in raw:
            tokens = s.lower().split()
            if any(_is_likely_skill_token(t, alias_map, stopwords, tech_lex) for t in tokens):
                filtered.add(s)
            elif s.lower() in tech_lex or s in jd_skills:
                filtered.add(s)
        # Exclude certification keywords to avoid mixing
        cert_keywords_lower = {k.lower() for k in CERT_KEYWORDS}
        filtered = {s for s in filtered if s.lower() not in cert_keywords_lower}
        return filtered

    # Resume: filter aggressively
    out: Set[str] = set()
    jd_lower = {j.lower() for j in jd_skills}
    matcher_hits_resume = _matcher_skill_hits(text, synonyms)

    def _jd_overlap(skill: str) -> bool:
        sl = skill.lower()
        if sl in jd_lower:
            return True
        for j in jd_lower:
            if j in sl or sl in j:
                if min(len(j), len(sl)) >= 3:
                    return True
        return False

    for s in raw:
        sl = s.lower()
        if sl in tech_lex or s in matcher_hits_resume:
            out.add(s)
            continue
        if _jd_overlap(s):
            out.add(s)
            continue
        if skills_body and sl in normalize_text(skills_body):
            if _is_likely_skill_token(sl.split()[0] if sl.split() else sl, alias_map, stopwords, tech_lex):
                out.add(s)

    # Skills-section lines: short comma-separated tech fragments
    if skills_body:
        for piece in re.split(r"[,;|/\n•·]+", skills_body):
            piece = piece.strip()
            if not piece or len(piece) > 48:
                continue
            skill = _normalize_skill_phrase(piece, alias_map, stopwords)
            if skill and (
                skill.lower() in tech_lex
                or _jd_overlap(skill)
                or _is_likely_skill_token(skill.lower(), alias_map, stopwords, tech_lex)
            ):
                out.add(skill)

    # Exclude certification keywords to avoid mixing
    cert_keywords_lower = {k.lower() for k in CERT_KEYWORDS}
    out = {s for s in out if s.lower() not in cert_keywords_lower}

    return out


def classify_entities(
    text: str,
    *,
    source: str = "resume",
    jd_skills: Optional[Set[str]] = None,
) -> Dict[str, Any]:
    jd_skills = jd_skills or set()
    skills = extract_skills(text, source=source, jd_skills=jd_skills)
    education = extract_education(text)
    certifications = extract_certifications(text)
    return {
        "skills": sorted(set(skills)),
        "education": education,
        "certifications": certifications,
    }


def _education_line_to_entry(line: str) -> Optional[Dict[str, Any]]:
    line_clean = line.strip()
    if len(line_clean) < 4:
        return None
    low = line_clean.lower()
    deg_match = _DEGREE_PATTERN.search(line_clean)
    if not deg_match and not any(k in low for k in EDU_KEYWORDS):
        return None

    degree = (deg_match.group(1) if deg_match else "").strip()
    if not degree:
        for k in EDU_KEYWORDS:
            if k in low:
                degree = k
                break

    year_m = _YEAR_PATTERN.findall(line_clean)
    year: Optional[int] = None
    if year_m:
        try:
            year = int(year_m[-1])
        except (ValueError, TypeError):
            pass

    institution = ""
    remainder = line_clean
    if deg_match:
        remainder = line_clean[deg_match.end() :].strip(" ,\t-|")

    year_str = str(year) if year else ""
    if year_str and remainder.endswith(year_str):
        remainder = remainder[: -len(year_str)].strip(" ,\t-|")

    comma_parts = [p.strip() for p in re.split(r"[,|]", remainder) if p.strip()]
    if comma_parts:
        institution = comma_parts[-1]
        if institution.lower() in EDU_KEYWORDS or len(institution) < 3:
            institution = comma_parts[0] if len(comma_parts) > 1 else ""

    if not institution and comma_parts:
        institution = comma_parts[0]

    if institution:
        institution = re.sub(r"\s*\b((?:19|20)\d{2})\.?\s*$", "", institution)
        institution = institution.strip(" .,|")

    nlp = get_nlp()
    if nlp is not None and len(line_clean) < 200:
        doc = nlp(line_clean)
        orgs = [e.text.strip() for e in doc.ents if e.label_ == "ORG"]
        if orgs and not institution:
            institution = orgs[0]

    summary_parts = [p for p in [degree, institution, str(year) if year else ""] if p]
    summary = ", ".join(dict.fromkeys(summary_parts)) if summary_parts else line_clean

    return {
        "degree": degree or "",
        "institution": institution,
        "year": year,
        "summary": summary,
    }


def extract_education(text: str) -> List[Dict[str, Any]]:
    sections = _split_document_sections(text)
    edu_blob = " ".join(
        filter(
            None,
            [
                sections.get("education", ""),
                sections.get("_preamble", ""),
            ],
        )
    )
    entries: List[Dict[str, Any]] = []
    seen: Set[str] = set()

    primary = sections.get("education", "")
    lines_src = primary if primary else (text or "")
    for line in re.split(r"[\n;]+", lines_src):
        ent = _education_line_to_entry(line)
        if ent:
            key = ent.get("summary", "") or str(ent)
            if key not in seen:
                seen.add(key)
                entries.append(ent)

    if not entries and edu_blob:
        ent = _education_line_to_entry(edu_blob[:500])
        if ent:
            entries.append(ent)

    if not entries:
        normalized = normalize_text(text)
        hits = [item for item in EDU_KEYWORDS if item in normalized]
        for h in sorted(set(hits)):
            entries.append({"degree": h, "institution": "", "year": None, "summary": h})

    return entries


def education_entries_to_strings(entries: List[Any]) -> List[str]:
    out: List[str] = []
    for e in entries or []:
        if isinstance(e, dict):
            out.append(str(e.get("summary") or ", ".join(
                filter(None, [e.get("degree"), e.get("institution"), str(e.get("year") or "")])
            )).strip() or "")
        else:
            out.append(str(e))
    return [x for x in out if x]


def extract_experience(text: str) -> Dict[str, float]:
    total_years = extract_total_experience_years(text)
    return {"total_years": round(total_years, 2)}


def _is_platform_only(text: str) -> bool:
    words = set(text.split())
    platform_words = set()
    for marker in _CERT_PLATFORM_MARKERS:
        platform_words.update(marker.split())
    return bool(words) and words.issubset(platform_words)


def _format_cert_name(name: str) -> str:
    normalized = normalize_text(name)
    
    # Strip redundant certification/certificate words to prevent duplication
    # e.g., "aws certification" becomes "aws" before lookup
    cleaned = re.sub(
        r"\b(?:certification|certificate|certified|course|specialization|program|bootcamp|badge|track|nanodegree)\b\s*",
        "",
        normalized,
        flags=re.IGNORECASE
    ).strip()
    
    if cleaned in _CERT_DISPLAY_OVERRIDES:
        return _CERT_DISPLAY_OVERRIDES[cleaned]
    if normalized in _CERT_DISPLAY_OVERRIDES:
        return _CERT_DISPLAY_OVERRIDES[normalized]
    
    tokens = cleaned.split() if cleaned else []
    out = []
    for tok in tokens:
        low = tok.lower()
        if low in _CERT_DISPLAY_OVERRIDES:
            out.append(_CERT_DISPLAY_OVERRIDES[low])
        elif low in {"and", "or", "of", "in", "for", "on", "the", "a", "an"}:
            out.append(low)
        elif low.isupper() or low in {"c++", "c#", "f#", "k8s"}:
            out.append(tok)
        else:
            out.append(tok.capitalize())
    return " ".join(out)


def _cert_rule_scan(lower_text: str) -> Set[str]:
    found: Set[str] = set()
    for canon, aliases in CERT_SYNONYMS.items():
        pool = [canon] + aliases
        if any(a.lower() in lower_text for a in pool):
            if canon in _CERT_PLATFORM_MARKERS and not _CERTIFICATION_TRIGGER.search(lower_text):
                continue
            if not _is_platform_only(canon):
                found.add(canon)
    for k in CERT_KEYWORDS:
        if k not in found and k in lower_text:
            if k in _CERT_PLATFORM_MARKERS and not _CERTIFICATION_TRIGGER.search(lower_text):
                continue
            if not _is_platform_only(k):
                found.add(k)
    return found


def _extract_certification_phrases(text: str) -> Set[str]:
    found: Set[str] = set()
    if not text:
        return found

    patterns = [
        re.compile(r"\b([a-z0-9\+\#\.\-/ ]{2,80}?)\s+(?:course|certificate|certification|specialization|program|bootcamp|badge|track|nanodegree)s?\b", re.IGNORECASE),
        re.compile(r"\b(?:certificate|certification|specialization|program|bootcamp|badge|track|nanodegree)s?\s+in\s+([a-z0-9\+\#\.\-/ ]{2,80})\b", re.IGNORECASE),
        re.compile(r"\b([a-z0-9\+\#\.\-/ ]{2,80}?)\s+certified\b", re.IGNORECASE),
        re.compile(r"\bcertified\s+in\s+([a-z0-9\+\#\.\-/ ]{2,80})\b", re.IGNORECASE),
    ]

    platform_re = re.compile(
        r"\b(?:" + "|".join(re.escape(p) for p in _CERT_PLATFORM_MARKERS) + r")\b",
        re.IGNORECASE,
    )
    for pattern in patterns:
        for match in pattern.finditer(text):
            phrase = normalize_text(match.group(1) or "")
            phrase = platform_re.sub("", phrase)
            phrase = re.sub(r"\s+", " ", phrase).strip()
            if not phrase or _is_platform_only(phrase):
                continue
            if _CERTIFICATION_TRIGGER.search(phrase):
                phrase = re.sub(_CERTIFICATION_TRIGGER, "certification", phrase)
            if not phrase.endswith("certification") and not phrase.endswith("certificate"):
                phrase = f"{phrase} certification"
            found.add(phrase)

    return found


def _embedding_cert_cluster(text_fragment: str, threshold: float = 0.72) -> Set[str]:
    """Optional: map noisy lines to canonical certs without relying on spaCy alone."""
    frag = text_fragment.strip()
    if len(frag) < 6:
        return set()
    model = get_sentence_model()
    labels = list(CERT_SYNONYMS.keys())
    if not labels:
        return set()
    try:
        emb_frag = model.encode(frag, normalize_embeddings=True)
        emb_labs = model.encode(labels, normalize_embeddings=True)
        fv = [float(x) for x in (emb_frag.flatten() if hasattr(emb_frag, "flatten") else emb_frag)]
        hits: Set[str] = set()
        rows = emb_labs.tolist() if hasattr(emb_labs, "tolist") else emb_labs
        for i, row in enumerate(rows):
            rv = [float(x) for x in row]
            s = sum(a * b for a, b in zip(rv, fv))
            if s >= threshold:
                hits.add(labels[i])
        return hits
    except Exception:
        return set()


def extract_certifications(text: str) -> List[str]:
    sections = _split_document_sections(text)
    cert_section = sections.get("certifications", "")
    lower_full = (text or "").lower()
    lower_cert = cert_section.lower() if cert_section else lower_full

    found: Set[str] = set()
    found |= _cert_rule_scan(lower_full)
    found |= _cert_rule_scan(lower_cert)
    found |= _extract_certification_phrases(text)

    if cert_section:
        for line in cert_section.splitlines():
            line_l = line.lower().strip("-• \t")
            if len(line_l) < 4:
                continue
            found |= _cert_rule_scan(line_l)
            found |= _extract_certification_phrases(line_l)
            if len(line) > 12:
                found |= _embedding_cert_cluster(line, threshold=0.74)

    cleaned: Set[str] = set()
    for cert in found:
        cert_name = _format_cert_name(cert)
        if cert_name and not _is_platform_only(cert_name.lower()):
            cleaned.add(cert_name)

    return sorted(cleaned)


def extract_required_experience_years(text: str) -> float:
    normalized = normalize_text(text)
    candidates = [float(num) for num in re.findall(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)", normalized)]
    if not candidates:
        range_matches = re.findall(
            r"(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)",
            normalized,
        )
        for low, high in range_matches:
            candidates.append(float(high))
    return max(candidates) if candidates else 0.0


def match_certifications(
    resume_certifications: List[str], jd_required_certifications: List[str]
) -> Dict[str, List[str]]:
    resume_set = set(resume_certifications or [])
    jd_set = set(jd_required_certifications or [])
    return {
        "matched": sorted(resume_set & jd_set),
        "missing": sorted(jd_set - resume_set),
        "extra": sorted(resume_set - jd_set),
    }


def _degree_level_value(degree: str) -> int:
    d = (degree or "").lower().strip()
    for key, lvl in DEGREE_LEVELS.items():
        if key in d or d.startswith(key):
            return lvl
    return DEGREE_LEVELS.get(d, 0)


def best_education_level(degrees: List[Any]) -> int:
    levels: List[int] = []
    for degree in degrees or []:
        if isinstance(degree, dict):
            levels.append(_degree_level_value(str(degree.get("degree", ""))))
        else:
            levels.append(_degree_level_value(str(degree)))
    return max(levels) if levels else 0


def extract_entities_with_spacy(text: str) -> Dict[str, List[str]]:
    nlp = get_nlp()
    if nlp is None:
        return {"organizations": [], "dates": []}
    doc = nlp(text)
    organizations = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"})
    dates = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "DATE"})
    return {"organizations": organizations, "dates": dates}


def _apply_alias_norm(skills: Set[str], synonyms: Dict[str, List[str]] = SKILL_SYNONYMS) -> Set[str]:
    amap = _build_skill_alias_map(synonyms)
    out: Set[str] = set()
    for s in skills:
        low = s.lower().strip()
        out.add(amap.get(low, s))
    return out


def skill_matching_score(
    resume_skills: Set[str],
    jd_skills: Set[str],
    *,
    embed_threshold: float = 0.78,
    partial_low: float = 0.55,
    synonyms: Dict[str, List[str]] = SKILL_SYNONYMS,
) -> Tuple[float, Dict]:
    if not jd_skills:
        return 0.0, {
            "exact_matches": [],
            "synonym_matches": [],
            "related_matches": [],
            "matched_skills": [],
            "partial_matches": [],
            "missing_skills": [],
            "irrelevant_skills": sorted(resume_skills),
            "base_score": 0.0,
            "bonus_score": 0.0,
        }

    J = _apply_alias_norm(jd_skills, synonyms)
    R_raw = _apply_alias_norm(resume_skills, synonyms)

    labels_j = sorted(J)
    r_list = sorted(R_raw)
    resume_to_jd: Dict[str, str] = {r: r for r in R_raw if r in J}

    model = get_sentence_model()
    emb_j = (
        model.encode(labels_j, normalize_embeddings=True, convert_to_numpy=True)
        if labels_j
        else None
    )
    emb_all_r = (
        model.encode(r_list, normalize_embeddings=True, convert_to_numpy=True)
        if r_list
        else None
    )
    j_index = {j: i for i, j in enumerate(labels_j)}
    r_index = {r: i for i, r in enumerate(r_list)}

    need_embed_r = [r for r in R_raw if r not in J]
    if emb_j is not None and emb_all_r is not None and need_embed_r:
        idxs = [r_index[r] for r in need_embed_r]
        sub_r = emb_all_r[np.array(idxs, dtype=np.intp)]
        sim_matrix = sub_r @ emb_j.T
        for row_i, r in enumerate(need_embed_r):
            best_idx = int(np.argmax(sim_matrix[row_i]))
            best_sim = float(sim_matrix[row_i, best_idx])
            if best_sim >= embed_threshold:
                resume_to_jd[r] = labels_j[best_idx]

    R_mapped = {resume_to_jd.get(r, r) for r in R_raw}
    matched_set = J & R_mapped
    missing_set = J - R_mapped
    extra_set = R_mapped - J

    exact_matches = sorted([j for j in matched_set if j in R_raw])
    synonym_matches = sorted([j for j in matched_set if j not in R_raw])

    partial: List[str] = []
    if emb_j is not None and emb_all_r is not None and r_list:
        for j in sorted(missing_set):
            ji = j_index.get(j)
            if ji is None:
                continue
            sims = emb_j[ji] @ emb_all_r.T
            best = float(np.max(sims))
            if partial_low <= best < embed_threshold:
                partial.append(j)

    base_score = (len(matched_set) / max(1.0, float(len(J)))) * 100.0
    score = max(0.0, min(100.0, round(base_score, 2)))

    matched_list = sorted(matched_set)
    return score, {
        "exact_matches": sorted(set(exact_matches)),
        "synonym_matches": sorted(set(synonym_matches)),
        "related_matches": [],
        "matched_skills": matched_list,
        "partial_matches": partial,
        "missing_skills": sorted(missing_set),
        "irrelevant_skills": sorted(extra_set),
        "base_score": round(base_score, 2),
        "bonus_score": 0.0,
    }


def _year_from_token(token: str) -> int:
    token = token.lower().strip()
    if token in {"present", "current", "now"}:
        return datetime.now().year
    return int(token)


def extract_total_experience_years(text: str) -> float:
    patterns = [
        r"(\d{4})\s*[-to]+\s*(present|current|now|\d{4})",
        r"(\d+)\+?\s+years",
    ]
    years = 0.0
    normalized = text.lower()

    for start, end in re.findall(patterns[0], normalized):
        start_year = _year_from_token(start)
        end_year = _year_from_token(end)
        if end_year >= start_year:
            years += float(end_year - start_year)

    if years == 0.0:
        year_numbers = [float(x) for x in re.findall(patterns[1], normalized)]
        if year_numbers:
            years = max(year_numbers)
    return years


def extract_relevant_experience_years(text: str, jd_skills: Set[str]) -> float:
    if not jd_skills:
        return 0.0
    total = extract_total_experience_years(text)
    resume_skills = extract_skills(text, source="resume", jd_skills=jd_skills)
    Jr = _apply_alias_norm(jd_skills)
    Rr = _apply_alias_norm(resume_skills)
    overlap = len(Jr & Rr)
    ratio = overlap / max(1, len(Jr))
    return round(total * ratio, 2)


def extract_degree(text: str) -> str:
    degree_patterns = ["b.tech", "b.e", "bachelor", "mba", "m.tech", "master", "phd"]
    lower = text.lower()
    for degree in degree_patterns:
        if degree in lower:
            return degree
    return "not_found"


def evaluate_format(resume_text: str, template_text: str) -> Dict:
    resume_sections = [section for section in SECTION_ORDER if section in resume_text.lower()]
    template_sections = [section for section in SECTION_ORDER if section in template_text.lower()]

    missing_sections = [section for section in template_sections if section not in resume_sections]
    order_correct = resume_sections == sorted(
        resume_sections, key=lambda sec: SECTION_ORDER.index(sec)
    )

    consistency_points = 100
    if missing_sections:
        consistency_points -= min(40, len(missing_sections) * 10)
    if not order_correct:
        consistency_points -= 20

    return {
        "format_score": max(0, consistency_points),
        "missing_sections": missing_sections,
        "order_correct": order_correct,
    }


def generate_ai_feedback(results: Dict) -> Dict:
    strengths = []
    weaknesses = []

    if results["skill_score"] >= 70:
        strengths.append("Strong alignment with required skills.")
    else:
        weaknesses.append("Skill coverage is below target.")

    if results["similarity_score"] >= 70:
        strengths.append("Resume and JD have high semantic alignment.")
    else:
        weaknesses.append("Profile language is not closely aligned to the JD.")

    breakdown = results.get("skill_breakdown", {})
    missing_skills = breakdown.get("missing_skills", [])
    extra_skills = breakdown.get("irrelevant_skills", [])
    suggestions = [
        "Add quantified achievements tied to JD requirements.",
        "Highlight project bullets for required tools and responsibilities.",
    ]
    if extra_skills:
        suggestions.append(
            f"Emphasize JD-relevant skills over less aligned items: {', '.join(extra_skills[:5])}."
        )

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "missing_skills": missing_skills,
        "improvement_suggestions": suggestions,
    }

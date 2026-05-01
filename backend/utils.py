import re
from datetime import datetime
from functools import lru_cache
from typing import Dict, List, Set, Tuple

try:
    import spacy
    from spacy.matcher import PhraseMatcher
except Exception:  # pragma: no cover
    spacy = None
    PhraseMatcher = None

from sentence_transformers import SentenceTransformer

SKILL_SYNONYMS = {
    "react": ["react.js", "frontend", "javascript"],
    "python": ["django", "flask"],
    "aws": ["amazon web services", "ec2", "lambda"],
    "gcp": ["google cloud", "bigquery", "cloud run"],
}

KNOWN_SKILLS = sorted(
    set(SKILL_SYNONYMS.keys()).union(
        {term for aliases in SKILL_SYNONYMS.values() for term in aliases}
    )
)
EDU_KEYWORDS = ["bachelor", "master", "phd", "b.tech", "m.tech", "mba", "b.sc", "m.sc", "degree"]
CERT_KEYWORDS = ["aws", "gcp", "azure", "pmp", "scrum", "kubernetes", "cka", "cissp"]
CERT_SYNONYMS = {
    "aws": ["amazon web services", "aws certified"],
    "gcp": ["google cloud", "google cloud platform", "gcp certified"],
    "azure": ["microsoft azure", "azure certified"],
    "pmp": ["project management professional"],
    "scrum": ["scrum master", "csm", "psm"],
    "kubernetes": ["k8s", "ckad"],
    "cka": ["certified kubernetes administrator"],
    "cissp": ["certified information systems security professional"],
}
DEGREE_LEVELS = {
    "b.sc": 1,
    "bachelor": 1,
    "b.tech": 1,
    "m.sc": 2,
    "master": 2,
    "m.tech": 2,
    "mba": 2,
    "phd": 3,
}

SECTION_ORDER = [
    "summary",
    "experience",
    "education",
    "skills",
    "certifications",
    "projects",
]


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


_NLP = None
_SKILL_MATCHER = None
_SKILL_ALIAS_TO_CANONICAL: Dict[str, str] = {}


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
        alias_map[canonical.lower()] = canonical
        for alias in aliases:
            alias_map[alias.lower()] = canonical
    return alias_map


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


def extract_skills(text: str, synonyms: Dict[str, List[str]] = SKILL_SYNONYMS) -> Set[str]:
    nlp = get_nlp()
    matcher = get_skill_phrase_matcher(synonyms)
    if nlp is None or matcher is None:
        normalized = normalize_text(text)
        found = set()
        for base_skill, terms in synonyms.items():
            candidates = [base_skill] + terms
            if any(term in normalized for term in candidates):
                found.add(base_skill)
        return found

    doc = nlp(normalize_text(text))
    found = set()
    for _, start, end in matcher(doc):
        alias = doc[start:end].text.lower().strip()
        canonical = _SKILL_ALIAS_TO_CANONICAL.get(alias, alias)
        found.add(canonical)
    return found


def extract_education(text: str) -> List[str]:
    normalized = normalize_text(text)
    hits = [item for item in EDU_KEYWORDS if item in normalized]
    return sorted(set(hits))


def extract_experience(text: str) -> Dict[str, float]:
    total_years = extract_total_experience_years(text)
    return {"total_years": round(total_years, 2)}


def extract_certifications(text: str) -> List[str]:
    lower = text.lower()
    found = []
    for cert in CERT_KEYWORDS:
        aliases = [cert] + CERT_SYNONYMS.get(cert, [])
        if any(alias in lower for alias in aliases):
            found.append(cert)
    return sorted(set(found))


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
        "matched": sorted(resume_set.intersection(jd_set)),
        "missing": sorted(jd_set - resume_set),
        "extra": sorted(resume_set - jd_set),
    }


def best_education_level(degrees: List[str]) -> int:
    levels = [DEGREE_LEVELS.get(degree, 0) for degree in (degrees or [])]
    return max(levels) if levels else 0


def extract_entities_with_spacy(text: str) -> Dict[str, List[str]]:
    nlp = get_nlp()
    if nlp is None:
        return {"organizations": [], "dates": []}
    doc = nlp(text)
    organizations = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"})
    dates = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "DATE"})
    return {"organizations": organizations, "dates": dates}


@lru_cache(maxsize=2048)
def _cached_skill_embedding(skill: str) -> Tuple[float, ...]:
    model = get_sentence_model()
    vector = model.encode(skill, normalize_embeddings=True)
    return tuple(float(value) for value in vector)


def _cosine_similarity(skill_a: str, skill_b: str) -> float:
    emb_a = _cached_skill_embedding(skill_a.lower().strip())
    emb_b = _cached_skill_embedding(skill_b.lower().strip())
    return sum(a * b for a, b in zip(emb_a, emb_b))


def skill_matching_score(resume_skills: Set[str], jd_skills: Set[str]) -> Tuple[float, Dict]:
    if not jd_skills:
        return 0.0, {
            "exact_matches": [],
            "synonym_matches": [],
            "related_matches": [],
            "irrelevant_skills": list(resume_skills),
        }

    matched_jd_skills: Set[str] = set()
    partial_jd_skills: Set[str] = set()
    used_resume_skills: Set[str] = set()
    exact_matches: List[str] = []
    synonym_matches: List[str] = []
    related_matches: List[str] = []

    for jd_skill in sorted(jd_skills):
        best_resume_skill = None
        best_score = -1.0
        for resume_skill in sorted(resume_skills):
            similarity = _cosine_similarity(jd_skill, resume_skill)
            if similarity > best_score:
                best_score = similarity
                best_resume_skill = resume_skill

        if best_resume_skill is None:
            continue

        if best_score > 0.75:
            matched_jd_skills.add(jd_skill)
            used_resume_skills.add(best_resume_skill)
            if jd_skill == best_resume_skill:
                exact_matches.append(jd_skill)
            else:
                synonym_matches.append(jd_skill)
        elif best_score >= 0.5:
            partial_jd_skills.add(jd_skill)
            used_resume_skills.add(best_resume_skill)
            related_matches.append(jd_skill)

    missing_skills = sorted(jd_skills - matched_jd_skills - partial_jd_skills)
    irrelevant_skills = sorted(resume_skills - used_resume_skills)

    raw_score = (
        1.0 * len(matched_jd_skills)
        + 0.6 * len(related_matches)
        - 0.2 * len(irrelevant_skills)
    )
    max_score = max(1.0, float(len(jd_skills)))
    score = max(0.0, min(100.0, (raw_score / max_score) * 100.0))

    return score, {
        "exact_matches": sorted(exact_matches),
        "synonym_matches": sorted(synonym_matches),
        "related_matches": sorted(related_matches),
        "matched_skills": sorted(matched_jd_skills),
        "partial_matches": sorted(partial_jd_skills),
        "missing_skills": missing_skills,
        "irrelevant_skills": irrelevant_skills,
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
    resume_skills = extract_skills(text)
    overlap = len(resume_skills.intersection(jd_skills))
    ratio = overlap / max(1, len(jd_skills))
    return round(total * ratio, 2)


def extract_degree(text: str) -> str:
    degree_patterns = ["b.tech", "bachelor", "mba", "m.tech", "master", "phd"]
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

    missing_skills = results["skill_breakdown"].get("irrelevant_skills", [])
    suggestions = [
        "Add quantified achievements tied to JD requirements.",
        "Highlight project bullets for required tools and responsibilities.",
    ]
    if missing_skills:
        suggestions.append(
            f"Replace or reframe less relevant skills: {', '.join(missing_skills[:5])}."
        )

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "missing_skills": missing_skills,
        "improvement_suggestions": suggestions,
    }

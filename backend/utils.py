import re
from datetime import datetime
from typing import Dict, List, Set, Tuple

try:
    import spacy
except Exception:  # pragma: no cover
    spacy = None

SKILL_SYNONYMS = {
    "react": ["react.js", "frontend", "javascript"],
    "python": ["django", "flask"],
    "aws": ["amazon web services", "ec2", "lambda"],
    "gcp": ["google cloud", "bigquery", "cloud run"],
}

KNOWN_SKILLS = sorted(set(SKILL_SYNONYMS.keys()))
EDU_KEYWORDS = ["bachelor", "master", "phd", "b.tech", "m.tech", "mba", "b.sc", "m.sc", "degree"]
CERT_KEYWORDS = ["aws", "gcp", "azure", "pmp", "scrum", "kubernetes", "cka", "cissp"]

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


def extract_skills(text: str, synonyms: Dict[str, List[str]] = SKILL_SYNONYMS) -> Set[str]:
    normalized = normalize_text(text)
    found = set()
    for base_skill, terms in synonyms.items():
        candidates = [base_skill] + terms
        if any(term in normalized for term in candidates):
            found.add(base_skill)
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
    found = [cert for cert in CERT_KEYWORDS if cert in lower]
    return sorted(set(found))


def extract_entities_with_spacy(text: str) -> Dict[str, List[str]]:
    nlp = get_nlp()
    if nlp is None:
        return {"organizations": [], "dates": []}
    doc = nlp(text)
    organizations = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"})
    dates = sorted({ent.text.strip() for ent in doc.ents if ent.label_ == "DATE"})
    return {"organizations": organizations, "dates": dates}


def skill_matching_score(resume_skills: Set[str], jd_skills: Set[str]) -> Tuple[float, Dict]:
    if not jd_skills:
        return 0.0, {
            "exact_matches": [],
            "synonym_matches": [],
            "related_matches": [],
            "irrelevant_skills": list(resume_skills),
        }

    exact_matches = sorted(resume_skills.intersection(jd_skills))
    synonym_matches: List[str] = []
    related_matches: List[str] = []
    irrelevant_skills: List[str] = []

    for skill in sorted(resume_skills - set(exact_matches)):
        if skill in SKILL_SYNONYMS and any(
            related in jd_skills for related in SKILL_SYNONYMS[skill]
        ):
            synonym_matches.append(skill)
        elif any(skill in terms for terms in SKILL_SYNONYMS.values()):
            related_matches.append(skill)
        else:
            irrelevant_skills.append(skill)

    raw_score = (
        1.0 * len(exact_matches)
        + 0.6 * len(synonym_matches)
        + 0.3 * len(related_matches)
        - 0.2 * len(irrelevant_skills)
    )
    max_score = max(1.0, float(len(jd_skills)))
    score = max(0.0, min(100.0, (raw_score / max_score) * 100.0))

    return score, {
        "exact_matches": exact_matches,
        "synonym_matches": synonym_matches,
        "related_matches": related_matches,
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

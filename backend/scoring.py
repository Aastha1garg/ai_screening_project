from typing import Dict
import re

import numpy as np

from utils import (
    best_education_level,
    cached_text_embedding,
    evaluate_format,
    extract_certifications,
    extract_education,
    extract_experience,
    extract_entities_with_spacy,
    extract_degree,
    extract_required_experience_years,
    extract_relevant_experience_years,
    extract_skills,
    extract_total_experience_years,
    get_jd_embedding,
    match_certifications,
    skill_matching_score,
    classify_entities,
    trim_text,
)

# Long CVs/JDs dominate encode time; trim for similarity while keeping signal.
_SIMILARITY_MAX_CHARS = 6000


def cosine_similarity_score(resume_text: str, jd_text: str) -> float:
    r = trim_text(resume_text or "", _SIMILARITY_MAX_CHARS)
    j = trim_text(jd_text or "", _SIMILARITY_MAX_CHARS)
    emb_r = cached_text_embedding(r)
    emb_j = get_jd_embedding(j)
    similarity = float(np.dot(emb_r, emb_j))
    return round(max(0.0, similarity) * 100.0, 2)


def education_score(resume_education: list, jd_education: list) -> tuple[float, str]:
    resume_level = best_education_level(resume_education)
    jd_level = best_education_level(jd_education)
    if resume_level == 0 or jd_level == 0:
        return 50.0, "unknown"
    if resume_level == jd_level:
        return 95.0, "exact"
    if resume_level > jd_level:
        # Higher qualification bonus while preserving interpretability.
        return 100.0, "higher"
    return 40.0, "lower"


def normalize_score_to_range(score: float, min_score: float = 60.0, max_score: float = 90.0) -> float:
    """Normalize a primary score of 0-100 into a target display range."""
    clamped = min(max(score, 0.0), 100.0)
    normalized = (clamped * ((max_score - min_score) / 100.0)) + min_score
    return round(normalized, 2)


def certification_score(cert_match: dict) -> float:
    required = len(cert_match.get("matched", [])) + len(cert_match.get("missing", []))
    if required == 0:
        return 70.0
    return round((len(cert_match.get("matched", [])) / required) * 100.0, 2)


def identify_critical_skills(jd_text: str, jd_skills: set) -> set:
    if not jd_text or not jd_skills:
        return set()

    jd_lower = jd_text.lower()
    critical_phrases = [
        "must", "must have", "required", "require", "need", "needs", "essential",
        "strongly preferred", "preferred", "critical", "priority", "should have",
    ]
    critical = set()
    for line in re.split(r"[\n\r;]+", jd_text):
        line_low = line.strip().lower()
        if not line_low:
            continue
        if any(phrase in line_low for phrase in critical_phrases):
            for skill in jd_skills:
                normalized = skill.lower().strip()
                if not normalized:
                    continue
                if re.search(rf"\b{re.escape(normalized)}\b", line_low):
                    critical.add(skill)

    if not critical:
        # fallback: treat the first 20% of JD skills as critical when no explicit markers exist
        top_count = max(1, len(jd_skills) // 5)
        sorted_skills = sorted(jd_skills)
        critical = set(sorted_skills[:top_count])

    return critical


def experience_score(total_exp: float, required_exp: float) -> tuple[float, str]:
    if total_exp <= 0:
        return 0.0, "low"
    if required_exp <= 0:
        return min(100.0, round(total_exp * 15, 2)), "unknown_requirement"
    if total_exp >= required_exp:
        bonus = min(10.0, ((total_exp - required_exp) / max(required_exp, 1.0)) * 10.0)
        return min(100.0, round(90.0 + bonus, 2)), "meets_or_exceeds"
    if total_exp >= required_exp * 0.8:
        return 70.0, "close"
    return 35.0, "low"


def run_resume_screening(resume_text: str, jd_text: str, template_text: str = "") -> Dict:
    jd_entities = classify_entities(jd_text, source="jd")
    resume_entities = classify_entities(resume_text, source="resume", jd_skills=set(jd_entities["skills"]))

    jd_skills = set(jd_entities["skills"])
    resume_skills = set(resume_entities["skills"])

    skill_score, skill_breakdown = skill_matching_score(resume_skills, jd_skills)
    similarity = cosine_similarity_score(resume_text, jd_text)
    total_experience = extract_total_experience_years(resume_text)
    required_experience = extract_required_experience_years(jd_text)
    relevant_experience = extract_relevant_experience_years(resume_text, jd_skills)
    experience_detail = extract_experience(resume_text)

    education = resume_entities["education"]
    if not education:
        fallback_degree = extract_degree(resume_text)
        education = (
            []
            if fallback_degree == "not_found"
            else [
                {
                    "degree": fallback_degree,
                    "institution": "",
                    "year": None,
                    "summary": fallback_degree,
                }
            ]
        )
    jd_education = jd_entities["education"]
    edu_score, education_match = education_score(education, jd_education)

    certifications = resume_entities["certifications"]
    required_certifications = jd_entities["certifications"]
    cert_match = match_certifications(certifications, required_certifications)
    cert_score = certification_score(cert_match)

    format_result = evaluate_format(resume_text, template_text or jd_text)
    exp_score, experience_match = experience_score(total_experience, required_experience)
    format_score = round(float(format_result.get("format_score", 0) or 0), 2)

    result = {
        "skill_score": round(skill_score, 2),
        "similarity_score": similarity,
        "experience_score": round(exp_score, 2),
        "education_score": round(edu_score, 2),
        "certification_score": round(cert_score, 2),
        "format_score": format_score,
    }

    # Keep scoring robust if any component is absent in future refactors.
    result.setdefault("similarity_score", 0)
    result.setdefault("experience_score", 0)
    result.setdefault("education_score", 0)
    result.setdefault("certification_score", 0)
    result.setdefault("format_score", 0)

    critical_skills = identify_critical_skills(jd_text, jd_skills)
    missing_skills = sorted(skill_breakdown.get("missing_skills", []))
    missing_critical = [skill for skill in missing_skills if skill in critical_skills]
    missing_noncritical = [skill for skill in missing_skills if skill not in critical_skills]
    penalty = (len(missing_critical) * 5) + (len(missing_noncritical) * 2)

    weighted_score = round(
        (0.4 * result["skill_score"])
        + (0.2 * result.get("similarity_score", 0))
        + (0.15 * result.get("experience_score", 0))
        + (0.10 * result.get("education_score", 0))
        + (0.10 * result.get("certification_score", 0))
        + (0.05 * result.get("format_score", 0)),
        2,
    )
    adjusted_score = max(0.0, round(weighted_score - penalty, 2))
    final_score = normalize_score_to_range(adjusted_score)

    result["combined_score"] = weighted_score
    result["penalty"] = penalty
    result["missing_critical_skills"] = missing_critical
    result["missing_noncritical_skills"] = missing_noncritical
    result["critical_skills"] = sorted(critical_skills)
    result["score_adjusted"] = adjusted_score
    result["final_score"] = final_score

    entities = extract_entities_with_spacy(resume_text)
    partial_matches = sorted(skill_breakdown.get("partial_matches", []))
    matched_skill_set = set(skill_breakdown.get("matched_skills", []))
    extra_skills = sorted(skill_breakdown.get("irrelevant_skills", []))
    missing_skills = sorted(skill_breakdown.get("missing_skills", []))

    # Calculate skill match ratio for sentiment
    matched_count = len(matched_skill_set)
    missing_count = len(missing_skills)
    total_required = matched_count + missing_count
    
    if total_required > 0:
        skill_match_ratio = (matched_count / total_required) * 100
    else:
        skill_match_ratio = 100  # If no skills required, consider it perfect match
    
    if skill_match_ratio > 70:
        sentiment = "positive"
        profile_label = "Strong Match"
    elif skill_match_ratio >= 40:
        sentiment = "neutral"
        profile_label = "Moderate Match"
    else:
        sentiment = "weak"
        profile_label = "Needs Improvement"

    result.update({
        "skill_breakdown": skill_breakdown,
        "format_check": format_result,
        "resume_skills": sorted(resume_skills),
        "jd_skills": sorted(jd_skills),
        "matched_skills": sorted(matched_skill_set),
        "missing_skills": missing_skills,
        "extra_skills": extra_skills,
        "partial_matches": partial_matches,
        "experience": {
            "total_years": round(total_experience, 2),
            "relevant_years": round(relevant_experience, 2),
            "required_years": round(required_experience, 2),
            "detail": experience_detail,
        },
        "education": education,
        "required_education": jd_education,
        "certifications_all": certifications,
        "certifications_required": required_certifications,
        "certifications_matched": cert_match.get("matched", []),
        "certifications_missing": cert_match.get("missing", []),
        "certifications_extra": cert_match.get("extra", []),
        "education_match": education_match,
        "experience_match": experience_match,
        "score_breakdown": {
            "skill": result["skill_score"],
            "similarity": result.get("similarity_score", 0),
            "experience": result.get("experience_score", 0),
            "education": result.get("education_score", 0),
            "certification": result.get("certification_score", 0),
            "format": result.get("format_score", 0),
            # Backward-compatible aliases for existing consumers.
            "skill_score": result["skill_score"],
            "similarity_score": result.get("similarity_score", 0),
            "exp_score": result.get("experience_score", 0),
            "edu_score": result.get("education_score", 0),
            "cert_score": result.get("certification_score", 0),
            "weights": {
                "skill": 0.4,
                "similarity": 0.2,
                "experience": 0.15,
                "education": 0.10,
                "certification": 0.10,
                "format": 0.05,
                "penalty": "-5 per critical missing, -2 per normal missing",
            },
            "formula": "final_score = normalize(weighted_score - penalties, 60-90)",
            "penalty": result.get("penalty", 0),
            "missing_critical_skills": result.get("missing_critical_skills", []),
            "missing_noncritical_skills": result.get("missing_noncritical_skills", []),
        },
        "entities": entities,
        "sentiment": sentiment,
        "profile_label": profile_label,
    })
    matched_skills = result["matched_skills"]
    missing_skills = result["missing_skills"]
    # AI feedback is generated on-demand via /ai-feedback endpoint.
    result["ai_feedback"] = {}
    return result

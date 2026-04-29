from functools import lru_cache
from typing import Dict

from sentence_transformers import SentenceTransformer, util

from utils import (
    evaluate_format,
    extract_certifications,
    extract_education,
    extract_experience,
    extract_entities_with_spacy,
    extract_degree,
    extract_relevant_experience_years,
    extract_skills,
    extract_total_experience_years,
    skill_matching_score,
)


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer("all-MiniLM-L6-v2")


def cosine_similarity_score(resume_text: str, jd_text: str) -> float:
    model = get_embedding_model()
    embeddings = model.encode([resume_text, jd_text], convert_to_tensor=True)
    similarity = util.cos_sim(embeddings[0], embeddings[1]).item()
    return round(max(0.0, similarity) * 100.0, 2)


def education_score(resume_text: str, jd_text: str) -> float:
    degree = extract_degree(resume_text)
    jd_lower = jd_text.lower()
    if degree == "not_found":
        return 0.0
    if degree in jd_lower:
        return 100.0
    return 70.0


def certification_score(resume_text: str, jd_text: str) -> float:
    certs = extract_certifications(resume_text)
    if not certs:
        return 0.0
    jd_lower = jd_text.lower()
    matched = [cert for cert in certs if cert in jd_lower]
    if matched:
        return 100.0 * len(matched) / len(certs)
    return 50.0


def experience_score(resume_text: str, jd_text: str) -> float:
    jd_skills = extract_skills(jd_text)
    total_exp = extract_total_experience_years(resume_text)
    relevant_exp = extract_relevant_experience_years(resume_text, jd_skills)
    if total_exp <= 0:
        return 0.0
    return min(100.0, round((relevant_exp / total_exp) * 100.0, 2))


def run_resume_screening(resume_text: str, jd_text: str, template_text: str = "") -> Dict:
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)

    skill_score, skill_breakdown = skill_matching_score(resume_skills, jd_skills)
    similarity = cosine_similarity_score(resume_text, jd_text)
    exp_score = experience_score(resume_text, jd_text)
    edu_score = education_score(resume_text, jd_text)
    cert_score = certification_score(resume_text, jd_text)

    final_score = round(
        (0.4 * skill_score)
        + (0.2 * similarity)
        + (0.2 * exp_score)
        + (0.1 * edu_score)
        + (0.1 * cert_score),
        2,
    )

    format_result = evaluate_format(resume_text, template_text or jd_text)
    total_experience = extract_total_experience_years(resume_text)
    relevant_experience = extract_relevant_experience_years(resume_text, jd_skills)
    education = extract_education(resume_text)
    certifications = extract_certifications(resume_text)
    entities = extract_entities_with_spacy(resume_text)
    partial_matches = sorted(result for result in skill_breakdown.get("synonym_matches", []))

    if final_score >= 75:
        sentiment = "positive"
        profile_label = "Strong Profile"
    elif final_score >= 55:
        sentiment = "neutral"
        profile_label = "Needs Improvement"
    else:
        sentiment = "weak"
        profile_label = "Needs Improvement"

    result = {
        "skill_score": round(skill_score, 2),
        "similarity_score": similarity,
        "experience_score": round(exp_score, 2),
        "education_score": round(edu_score, 2),
        "certification_score": round(cert_score, 2),
        "final_score": final_score,
        "skill_breakdown": skill_breakdown,
        "format_check": format_result,
        "resume_skills": sorted(resume_skills),
        "jd_skills": sorted(jd_skills),
        "matched_skills": sorted(
            skill_breakdown.get("exact_matches", []) + skill_breakdown.get("synonym_matches", [])
        ),
        "missing_skills": sorted(list(jd_skills - resume_skills)),
        "partial_matches": partial_matches,
        "experience": {
            "total_years": round(total_experience, 2),
            "relevant_years": round(relevant_experience, 2),
            "detail": extract_experience(resume_text),
        },
        "education": education or [extract_degree(resume_text)],
        "certifications": certifications,
        "entities": entities,
        "sentiment": sentiment,
        "profile_label": profile_label,
    }
    matched_skills = result["matched_skills"]
    missing_skills = result["missing_skills"]
    # AI feedback is generated on-demand via /ai-feedback endpoint.
    result["ai_feedback"] = {}
    return result

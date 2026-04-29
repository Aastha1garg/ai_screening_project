import json
import os
from typing import Any, Dict, List

import requests


GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_GROQ_MODEL = "llama3-8b-8192"
DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.1-8b-instruct:free"


def _as_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_feedback(payload: Dict[str, Any], missing_skills: List[str]) -> Dict[str, Any]:
    strengths = _as_list(payload.get("strengths"))
    weaknesses = _as_list(payload.get("weaknesses"))
    suggestions = _as_list(payload.get("suggestions"))
    returned_missing = _as_list(payload.get("missing_skills")) or missing_skills

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "missing_skills": returned_missing,
        "suggestions": suggestions,
    }


def _rule_based_feedback(score: float, matched_skills: List[str], missing_skills: List[str]) -> Dict[str, Any]:
    if score >= 80:
        strengths = ["Strong overall alignment with the role requirements."]
        weaknesses = ["Only minor tailoring gaps remain in role-specific phrasing."]
    elif score >= 60:
        strengths = ["Moderate fit with useful foundational skills."]
        weaknesses = ["Skill and positioning gaps reduce competitiveness."]
    else:
        strengths = ["Some transferable strengths are present."]
        weaknesses = ["Core requirement alignment is currently low."]

    top_matches = ", ".join(matched_skills[:5]) if matched_skills else "relevant domain skills"
    top_missing = ", ".join(missing_skills[:5]) if missing_skills else "priority JD skills"

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "missing_skills": missing_skills,
        "suggestions": [
            f"Highlight impact-oriented achievements around {top_matches}.",
            f"Add concrete evidence for missing skills such as {top_missing}.",
            "Tailor bullets to mirror JD keywords and required responsibilities.",
        ],
    }


def _build_prompt(
    jd_text: str,
    resume_text: str,
    matched_skills: List[str],
    missing_skills: List[str],
    score: float,
) -> str:
    return (
        "You are an expert recruiter.\n"
        "Analyze the resume based on the job description.\n\n"
        "Provide response in JSON:\n"
        '{ "strengths": [], "weaknesses": [], "missing_skills": [], "suggestions": [] }\n\n'
        "Consider:\n"
        "- Skill gaps\n"
        "- Experience relevance\n"
        "- Resume quality\n"
        "- ATS optimization\n\n"
        f"Candidate score: {score}\n"
        f"Matched skills: {matched_skills}\n"
        f"Missing skills: {missing_skills}\n\n"
        f"Job description:\n{jd_text}\n\n"
        f"Resume:\n{resume_text}"
    )


def _call_groq(prompt: str) -> Dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return {}
    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL
    response = requests.post(
        GROQ_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.3,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        },
        timeout=25,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def _call_openrouter(prompt: str) -> Dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return {}
    model = os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL).strip() or DEFAULT_OPENROUTER_MODEL
    response = requests.post(
        OPENROUTER_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost",
            "X-Title": "AI Resume Screening",
        },
        json={
            "model": model,
            "temperature": 0.3,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        },
        timeout=25,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def generate_ai_feedback(
    jd_text: str,
    resume_text: str,
    matched_skills: List[str],
    missing_skills: List[str],
    score: float,
) -> Dict[str, Any]:
    prompt = _build_prompt(jd_text, resume_text, matched_skills, missing_skills, score)
    try:
        payload = _call_groq(prompt) or _call_openrouter(prompt)
        if payload:
            return _normalize_feedback(payload, missing_skills)
    except Exception:
        pass
    return _rule_based_feedback(score, matched_skills, missing_skills)

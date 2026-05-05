import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Callable, Optional
from pydantic import BaseModel
from scoring import run_resume_screening


class ScoringProgress(BaseModel):
    """Message type for streaming scoring progress"""
    event: str  # "started", "processing", "completed", "error"
    total_pairs: int
    current_pair: int
    current_resume: str
    current_jd: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress_percent: float = 0.0


class WeightedScoringStrategy:
    """
    Optimized scoring strategy using weighted formula and semantic similarity
    """
    
    # Weights for different scoring components
    WEIGHTS = {
        "skill_match": 0.35,  # Skill matching is critical
        "similarity": 0.25,   # Overall semantic similarity
        "experience": 0.20,   # Experience level
        "education": 0.15,    # Education match
        "format": 0.05,       # Resume format quality
    }
    
    @staticmethod
    def calculate_weighted_score(
        skill_score: float,
        similarity_score: float,
        experience_score: float,
        education_score: float,
        format_score: float,
    ) -> float:
        """
        Calculate final score using weighted formula
        
        All input scores should be 0-100
        """
        weighted_score = (
            (skill_score * WeightedScoringStrategy.WEIGHTS["skill_match"]) +
            (similarity_score * WeightedScoringStrategy.WEIGHTS["similarity"]) +
            (experience_score * WeightedScoringStrategy.WEIGHTS["experience"]) +
            (education_score * WeightedScoringStrategy.WEIGHTS["education"]) +
            (format_score * WeightedScoringStrategy.WEIGHTS["format"])
        )
        return round(min(100.0, max(0.0, weighted_score)), 2)


async def stream_resume_screening(
    resumes: List[tuple],  # List of (name, text) tuples
    jds: List[tuple],      # List of (name, text) tuples
    template_text: str,
    callback: Callable[[ScoringProgress], Any],  # Called for each progress update
) -> List[Dict[str, Any]]:
    """
    Process resumes incrementally and stream results via callback
    
    Args:
        resumes: List of (name, text) tuples
        jds: List of (name, text) tuples
        template_text: Optional template resume text
        callback: Async function to call with each ScoringProgress update
        
    Returns:
        List of all screening results
    """
    total_pairs = len(resumes) * len(jds)
    all_results = []
    current_pair = 0

    # Initial progress message
    await callback(ScoringProgress(
        event="started",
        total_pairs=total_pairs,
        current_pair=0,
        current_resume="",
        current_jd="",
        progress_percent=0.0
    ))

    loop = asyncio.get_running_loop()
    max_workers = min(8, total_pairs or 1)
    tasks = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for resume_name, resume_text in resumes:
            for jd_name, jd_text in jds:
                current_pair += 1
                progress_percent = (current_pair / total_pairs) * 100

                await callback(ScoringProgress(
                    event="processing",
                    total_pairs=total_pairs,
                    current_pair=current_pair,
                    current_resume=resume_name,
                    current_jd=jd_name,
                    progress_percent=progress_percent
                ))

                future = loop.run_in_executor(
                    executor,
                    run_resume_screening,
                    resume_text,
                    jd_text,
                    template_text,
                )
                tasks.append((resume_name, resume_text, jd_name, jd_text, current_pair, progress_percent, future))

        for resume_name, resume_text, jd_name, jd_text, current_pair, progress_percent, future in tasks:
            try:
                result = await future

                skill_score = float(result.get("skill_score", 0))
                similarity_score = result.get("similarity_score", result.get("final_score", 0))
                experience_score = float(result.get("experience", {}).get("score", 50))
                education_score = float(result.get("education_score", 50))
                format_score = float(result["format_check"].get("format_score", 0))

                result["final_score"] = WeightedScoringStrategy.calculate_weighted_score(
                    skill_score,
                    similarity_score,
                    experience_score,
                    education_score,
                    format_score
                )
                result["resume_name"] = resume_name
                result["jd_name"] = jd_name
                result["resume_text"] = resume_text
                result["jd_text"] = jd_text

                all_results.append(result)
                await callback(ScoringProgress(
                    event="completed",
                    total_pairs=total_pairs,
                    current_pair=current_pair,
                    current_resume=resume_name,
                    current_jd=jd_name,
                    result=result,
                    progress_percent=progress_percent
                ))

            except Exception as e:
                await callback(ScoringProgress(
                    event="error",
                    total_pairs=total_pairs,
                    current_pair=current_pair,
                    current_resume=resume_name,
                    current_jd=jd_name,
                    error=str(e),
                    progress_percent=progress_percent
                ))

    return all_results


def serialize_scoring_progress(progress: ScoringProgress) -> str:
    """Serialize progress message to JSON for WebSocket transmission"""
    return json.dumps({
        "event": progress.event,
        "total_pairs": progress.total_pairs,
        "current_pair": progress.current_pair,
        "current_resume": progress.current_resume,
        "current_jd": progress.current_jd,
        "progress_percent": progress.progress_percent,
        "result": progress.result,
        "error": progress.error,
    })

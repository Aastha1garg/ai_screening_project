import asyncio
import json
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Callable, Optional
from pydantic import BaseModel
from scoring import run_resume_screening


class ScoringProgress(BaseModel):
    """Message type for streaming scoring progress"""
    event: str  # "started", "completed", "error", "all_completed"
    total_files: int  # Total number of resumes to process
    completed_files: int  # Number of resumes completed
    current_resume: str  # Name of resume being processed
    current_jd: str  # Name of JD being processed
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress_percent: float = 0.0


async def stream_resume_screening(
    resumes: List[tuple],  # List of (name, text) tuples
    jds: List[tuple],      # List of (name, text) tuples
    template_text: str,
    callback: Callable[[ScoringProgress], Any],  # Called for each progress update
) -> List[Dict[str, Any]]:
    """
    Process resumes incrementally and stream results via callback - OPTIMIZED FOR SPEED.
    
    Performance optimizations:
    - asyncio.as_completed() for immediate result processing (faster than wait())
    - Max 16 workers for aggressive parallelization
    - Direct resume index tracking (O(1) instead of O(n) per result)
    - Results streamed immediately as they complete
    - Minimal progress callback overhead
    - JDs cached via utils.get_jd_embedding() (processed once per session)
    
    Args:
        resumes: List of (name, text) tuples
        jds: List of (name, text) tuples
        template_text: Optional template resume text
        callback: Async function to call with each ScoringProgress update
        
    Returns:
        List of all screening results
    """
    total_files = len(resumes)
    total_pairs = len(resumes) * len(jds)
    all_results = []
    
    # Track which resumes are fully processed using simple index-based tracking
    jds_per_resume = len(jds)
    results_per_resume = [0] * total_files  # Count results for each resume index
    completed_files = 0

    # Send start event
    await callback(ScoringProgress(
        event="started",
        total_files=total_files,
        completed_files=0,
        current_resume="",
        current_jd="",
        progress_percent=0.0
    ))

    loop = asyncio.get_running_loop()
    # Aggressive parallelization: up to 16 workers for faster processing
    max_workers = min(16, total_pairs or 1)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Create all futures for parallel processing
        futures_to_task = {}
        for resume_idx, (resume_name, resume_text) in enumerate(resumes):
            for jd_idx, (jd_name, jd_text) in enumerate(jds):
                future = loop.run_in_executor(
                    executor,
                    run_resume_screening,
                    resume_text,
                    jd_text,
                    template_text,
                )
                futures_to_task[future] = {
                    'resume_name': resume_name,
                    'resume_text': resume_text,
                    'jd_name': jd_name,
                    'jd_text': jd_text,
                    'resume_idx': resume_idx,
                }

        # Process results immediately as they complete (much faster than waiting for batches)
        for future in asyncio.as_completed(futures_to_task.keys()):
            task = futures_to_task[future]
            
            try:
                # FIXED: Properly await the future to get the actual result
                result = await future
                
                # Attach metadata
                result["score"] = result["final_score"]
                result["resume_name"] = task['resume_name']
                result["jd_name"] = task['jd_name']
                result["resume_text"] = task['resume_text']
                result["jd_text"] = task['jd_text']
                
                all_results.append(result)
                
                # Fast O(1) resume completion tracking using index
                resume_idx = task['resume_idx']
                results_per_resume[resume_idx] += 1
                
                if results_per_resume[resume_idx] == jds_per_resume:
                    # This resume just completed all its JD comparisons
                    completed_files += 1
                
                # Calculate progress: cap at 99% until all_completed event
                progress_percent = min(99.0, (completed_files / total_files) * 100.0)
                
                # Send progress update (WITHOUT the large result object)
                # Result will only be sent in final all_completed message
                await callback(ScoringProgress(
                    event="completed",
                    total_files=total_files,
                    completed_files=completed_files,
                    current_resume=task['resume_name'],
                    current_jd=task['jd_name'],
                    result=None,  # FIXED: Don't send result in progress updates (too large, not serializable)
                    progress_percent=progress_percent
                ))
                
            except Exception as e:
                # FIXED: Extract clean error message string, not exception object
                error_msg = str(e).strip()
                if not error_msg:
                    error_msg = f"{type(e).__name__}"
                
                await callback(ScoringProgress(
                    event="error",
                    total_files=total_files,
                    completed_files=completed_files,
                    current_resume=task['resume_name'],
                    current_jd=task['jd_name'],
                    error=error_msg,
                    progress_percent=(completed_files / total_files) * 100.0
                ))

    # Send completion signal with 100% progress (all scoring + DB done)
    await callback(ScoringProgress(
        event="all_completed",
        total_files=total_files,
        completed_files=total_files,
        current_resume="",
        current_jd="",
        progress_percent=100.0
    ))

    return all_results


def serialize_scoring_progress(progress: ScoringProgress) -> str:
    """
    Serialize progress message to JSON for WebSocket transmission.
    FIXED: Only serializes JSON-compatible fields, excludes complex result objects.
    """
    data = {
        "event": progress.event,
        "total_files": progress.total_files,
        "completed_files": progress.completed_files,
        "current_resume": progress.current_resume or "",
        "current_jd": progress.current_jd or "",
        "progress_percent": float(progress.progress_percent),
    }
    
    # Only include error if present
    if progress.error:
        data["error"] = str(progress.error)
    
    # FIXED: Don't serialize result here - it's included separately in final message
    # This prevents coroutine objects or non-serializable data from being sent
    
    return json.dumps(data)

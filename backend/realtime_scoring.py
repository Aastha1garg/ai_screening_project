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
    Process resumes sequentially and stream results via callback.
    
    Uses the same scoring pipeline as traditional upload for consistency.
    Processes each resume with all JDs sequentially to ensure stable progress updates.
    Sends live updates after each resume completes.
    Prevents duplicate/coroutine issues.
    
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
    
    if total_files == 0:
        try:
            await callback(ScoringProgress(
                event="all_completed",
                total_files=0,
                completed_files=0,
                current_resume="",
                current_jd="",
                progress_percent=100.0
            ))
        except Exception as e:
            print(f"Error sending all_completed event: {e}")
        return []
    
    completed_files = 0

    # Send start event
    try:
        await callback(ScoringProgress(
            event="started",
            total_files=total_files,
            completed_files=0,
            current_resume="",
            current_jd="",
            progress_percent=0.0
        ))
    except Exception as e:
        print(f"Error sending started event: {e}")

    loop = asyncio.get_running_loop()
    # Sequential processing ensures stability for real-time mode while still using the same scoring pipeline.
    with ThreadPoolExecutor(max_workers=1) as executor:
        for resume_name, resume_text in resumes:
            for jd_name, jd_text in jds:
                try:
                    # Add traceback logging for debugging
                    import traceback
                    
                    def sync_callback(percent: float, stage: str):
                        try:
                            base_percent = (completed_files / total_files) * 100.0 if total_files else 0.0
                            increment = (percent / 100.0) * (100.0 / total_files) if total_files else 0.0
                            global_percent = min(99.0, max(0.0, base_percent + increment))
                            
                            coro = callback(ScoringProgress(
                                event=stage,
                                total_files=total_files,
                                completed_files=completed_files,
                                current_resume=resume_name or "",
                                current_jd=jd_name or "",
                                progress_percent=global_percent
                            ))
                            asyncio.run_coroutine_threadsafe(coro, loop)
                        except Exception as cb_err:
                            print(f"Error in sync_callback: {cb_err}")

                    result = await loop.run_in_executor(
                        executor,
                        lambda r=resume_text, j=jd_text, t=template_text, c=sync_callback: run_resume_screening(
                            r, j, t, progress_callback=c
                        )
                    )
                except Exception as e:
                    error_msg = f"Server processing error: {str(e)}"
                    print(f"Error processing resume '{resume_name}' with JD '{jd_name}': {e}")
                    print("Traceback:")
                    traceback.print_exc()
                    try:
                        await callback(ScoringProgress(
                            event="error",
                            total_files=total_files,
                            completed_files=completed_files,
                            current_resume=resume_name or "",
                            current_jd=jd_name or "",
                            error=error_msg,
                            progress_percent=float(completed_files) / float(total_files) * 100.0 if total_files else 0.0,
                        ))
                    except Exception as cb_err:
                        print(f"Error sending error callback: {cb_err}")
                    raise

                result["score"] = result.get("final_score", 0)
                result["resume_name"] = resume_name
                result["jd_name"] = jd_name
                result["resume_text"] = resume_text
                result["jd_text"] = jd_text

                all_results.append(result)

            completed_files += 1
            try:
                progress_percent = float(completed_files) / float(total_files) * 100.0 if total_files else 0.0
            except (ValueError, TypeError, ZeroDivisionError):
                progress_percent = 0.0

            if progress_percent != progress_percent:  # NaN check
                progress_percent = 0.0

            try:
                await callback(ScoringProgress(
                    event="completed",
                    total_files=total_files,
                    completed_files=completed_files,
                    current_resume=resume_name or "",
                    current_jd="",
                    progress_percent=min(100.0, max(0.0, progress_percent)),
                ))
            except Exception as cb_err:
                print(f"Error sending progress callback: {cb_err}")

    try:
        await callback(ScoringProgress(
            event="all_completed",
            total_files=total_files,
            completed_files=total_files,
            current_resume="",
            current_jd="",
            progress_percent=100.0
        ))
    except Exception as e:
        print(f"Error sending all_completed event: {e}")

    return all_results


def serialize_scoring_progress(progress: ScoringProgress) -> str:
    """
    Serialize progress message to JSON for WebSocket transmission.
    FIXED: Only serializes JSON-compatible fields, excludes complex result objects.
    Ensures NO coroutine objects or non-JSON-serializable data is sent.
    """
    try:
        # Ensure all fields are proper types before serialization
        total_files = int(progress.total_files) if progress.total_files is not None else 0
        completed_files = int(progress.completed_files) if progress.completed_files is not None else 0
        
        # Safely convert progress_percent to float, preventing NaN
        try:
            progress_percent = float(progress.progress_percent)
            if not (-1e10 < progress_percent < 1e10) or progress_percent != progress_percent:  # NaN check
                progress_percent = 0.0
        except (ValueError, TypeError):
            progress_percent = 0.0
        
        data = {
            "event": str(progress.event) if progress.event else "unknown",
            "total_files": total_files,
            "completed_files": completed_files,
            "current_resume": str(progress.current_resume or "") if progress.current_resume else "",
            "current_jd": str(progress.current_jd or "") if progress.current_jd else "",
            "progress_percent": progress_percent,
        }
        
        # Only include error if present and is a string
        if progress.error:
            error_str = str(progress.error)
            # Remove any coroutine object representations
            if "<coroutine" in error_str:
                error_str = "Server processing error"
            data["error"] = error_str
        
        # FIXED: Don't serialize result here - it's included separately in final message
        # This prevents coroutine objects or non-serializable data from being sent
        
        return json.dumps(data)
    except Exception as serialize_err:
        # Fallback: return minimal valid JSON if anything fails
        print(f"Error serializing progress: {serialize_err}")
        return json.dumps({
            "event": "error",
            "total_files": 0,
            "completed_files": 0,
            "current_resume": "",
            "current_jd": "",
            "progress_percent": 0.0,
            "error": "Serialization error"
        })

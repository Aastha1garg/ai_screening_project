import csv
import hashlib
import io
import json
from datetime import datetime
import re
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Text, text
from sqlalchemy.orm import Session

from auth import (
    Base,
    TokenResponse,
    User,
    UserCreate,
    UserLogin,
    authenticate_user,
    create_access_token,
    engine,
    get_current_user,
    get_db,
    hash_password,
)
from format_checker import analyze_resume_format, detect_sections, read_upload_file
from ai_feedback import generate_ai_feedback, generate_resume_improvement
from scoring import run_resume_screening
from utils import education_entries_to_strings


class ScreeningHistory(Base):
    __tablename__ = "screening_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    resume_text = Column(Text, nullable=False)
    jd_text = Column(Text, nullable=False)
    final_score = Column(Float, nullable=False)
    resume_name = Column(Text, nullable=False, default="Unknown Resume")
    jd_name = Column(Text, nullable=False, default="Unknown JD")
    status = Column(Text, nullable=False, default="pending")
    format_score = Column(Float, nullable=False, default=0.0)
    skill_score = Column(Float, nullable=False, default=0.0)
    matched_skills = Column(Text, nullable=False, default="[]")
    missing_skills = Column(Text, nullable=False, default="[]")
    result_payload = Column(Text, nullable=False, default="{}")
    shortlisted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Resume Screening API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all (for development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UploadResultItem(BaseModel):
    id: int
    rank: int
    resume_name: str
    jd_name: str
    resume_text: str
    jd_text: str
    score: float
    skill_score: float
    format_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    extra_skills: List[str] = []
    partial_matches: List[str]
    experience: dict
    education: List[Dict[str, Any]]
    required_education: List[Dict[str, Any]] = []
    certifications: List[str]
    required_certifications: List[str] = []
    matched_certifications: List[str] = []
    missing_certifications: List[str] = []
    extra_certifications: List[str] = []
    education_match: str = ""
    experience_match: str = ""
    score_breakdown: dict = {}
    sentiment: str
    profile_label: str
    feedback: dict
    shortlisted: bool = False


class UploadResponse(BaseModel):
    results: List[UploadResultItem]


class HistoryItem(BaseModel):
    id: int
    resume_name: str
    jd_name: str
    score: float
    date: datetime
    status: str
    format_score: float
    shortlisted: bool = False

    class Config:
        from_attributes = True


class NotificationItem(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime


class NotificationsResponse(BaseModel):
    unread_count: int
    notifications: List[NotificationItem]


class FormatCheckResult(BaseModel):
    resume_name: str
    format_score: int
    missing_sections: List[str]
    extra_sections: List[str]
    order_correct: bool
    detected_order: List[str]
    expected_order: List[str]
    feedback: str


class FormatCheckResponse(BaseModel):
    results: List[FormatCheckResult]


class ResumeFilterPayload(BaseModel):
    min_score: Optional[float] = None
    min_experience: Optional[float] = None
    min_skill_match: Optional[float] = None
    status: Optional[str] = None
    min_format_score: Optional[float] = None
    top_n: Optional[int] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "desc"
    shortlisted_only: Optional[bool] = None


class AutoShortlistPayload(BaseModel):
    min_skill_match: Optional[float] = None
    min_score: Optional[float] = None
    min_experience: Optional[float] = None


class ComparePayload(BaseModel):
    resume_ids: List[int]
    jd_id: Optional[int] = None


class AIFeedbackRequest(BaseModel):
    resume_text: str
    jd_text: str
    score: float
    matched_skills: List[str] = []
    missing_skills: List[str] = []


class ExplainScoreRequest(BaseModel):
    resume_id: int
    jd_id: Optional[int] = None


class ImproveResumeRequest(BaseModel):
    resume_id: int
    jd_id: Optional[int] = None


_ai_feedback_cache: dict = {}


@app.get("/")
def health():
    return {"status": "ok", "service": "ai-resume-screening"}


def _ensure_history_columns() -> None:
    with engine.begin() as conn:
        current = {row[1] for row in conn.execute(text("PRAGMA table_info(screening_history)"))}
        required = {
            "resume_name": "TEXT DEFAULT 'Unknown Resume'",
            "jd_name": "TEXT DEFAULT 'Unknown JD'",
            "status": "TEXT DEFAULT 'pending'",
            "format_score": "FLOAT DEFAULT 0",
            "skill_score": "FLOAT DEFAULT 0",
            "matched_skills": "TEXT DEFAULT '[]'",
            "missing_skills": "TEXT DEFAULT '[]'",
            "result_payload": "TEXT DEFAULT '{}'",
            "shortlisted": "BOOLEAN DEFAULT 0",
        }
        for column_name, column_type in required.items():
            if column_name not in current:
                conn.execute(
                    text(f"ALTER TABLE screening_history ADD COLUMN {column_name} {column_type}")
                )


def _infer_status(score: float) -> str:
    if score >= 75:
        return "selected"
    if score >= 50:
        return "pending"
    return "rejected"


def _build_csv(rows: List[ScreeningHistory]) -> io.StringIO:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "resume_name",
            "jd_name",
            "score",
            "skill_score",
            "format_score",
            "status",
            "date",
            "matched_skills",
            "missing_skills",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.id,
                row.resume_name,
                row.jd_name,
                row.final_score,
                row.skill_score,
                row.format_score,
                row.status,
                row.created_at.isoformat(),
                row.matched_skills,
                row.missing_skills,
            ]
        )
    buffer.seek(0)
    return buffer


def _extract_email_from_text(resume_text: str) -> str:
    match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", resume_text or "")
    return match.group(0) if match else ""


def _history_row_to_frontend_result(row: ScreeningHistory) -> dict:
    """Rebuild upload-shaped result dict from DB for dashboard hydration (user-scoped)."""
    payload = _safe_json_loads(row.result_payload or "{}", {})
    matched = _safe_json_loads(row.matched_skills or "[]", [])
    missing = _safe_json_loads(row.missing_skills or "[]", [])

    out = dict(payload) if isinstance(payload, dict) else {}
    out["id"] = row.id
    out["resume_name"] = row.resume_name
    out["jd_name"] = row.jd_name
    out["resume_text"] = row.resume_text or ""
    out["jd_text"] = row.jd_text or ""
    out["score"] = float(row.final_score or 0)
    out["final_score"] = float(row.final_score or 0)
    out["skill_score"] = float(row.skill_score or 0)
    out["format_score"] = float(row.format_score or 0)
    out["shortlisted"] = bool(row.shortlisted)
    if isinstance(matched, list) and matched:
        out["matched_skills"] = out.get("matched_skills") or matched
    if isinstance(missing, list) and missing:
        out["missing_skills"] = out.get("missing_skills") or missing
    out.setdefault("extra_skills", out.get("extra_skills") or [])
    out.setdefault("partial_matches", out.get("partial_matches") or [])
    out.setdefault("experience", out.get("experience") or {})
    out.setdefault("education", out.get("education") or [])
    out.setdefault("required_education", out.get("required_education") or [])
    out.setdefault("certifications", out.get("certifications") or [])
    out.setdefault("required_certifications", out.get("required_certifications") or [])
    out.setdefault("matched_certifications", out.get("matched_certifications") or [])
    out.setdefault("missing_certifications", out.get("missing_certifications") or [])
    out.setdefault("extra_certifications", out.get("extra_certifications") or [])
    out.setdefault("education_match", out.get("education_match") or "")
    out.setdefault("experience_match", out.get("experience_match") or "")
    out.setdefault("score_breakdown", out.get("score_breakdown") or {})
    out.setdefault("sentiment", out.get("sentiment") or "neutral")
    out.setdefault("profile_label", out.get("profile_label") or "Needs Improvement")
    if not out.get("feedback"):
        out["feedback"] = out.get("ai_feedback") if isinstance(out.get("ai_feedback"), dict) else {}
    return out


def _serialize_history_row(row: ScreeningHistory) -> dict:
    try:
        payload = json.loads(row.result_payload or "{}")
    except json.JSONDecodeError:
        payload = {}

    try:
        matched = json.loads(row.matched_skills or "[]")
    except json.JSONDecodeError:
        matched = []

    try:
        missing = json.loads(row.missing_skills or "[]")
    except json.JSONDecodeError:
        missing = []

    experience = payload.get("experience", {})
    education = payload.get("education", [])
    return {
        "id": row.id,
        "name": row.resume_name,
        "resume_name": row.resume_name,
        "jd_name": row.jd_name,
        "email": _extract_email_from_text(row.resume_text),
        "score": float(row.final_score or 0),
        "skill_score": float(row.skill_score or 0),
        "format_score": float(row.format_score or 0),
        "status": row.status,
        "shortlisted": bool(row.shortlisted),
        "experience": float(experience.get("total_years", 0) or 0),
        "relevant_experience": float(experience.get("relevant_years", 0) or 0),
        "education": education,
        "matched_skills": matched,
        "missing_skills": missing,
        "date": row.created_at.isoformat(),
    }


def create_notification(db: Session, user_id: int, message: str) -> Notification:
    notification = Notification(user_id=user_id, message=message, is_read=False)
    db.add(notification)
    db.flush()
    return notification


def _filter_serialized_rows(rows: List[dict], payload: ResumeFilterPayload) -> List[dict]:
    filtered = rows
    if payload.min_score is not None:
        filtered = [r for r in filtered if r["score"] >= payload.min_score]
    if payload.min_experience is not None:
        filtered = [r for r in filtered if r["experience"] >= payload.min_experience]
    if payload.min_skill_match is not None:
        filtered = [r for r in filtered if r["skill_score"] >= payload.min_skill_match]
    if payload.min_format_score is not None:
        filtered = [r for r in filtered if r["format_score"] >= payload.min_format_score]
    if payload.status:
        status = payload.status.strip().lower()
        filtered = [r for r in filtered if (r["status"] or "").lower() == status]
    if payload.shortlisted_only is True:
        filtered = [r for r in filtered if r.get("shortlisted")]

    sort_map = {
        "score": "score",
        "experience": "experience",
        "skill_score": "skill_score",
        "format_score": "format_score",
        "date": "date",
    }
    if payload.sort_by in sort_map:
        reverse = (payload.sort_order or "desc").lower() != "asc"
        filtered = sorted(filtered, key=lambda row: row.get(sort_map[payload.sort_by], 0), reverse=reverse)

    if payload.top_n is not None and payload.top_n > 0:
        filtered = filtered[: payload.top_n]
    return filtered


def _build_filtered_csv(rows: List[dict]) -> io.StringIO:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Name",
            "Email",
            "Final Score",
            "Skill Score",
            "Experience",
            "Education",
            "Matched Skills",
            "Missing Skills",
            "Format Score",
            "Status",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.get("name", ""),
                row.get("email", ""),
                row.get("score", 0),
                row.get("skill_score", 0),
                row.get("experience", 0),
                ", ".join(education_entries_to_strings(row.get("education", []))),
                ", ".join(row.get("matched_skills", [])),
                ", ".join(row.get("missing_skills", [])),
                row.get("format_score", 0),
                row.get("status", ""),
            ]
        )
    buffer.seek(0)
    return buffer


@app.post("/auth/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    try:
        print("REGISTER CALLED")

        existing = db.query(User).filter(User.email == payload.email).first()
        print("DB QUERY DONE")

        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed = hash_password(payload.password)
        print("PASSWORD HASHED:", hashed)

        user = User(email=payload.email, password_hash=hashed)
        db.add(user)
        db.commit()
        db.refresh(user)
        print("USER CREATED")

        token = create_access_token(subject=user.email)
        return TokenResponse(access_token=token)

    except HTTPException:
        raise
    except Exception as e:
        print(" ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(subject=user.email)
    return TokenResponse(access_token=token)


_ensure_history_columns()


@app.post("/upload", response_model=UploadResponse)
async def upload_resume(
    resumes: List[UploadFile] = File(...),
    jds: List[UploadFile] = File(...),
    template_resume: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not resumes:
        raise HTTPException(status_code=400, detail="At least one resume file is required")
    if not jds:
        raise HTTPException(
            status_code=400, detail="At least one job description file is required"
        )

    template_text = ""
    if template_resume is not None:
        _, template_text = await read_upload_file(template_resume)

    parsed_resumes = [await read_upload_file(resume_file) for resume_file in resumes]
    parsed_jds = [await read_upload_file(jd_file) for jd_file in jds]

    raw_results: List[dict] = []

    for resume_name, resume_text in parsed_resumes:
        for jd_name, jd_text in parsed_jds:
            result = run_resume_screening(resume_text, jd_text, template_text)

            history = ScreeningHistory(
                user_id=current_user.id,
                resume_text=resume_text,
                jd_text=jd_text,
                final_score=result["final_score"],
                resume_name=resume_name,
                jd_name=jd_name,
                status=_infer_status(result["final_score"]),
                format_score=float(result["format_check"].get("format_score", 0)),
                skill_score=float(result.get("skill_score", 0)),
                matched_skills=json.dumps(result.get("matched_skills", [])),
                missing_skills=json.dumps(result.get("missing_skills", [])),
                result_payload=json.dumps(result),
            )
            db.add(history)
            db.flush()

            raw_results.append(
                {
                    "id": history.id,
                    "resume_name": resume_name,
                    "jd_name": jd_name,
                    "resume_text": resume_text,
                    "jd_text": jd_text,
                    "score": result["final_score"],
                    "skill_score": result["skill_score"],
                    "format_score": result["format_check"].get("format_score", 0),
                    "matched_skills": result.get("matched_skills", []),
                    "missing_skills": result.get("missing_skills", []),
                    "extra_skills": result.get("extra_skills", []),
                    "partial_matches": result.get("partial_matches", []),
                    "experience": result.get("experience", {}),
                    "education": result.get("education", []),
                    "required_education": result.get("required_education", []),
                    "certifications": result.get("certifications", []),
                    "required_certifications": result.get("required_certifications", []),
                    "matched_certifications": result.get("matched_certifications", []),
                    "missing_certifications": result.get("missing_certifications", []),
                    "extra_certifications": result.get("extra_certifications", []),
                    "education_match": result.get("education_match", ""),
                    "experience_match": result.get("experience_match", ""),
                    "score_breakdown": result.get("score_breakdown", {}),
                    "sentiment": result.get("sentiment", "neutral"),
                    "profile_label": result.get("profile_label", "Needs Improvement"),
                    "feedback": result["ai_feedback"],
                    "shortlisted": bool(history.shortlisted),
                }
            )

    db.commit()

    # Create user-scoped notifications after scoring finishes.
    create_notification(
        db,
        current_user.id,
        f"Resume upload completed ({len(raw_results)} results generated).",
    )
    if any(float(item.get("score", 0)) >= 80 for item in raw_results):
        create_notification(db, current_user.id, "New high-score candidate detected (>=80).")
    if any(float(item.get("format_score", 0)) < 70 for item in raw_results):
        create_notification(db, current_user.id, "Format mismatch warning found in one or more resumes.")
    db.commit()

    ranked = sorted(raw_results, key=lambda item: item.get("score", 0), reverse=True)
    final_results = [
        UploadResultItem(rank=index + 1, **item) for index, item in enumerate(ranked)
    ]
    return UploadResponse(results=final_results)


@app.get("/history", response_model=List[HistoryItem])
def get_history(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = (
        db.query(ScreeningHistory)
        .filter(ScreeningHistory.user_id == current_user.id)
        .order_by(ScreeningHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "resume_name": row.resume_name,
            "jd_name": row.jd_name,
            "score": row.final_score,
            "date": row.created_at,
            "status": row.status,
            "format_score": row.format_score,
            "shortlisted": bool(row.shortlisted),
        }
        for row in rows
    ]


@app.get("/history/results")
def get_history_results(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Full screening payloads for the current user (for dashboard after reload)."""
    rows = (
        db.query(ScreeningHistory)
        .filter(ScreeningHistory.user_id == current_user.id)
        .order_by(ScreeningHistory.created_at.desc())
        .all()
    )
    return [_history_row_to_frontend_result(row) for row in rows]


@app.get("/notifications", response_model=NotificationsResponse)
def get_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(25)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )
    return {
        "unread_count": unread_count,
        "notifications": rows,
    }


@app.post("/notifications/read-all")
def mark_notifications_read(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return {"message": "Notifications marked as read"}


@app.get("/shortlist")
def get_shortlisted(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = (
        _user_history_query(db, current_user.id)
        .filter(ScreeningHistory.shortlisted.is_(True))
        .all()
    )
    serialized = [_serialize_history_row(row) for row in rows]
    return {"count": len(serialized), "results": serialized}


@app.post("/shortlist/{history_id}")
def shortlist_candidate(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(ScreeningHistory)
        .filter(
            ScreeningHistory.user_id == current_user.id,
            ScreeningHistory.id == history_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    row.shortlisted = True
    db.commit()
    db.refresh(row)
    return {"message": "Candidate shortlisted", "candidate": _serialize_history_row(row)}


@app.delete("/shortlist/{history_id}")
def unshortlist_candidate(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(ScreeningHistory)
        .filter(
            ScreeningHistory.user_id == current_user.id,
            ScreeningHistory.id == history_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    row.shortlisted = False
    db.commit()
    db.refresh(row)
    return {"message": "Candidate removed from shortlist", "candidate": _serialize_history_row(row)}


@app.post("/shortlist/auto")
def auto_shortlist(
    payload: AutoShortlistPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = _user_history_query(db, current_user.id).all()
    serialized = [_serialize_history_row(row) for row in rows]
    shortlisted = serialized
    if payload.min_skill_match is not None:
        shortlisted = [r for r in shortlisted if r.get("skill_score", 0) >= payload.min_skill_match]
    if payload.min_score is not None:
        shortlisted = [r for r in shortlisted if r.get("score", 0) >= payload.min_score]
    if payload.min_experience is not None:
        shortlisted = [r for r in shortlisted if r.get("experience", 0) >= payload.min_experience]

    shortlisted_ids = {row["id"] for row in shortlisted}
    if shortlisted_ids:
        (
            db.query(ScreeningHistory)
            .filter(
                ScreeningHistory.user_id == current_user.id,
                ScreeningHistory.id.in_(shortlisted_ids),
            )
            .update({ScreeningHistory.shortlisted: True}, synchronize_session=False)
        )
        db.commit()

    refreshed = (
        db.query(ScreeningHistory)
        .filter(
            ScreeningHistory.user_id == current_user.id,
            ScreeningHistory.id.in_(shortlisted_ids),
        )
        .all()
        if shortlisted_ids
        else []
    )
    return {
        "count": len(refreshed),
        "results": [_serialize_history_row(row) for row in refreshed],
    }


def _user_history_query(db: Session, user_id: int):
    return (
        db.query(ScreeningHistory)
        .filter(ScreeningHistory.user_id == user_id)
        .order_by(ScreeningHistory.created_at.desc())
    )


def _get_user_history_row(db: Session, user_id: int, history_id: int) -> Optional[ScreeningHistory]:
    return (
        db.query(ScreeningHistory)
        .filter(ScreeningHistory.user_id == user_id, ScreeningHistory.id == history_id)
        .first()
    )


def _safe_json_loads(raw: str, default):
    try:
        return json.loads(raw or "")
    except (json.JSONDecodeError, TypeError):
        return default


@app.get("/download/all")
def download_all(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = _user_history_query(db, current_user.id).all()
    csv_buffer = _build_csv(rows)
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=all_resumes.csv"},
    )


@app.get("/download/rejected")
def download_rejected(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = _user_history_query(db, current_user.id).filter(ScreeningHistory.status == "rejected").all()
    csv_buffer = _build_csv(rows)
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=rejected_resumes.csv"},
    )


@app.get("/download/format-matched")
def download_format_matched(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = _user_history_query(db, current_user.id).filter(ScreeningHistory.format_score >= 70).all()
    csv_buffer = _build_csv(rows)
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=format_matched_resumes.csv"},
    )


@app.get("/download/scored")
def download_scored(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    rows = _user_history_query(db, current_user.id).filter(ScreeningHistory.final_score >= 60).all()
    csv_buffer = _build_csv(rows)
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=scored_resumes.csv"},
    )


@app.post("/format-check", response_model=FormatCheckResponse)
async def format_check(
    resumes: List[UploadFile] = File(...),
    template_resume: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    if not resumes:
        raise HTTPException(status_code=400, detail="At least one resume file is required")

    template_name, template_text = await read_upload_file(template_resume)
    template_sections = detect_sections(template_text)["detected_order"]
    if not template_sections:
        raise HTTPException(
            status_code=400,
            detail=f"{template_name}: no recognizable sections found in template",
        )

    results: List[FormatCheckResult] = []
    for resume_file in resumes:
        resume_name, resume_text = await read_upload_file(resume_file)
        analysis = analyze_resume_format(
            resume_name=resume_name,
            resume_text=resume_text,
            expected_order=template_sections,
        )
        results.append(FormatCheckResult(**analysis))

    return FormatCheckResponse(results=results)


@app.post("/filter-resumes")
def filter_resumes(
    payload: ResumeFilterPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = _user_history_query(db, current_user.id).all()
    serialized = [_serialize_history_row(row) for row in rows]
    filtered = _filter_serialized_rows(serialized, payload)
    return {"count": len(filtered), "results": filtered}


@app.post("/download-filtered")
def download_filtered(
    payload: ResumeFilterPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = _user_history_query(db, current_user.id).all()
    serialized = [_serialize_history_row(row) for row in rows]
    filtered = _filter_serialized_rows(serialized, payload)
    csv_buffer = _build_filtered_csv(filtered)
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=filtered_resumes.csv"},
    )


@app.post("/compare")
def compare_resumes(
    payload: ComparePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.resume_ids:
        raise HTTPException(status_code=400, detail="At least one resume id is required")

    rows = (
        db.query(ScreeningHistory)
        .filter(
            ScreeningHistory.user_id == current_user.id,
            ScreeningHistory.id.in_(payload.resume_ids),
        )
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No matching resumes found")

    jd_text_override = None
    if payload.jd_id is not None:
        jd_source = (
            db.query(ScreeningHistory)
            .filter(ScreeningHistory.user_id == current_user.id, ScreeningHistory.id == payload.jd_id)
            .first()
        )
        if jd_source:
            jd_text_override = jd_source.jd_text

    candidates = []
    for row in rows:
        serialized = _serialize_history_row(row)
        try:
            result_payload = json.loads(row.result_payload or "{}")
        except json.JSONDecodeError:
            result_payload = {}

        if jd_text_override:
            rescored = run_resume_screening(row.resume_text, jd_text_override)
            serialized["score"] = float(rescored.get("final_score", serialized["score"]))
            serialized["skill_score"] = float(rescored.get("skill_score", serialized["skill_score"]))
            serialized["matched_skills"] = rescored.get("matched_skills", serialized["matched_skills"])
            serialized["missing_skills"] = rescored.get("missing_skills", serialized["missing_skills"])
            serialized["experience"] = float(
                rescored.get("experience", {}).get("total_years", serialized["experience"])
            )
            serialized["education"] = rescored.get("education", serialized["education"])
            serialized["format_score"] = float(
                rescored.get("format_check", {}).get("format_score", serialized["format_score"])
            )
            serialized["status"] = _infer_status(serialized["score"])
        else:
            serialized["education"] = result_payload.get("education", serialized["education"])

        candidates.append(serialized)

    return {"candidates": candidates}


@app.post("/explain-score")
def explain_score(
    payload: ExplainScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume_row = _get_user_history_row(db, current_user.id, payload.resume_id)
    if not resume_row:
        raise HTTPException(status_code=404, detail="Resume not found")

    jd_row = resume_row
    if payload.jd_id is not None:
        jd_row = _get_user_history_row(db, current_user.id, payload.jd_id)
        if not jd_row:
            raise HTTPException(status_code=404, detail="JD source not found")

    rescored = run_resume_screening(resume_row.resume_text, jd_row.jd_text)
    jd_count = max(1, len(rescored.get("jd_skills", [])))
    matched_count = len(rescored.get("matched_skills", []))
    partial_count = len(rescored.get("partial_matches", []))
    confidence_score = round(min(100.0, ((matched_count + (0.5 * partial_count)) / jd_count) * 100.0), 2)
    return {
        "resume_id": resume_row.id,
        "jd_id": jd_row.id,
        "resume_name": resume_row.resume_name,
        "jd_name": jd_row.jd_name,
        "resume_skills": rescored.get("resume_skills", []),
        "jd_skills": rescored.get("jd_skills", []),
        "matched_skills": rescored.get("matched_skills", []),
        "missing_skills": rescored.get("missing_skills", []),
        "partial_matches": rescored.get("partial_matches", []),
        "extra_skills": rescored.get("extra_skills", []),
        "experience": rescored.get("experience", {}),
        "score_breakdown": rescored.get("score_breakdown", {}),
        "final_score": rescored.get("final_score", 0),
        "confidence_score": confidence_score,
    }


@app.post("/improve-resume")
def improve_resume(
    payload: ImproveResumeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume_row = _get_user_history_row(db, current_user.id, payload.resume_id)
    if not resume_row:
        raise HTTPException(status_code=404, detail="Resume not found")

    jd_row = resume_row
    if payload.jd_id is not None:
        jd_row = _get_user_history_row(db, current_user.id, payload.jd_id)
        if not jd_row:
            raise HTTPException(status_code=404, detail="JD source not found")

    payload_cache = _safe_json_loads(resume_row.result_payload, {})
    missing_skills = payload_cache.get("missing_skills", [])
    if jd_row.id != resume_row.id:
        rescored = run_resume_screening(resume_row.resume_text, jd_row.jd_text)
        missing_skills = rescored.get("missing_skills", missing_skills)

    improvement = generate_resume_improvement(
        resume_text=resume_row.resume_text,
        jd_text=jd_row.jd_text,
        missing_skills=missing_skills or [],
    )
    return {
        "resume_id": resume_row.id,
        "jd_id": jd_row.id,
        "resume_name": resume_row.resume_name,
        "jd_name": jd_row.jd_name,
        "improved_summary": improvement.get("improved_summary", ""),
        "improved_bullets": improvement.get("improved_bullets", []),
        "missing_keywords": improvement.get("missing_keywords", []),
        "ats_suggestions": improvement.get("ats_suggestions", []),
    }


@app.post("/ai-feedback")
def ai_feedback(payload: AIFeedbackRequest, current_user: User = Depends(get_current_user)):
    _ = current_user
    cache_input = json.dumps(
        {
            "resume_text": payload.resume_text,
            "jd_text": payload.jd_text,
            "score": payload.score,
            "matched_skills": payload.matched_skills,
            "missing_skills": payload.missing_skills,
        },
        sort_keys=True,
    )
    cache_key = hashlib.sha256(cache_input.encode("utf-8")).hexdigest()
    if cache_key in _ai_feedback_cache:
        return {"ai_feedback": _ai_feedback_cache[cache_key], "cached": True}

    feedback = generate_ai_feedback(
        jd_text=payload.jd_text,
        resume_text=payload.resume_text,
        matched_skills=payload.matched_skills,
        missing_skills=payload.missing_skills,
        score=payload.score,
    )
    _ai_feedback_cache[cache_key] = feedback
    return {"ai_feedback": feedback, "cached": False}
 
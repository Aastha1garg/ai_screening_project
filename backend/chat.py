import json
import asyncio
import os
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from auth import get_db, get_current_user, User

gemini_load_error = None
try:
    import google.generativeai as genai
    gemini_key = os.environ.get("GEMINI_API_KEY", "AIzaSyAbBdYqet1YyQG53VFyyOXDQwLCnY9gV1I")
    if gemini_key:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
    else:
        model = None
        gemini_load_error = "No API Key"
except Exception as e:
    model = None
    gemini_load_error = str(e)

router = APIRouter(prefix="/api/chat", tags=["chatbot"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[Dict[str, Any]] = None

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from main import ScreeningHistory, _get_user_history_row

    messages = request.messages
    context = request.context or {}
    
    db_context_str = ""
    rows = db.query(ScreeningHistory).filter(ScreeningHistory.user_id == current_user.id).all()
    
    top_candidates = []
    if rows:
        db_context_str += f"Total Candidates: {len(rows)}\n"
        top_candidates = [r for r in rows if r.final_score >= 75]
        if top_candidates:
            db_context_str += f"Top Candidates:\n"
            for c in top_candidates:
                db_context_str += f"- {c.resume_name}: Score {c.final_score:.1f}\n"
            
        resume_id = context.get("resumeId")
        if resume_id:
            row = _get_user_history_row(db, current_user.id, resume_id)
            if row:
                db_context_str += f"\nCurrently focusing on '{row.resume_name}':\n"
                db_context_str += f"- Overall Score: {row.final_score:.1f}\n"
                db_context_str += f"- Missing Skills: {row.missing_skills}\n"
                db_context_str += f"- Format Score: {row.format_score}\n"
    
    last_msg = messages[-1].content.lower() if messages else ""

    async def event_stream():
        # --- SMART MOCK FALLBACK FUNCTION ---
        async def run_mock_fallback(reason: str = ""):
            if reason:
                yield f"*(Smart Workflow Mode Active - {reason})*\n\n"
            
            response_text = ""
            if "top" in last_msg or "best match" in last_msg or "best candidate" in last_msg:
                if top_candidates:
                    response_text = f"Here are your **Top Candidates** from the {len(rows)} resumes processed:\n\n"
                    for i, c in enumerate(sorted(top_candidates, key=lambda x: x.final_score, reverse=True)[:3]):
                        response_text += f"### {i+1}. {c.resume_name} 🌟\n"
                        response_text += f"- **Overall Score**: {c.final_score:.1f}/100\n"
                        response_text += f"- **Skill Match**: {c.skill_score}/100\n"
                        response_text += f"- **Why them?**: They have exceptionally high keyword density and good formatting.\n\n"
                else:
                    response_text = "You don't currently have any top-tier candidates (scoring > 75). Try sourcing more resumes for this Job Description."
            
            elif "compare" in last_msg:
                if len(rows) >= 2:
                    c1, c2 = rows[0], rows[1]
                    response_text = f"### ⚖️ Candidate Comparison\n\n"
                    response_text += f"**{c1.resume_name}** vs **{c2.resume_name}**\n\n"
                    response_text += f"| Metric | {c1.resume_name} | {c2.resume_name} |\n"
                    response_text += f"|---|---|---|\n"
                    response_text += f"| **Overall Score** | {c1.final_score:.1f} | {c2.final_score:.1f} |\n"
                    response_text += f"| **Skill Match** | {c1.skill_score} | {c2.skill_score} |\n"
                    response_text += f"| **Format Score** | {c1.format_score} | {c2.format_score} |\n\n"
                    
                    if c1.final_score > c2.final_score:
                        response_text += f"**Recommendation:** Go with **{c1.resume_name}** due to a stronger overall ATS match."
                    else:
                        response_text += f"**Recommendation:** Go with **{c2.resume_name}** due to a stronger overall ATS match."
                else:
                    response_text = "Please upload at least 2 candidates so I can run a comparison workflow!"
                    
            elif "improve" in last_msg or "tips" in last_msg:
                resume_id = context.get("resumeId")
                if resume_id:
                    row = _get_user_history_row(db, current_user.id, resume_id)
                    if row:
                        response_text = f"### 💡 Improvement Tips for {row.resume_name}\n\n"
                        response_text += "1. **Keyword Optimization**: Add the exact skills mentioned in the JD that the ATS flagged as missing.\n"
                        response_text += "2. **Action Verbs**: Start bullet points with strong verbs (e.g., 'Spearheaded', 'Engineered').\n"
                        response_text += "3. **Quantify Results**: Add metrics to your bullet points (e.g., 'Improved performance by 20%').\n"
                    else:
                        response_text = "I couldn't find the data for this specific resume."
                else:
                    response_text = "To get personalized tips, open a specific candidate from the dashboard!"

            elif "missing" in last_msg:
                resume_id = context.get("resumeId")
                if resume_id:
                    row = _get_user_history_row(db, current_user.id, resume_id)
                    if row:
                        missing = json.loads(row.missing_skills) if isinstance(row.missing_skills, str) else row.missing_skills
                        response_text = f"### 🔍 Missing Skills Analysis\n\n"
                        if missing:
                            response_text += f"The ATS could not find the following required skills in **{row.resume_name}**:\n"
                            for m in missing[:7]:
                                response_text += f"- `{m}`\n"
                            response_text += "\n*Recommendation: If the candidate possesses these skills, they must explicitly list them in a dedicated 'Skills' section.*"
                        else:
                            response_text += "Great news! The candidate matched all essential keywords from the Job Description."
                    else:
                        response_text = "I couldn't find the data for this specific resume."
                else:
                    response_text = "Please open a specific parsed resume first so I can analyze its missing keywords!"

            elif "reject" in last_msg or "why" in last_msg:
                resume_id = context.get("resumeId")
                if resume_id:
                    row = _get_user_history_row(db, current_user.id, resume_id)
                    if row:
                        response_text = f"### ❌ Rejection Analysis for {row.resume_name}\n\n"
                        response_text += f"If this candidate was rejected, it is likely due to their ATS Score of **{row.final_score:.1f}**.\n\n"
                        if row.skill_score < 60:
                            response_text += "**Primary Reason**: Low Skill Match. They are missing critical keywords from the JD.\n"
                        if row.format_score < 60:
                            response_text += "**Secondary Reason**: Poor Formatting. The ATS struggled to parse their structure properly."
                    else:
                        response_text = "I couldn't find the data for this specific resume."
                else:
                    response_text = "If you want to know why a candidate might be rejected by the ATS, select them from the dashboard first!"
            
            elif "dashboard" in last_msg or "insight" in last_msg:
                avg_score = sum([r.final_score for r in rows]) / len(rows) if rows else 0
                response_text = f"### 📈 Dashboard Insights\n\n"
                response_text += f"- **Total Resumes Processed**: {len(rows)}\n"
                response_text += f"- **Average ATS Score**: {avg_score:.1f}/100\n"
                response_text += f"- **Highly Qualified (>75)**: {len(top_candidates)}\n\n"
                response_text += "The pipeline is looking healthy! Try running a comparison on your top candidates."

            elif "format" in last_msg:
                resume_id = context.get("resumeId")
                if resume_id:
                    row = _get_user_history_row(db, current_user.id, resume_id)
                    if row:
                        response_text = f"### 📝 Format Analysis for {row.resume_name}\n\n"
                        response_text += f"**Format Score**: {row.format_score}/100\n\n"
                        response_text += "The format score is calculated based on:\n"
                        response_text += "1. Readability of text blocks\n"
                        response_text += "2. Absence of complex tables or graphics\n"
                        response_text += "3. Standardized section headers (Experience, Education)\n"
                    else:
                        response_text = "I couldn't find the data for this specific resume."
                else:
                    response_text = "Open a candidate to see exactly how well their formatting complies with standard ATS parsers!"
                    
            elif "recommend" in last_msg:
                response_text = f"### 🤝 Hiring Recommendations\n\n"
                if top_candidates:
                    response_text += "Based on the data, you should **proceed to interview** your Top Candidates immediately. "
                    response_text += "For the rest, consider sending a polite rejection email, as their keyword matches fall below the recommended 75% threshold."
                else:
                    response_text += "Since no candidates scored above 75%, I recommend **revising your Job Description** to ensure the required skills aren't too strict, or sourcing from a different talent pool."

            elif "explain" in last_msg or "score" in last_msg or "ats" in last_msg:
                resume_id = context.get("resumeId")
                if resume_id:
                    row = _get_user_history_row(db, current_user.id, resume_id)
                    if row:
                        response_text = f"### 📊 ATS Score Breakdown for {row.resume_name}\n\n"
                        response_text += f"- **Final Score:** {row.final_score:.1f}/100\n"
                        response_text += f"- **Skill Match:** {row.skill_score}/100\n"
                        response_text += f"- **Formatting:** {row.format_score}/100\n\n"
                        response_text += "The score is calculated by combining keyword density from the Job Description and structural formatting rules."
                    else:
                        response_text = "I couldn't find the data for this specific resume."
                else:
                    response_text = "An ATS score is determined by matching the skills, experience, and format against the JD. Select a candidate to view their breakdown."
            
            else:
                response_text = "Hello! I am your Smart Recruitment Assistant. \n\nPlease select one of the **Quick Actions** above to run an intelligent workflow on your candidates!"

            words = response_text.split(" ")
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
                await asyncio.sleep(0.02)

        try:
            if not model:
                async for token in run_mock_fallback("Gemini API not configured"):
                    yield token
                return
                
            history = [{"role": "user" if m.role == "user" else "model", "parts": [m.content]} for m in messages[:-1]]
            chat = model.start_chat(history=history)
            prompt = f"System Context:\n{db_context_str}\n\nUser Message:\n{messages[-1].content}"
            response = chat.send_message(prompt, stream=True)
            for chunk in response:
                yield chunk.text
                
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "Quota" in err_str or "quota" in err_str.lower():
                async for token in run_mock_fallback("API Quota Exceeded. Add a billing account to Google AI Studio to unlock true Generative AI."):
                    yield token
            else:
                yield f"**Error generating response:** {err_str}"

    return StreamingResponse(event_stream(), media_type="text/plain")

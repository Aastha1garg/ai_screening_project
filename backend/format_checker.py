import io
import re
from typing import Dict, List, Sequence, Tuple

from fastapi import HTTPException, UploadFile

SECTION_KEYWORDS: Dict[str, List[str]] = {
    "education": [r"education", r"academic background", r"academics"],
    "experience": [r"experience", r"work experience", r"professional experience", r"employment"],
    "skills": [r"skills", r"technical skills", r"core competencies"],
    "projects": [r"projects", r"project experience", r"key projects"],
    "certifications": [r"certifications", r"certificates", r"licenses"],
}

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def _get_extension(filename: str) -> str:
    dot_index = filename.rfind(".")
    if dot_index < 0:
        return ""
    return filename[dot_index:].lower()


def _normalize_line(line: str) -> str:
    return re.sub(r"[\s:|]+", " ", line.strip().lower())


def _heading_style(line: str) -> str:
    stripped = line.strip()
    if not stripped:
        return "unknown"
    alpha_chars = [ch for ch in stripped if ch.isalpha()]
    if not alpha_chars:
        return "unknown"
    if all(ch.isupper() for ch in alpha_chars):
        return "upper"
    if all(ch.islower() for ch in alpha_chars):
        return "lower"
    if stripped == stripped.title():
        return "title"
    return "mixed"


def extract_text(file_name: str, file_bytes: bytes) -> str:
    """
    Extract plain text from PDF, DOCX, and TXT files.
    """
    if not file_bytes:
        raise HTTPException(status_code=400, detail=f"{file_name}: file is empty")

    extension = _get_extension(file_name)
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"{file_name}: unsupported format. Allowed: PDF, DOCX, TXT",
        )

    if extension == ".txt":
        text = file_bytes.decode("utf-8", errors="ignore")
    elif extension == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise HTTPException(
                status_code=500, detail="PDF parser dependency missing (pypdf)"
            ) from exc

        reader = PdfReader(io.BytesIO(file_bytes))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    else:  # .docx
        try:
            from docx import Document
        except ImportError as exc:
            raise HTTPException(
                status_code=500, detail="DOCX parser dependency missing (python-docx)"
            ) from exc

        document = Document(io.BytesIO(file_bytes))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)

    cleaned = text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{file_name}: extracted text is empty")
    return cleaned


def detect_sections(text: str) -> Dict[str, object]:
    """
    Detect known and custom headings and preserve section order.
    """
    lines = text.splitlines()
    detected_order: List[str] = []
    detected_set = set()
    heading_lines: Dict[str, str] = {}
    custom_headings: List[str] = []
    section_patterns = {
        section: [re.compile(rf"^\s*{pattern}\s*[:\-]?\s*$", re.IGNORECASE) for pattern in patterns]
        for section, patterns in SECTION_KEYWORDS.items()
    }

    for idx, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue

        matched_section = None
        for section, patterns in section_patterns.items():
            if any(pattern.match(line) for pattern in patterns):
                matched_section = section
                break

        if matched_section:
            if matched_section not in detected_set:
                detected_set.add(matched_section)
                detected_order.append(matched_section)
                heading_lines[matched_section] = line
            continue

        # Heuristic: heading-like short lines in title/upper format are treated as custom sections.
        normalized = _normalize_line(line)
        token_count = len(normalized.split())
        if 0 < token_count <= 4 and (_heading_style(line) in {"upper", "title"}):
            previous_is_blank = idx == 0 or not lines[idx - 1].strip()
            if previous_is_blank:
                if normalized not in custom_headings:
                    custom_headings.append(normalized)

    return {
        "detected_order": detected_order,
        "heading_lines": heading_lines,
        "custom_headings": custom_headings,
    }


def compare_order(expected_order: Sequence[str], detected_order: Sequence[str]) -> bool:
    """
    Compare order only for shared sections between template and resume.
    """
    shared = [section for section in expected_order if section in detected_order]
    resume_filtered = [section for section in detected_order if section in shared]
    return shared == resume_filtered


def _consistency_score(text: str, heading_lines: Dict[str, str]) -> float:
    lines = text.splitlines()
    heading_style_scores = []
    spacing_scores = []
    normalized_heading_values = {_normalize_line(value) for value in heading_lines.values()}

    if heading_lines:
        styles = [_heading_style(line) for line in heading_lines.values() if line.strip()]
        if styles:
            dominant = max(set(styles), key=styles.count)
            heading_style_scores = [1.0 if style == dominant else 0.0 for style in styles]

    for idx, raw_line in enumerate(lines):
        normalized = _normalize_line(raw_line)
        if normalized in normalized_heading_values:
            before_blank = idx > 0 and not lines[idx - 1].strip()
            after_blank = idx + 1 < len(lines) and not lines[idx + 1].strip()
            spacing_scores.append(1.0 if before_blank or after_blank else 0.5)

    style_component = (sum(heading_style_scores) / len(heading_style_scores)) if heading_style_scores else 0.6
    spacing_component = (sum(spacing_scores) / len(spacing_scores)) if spacing_scores else 0.6
    return round(((style_component * 0.5) + (spacing_component * 0.5)) * 100, 2)


def calculate_format_score(
    expected_order: Sequence[str],
    detected_order: Sequence[str],
    missing_sections: Sequence[str],
    consistency_score: float,
) -> int:
    total_expected = len(expected_order) if expected_order else 1
    presence_ratio = max(0.0, (total_expected - len(missing_sections)) / total_expected)
    order_ratio = 1.0 if compare_order(expected_order, detected_order) else 0.0
    consistency_ratio = max(0.0, min(consistency_score / 100.0, 1.0))

    weighted_score = (
        (presence_ratio * 40.0)
        + (order_ratio * 30.0)
        + (consistency_ratio * 30.0)
    )
    return int(round(weighted_score))


def analyze_resume_format(
    resume_name: str, resume_text: str, expected_order: Sequence[str]
) -> Dict[str, object]:
    detected = detect_sections(resume_text)
    detected_order = detected["detected_order"]
    custom_headings = detected["custom_headings"]
    missing_sections = [section for section in expected_order if section not in detected_order]
    extra_sections = custom_headings
    is_order_correct = compare_order(expected_order, detected_order)
    consistency = _consistency_score(resume_text, detected["heading_lines"])
    format_score = calculate_format_score(
        expected_order=expected_order,
        detected_order=detected_order,
        missing_sections=missing_sections,
        consistency_score=consistency,
    )

    feedback_parts: List[str] = []
    if missing_sections:
        feedback_parts.append(f"Add missing sections: {', '.join(missing_sections)}.")
    if not is_order_correct:
        feedback_parts.append("Reorder sections to match the template sequence.")
    if extra_sections:
        feedback_parts.append(f"Review extra headings: {', '.join(extra_sections)}.")
    if not feedback_parts:
        feedback_parts.append("Formatting is aligned with the template.")

    return {
        "resume_name": resume_name,
        "format_score": format_score,
        "missing_sections": missing_sections,
        "extra_sections": extra_sections,
        "order_correct": is_order_correct,
        "detected_order": detected_order,
        "expected_order": list(expected_order),
        "feedback": " ".join(feedback_parts),
    }


async def read_upload_file(file: UploadFile) -> Tuple[str, str]:
    content = await file.read()
    extracted = extract_text(file.filename or "uploaded_file", content)
    return file.filename or "uploaded_file", extracted

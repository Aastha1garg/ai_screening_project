import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "./api";
import { formatErrorForDisplay } from "../utils/errorHandler";

function ImproveResume({ history = [], token }) {
  const [resumeId, setResumeId] = useState("");
  const [jdId, setJdId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!resumeId && history.length > 0) {
      setResumeId(String(history[0].id));
    }
  }, [history, resumeId]);

  const jdOptions = useMemo(() => {
    const byName = new Map();
    history.forEach((item) => {
      if (!byName.has(item.jd_name)) {
        byName.set(item.jd_name, item.id);
      }
    });
    return Array.from(byName.entries()).map(([name, id]) => ({ id, name }));
  }, [history]);

  const runImprove = async () => {
    if (!resumeId) {
      setError("Please select a resume.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post(
        "/improve-resume",
        {
          resume_id: Number(resumeId),
          jd_id: jdId ? Number(jdId) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data || null);
    } catch (err) {
      setError(formatErrorForDisplay(err?.response?.data?.detail, "Failed to improve resume."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-content">
      <section className="card">
        <h3>Improve Resume</h3>
        <p className="muted">Generate ATS-focused rewrites and missing keyword suggestions.</p>
        <div className="filter-grid">
          <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            <option value="">Select Resume</option>
            {history.map((item) => (
              <option key={item.id} value={item.id}>
                {item.resume_name}
              </option>
            ))}
          </select>
          <select value={jdId} onChange={(e) => setJdId(e.target.value)}>
            <option value="">Use Original JD</option>
            {jdOptions.map((jd) => (
              <option key={jd.id} value={jd.id}>
                {jd.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={runImprove} disabled={loading}>
            {loading ? "Improving..." : "Improve Resume"}
          </button>
        </div>
        {error && <p className="error">{formatErrorForDisplay(error)}</p>}
      </section>

      {result && (
        <>
          <section className="card">
            <h3>Improved Summary</h3>
            <p>{result.improved_summary || "No summary suggestions returned."}</p>
          </section>

          <section className="card">
            <h3>Improved Bullet Points</h3>
            {(result.improved_bullets || []).length ? (
              <ul>
                {(result.improved_bullets || []).map((item, idx) => (
                  <li key={`bullet-${idx}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No bullet suggestions available.</p>
            )}
          </section>

          <section className="card">
            <h3>Missing Keywords</h3>
            {(result.missing_keywords || []).length ? (
              <div className="skill-tags">
                {(result.missing_keywords || []).map((item) => (
                  <span key={item} className="skill-tag missing">{item}</span>
                ))}
              </div>
            ) : (
              <p className="muted">No missing keywords identified.</p>
            )}
          </section>

          <section className="card">
            <h3>ATS Suggestions</h3>
            {(result.ats_suggestions || []).length ? (
              <ul>
                {(result.ats_suggestions || []).map((item, idx) => (
                  <li key={`suggestion-${idx}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No ATS suggestions generated.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default ImproveResume;

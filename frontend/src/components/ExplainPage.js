import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "./api";
import { formatErrorForDisplay } from "../utils/errorHandler";

function ExplainPage({ history = [], token }) {
  const [resumeId, setResumeId] = useState("");
  const [jdId, setJdId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState(null);

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

  const runExplain = async () => {
    if (!resumeId) {
      setError("Please select a resume.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post(
        "/explain-score",
        {
          resume_id: Number(resumeId),
          jd_id: jdId ? Number(jdId) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExplanation(res.data);
    } catch (err) {
      setError(formatErrorForDisplay(err?.response?.data?.detail, "Failed to generate explanation."));
    } finally {
      setLoading(false);
    }
  };

  const skillRows = useMemo(() => {
    if (!explanation) return [];
    const resumeSkillSet = new Set(explanation.resume_skills || []);
    const jdSkillSet = new Set(explanation.jd_skills || []);
    const allSkills = Array.from(new Set([...(explanation.jd_skills || []), ...(explanation.resume_skills || [])]))
      .sort((a, b) => a.localeCompare(b));
    return allSkills.map((skill) => ({
      skill,
      inResume: resumeSkillSet.has(skill),
      inJd: jdSkillSet.has(skill),
    }));
  }, [explanation]);

  return (
    <div className="dashboard-content">
      <section className="card">
        <h3>Explainable AI Panel</h3>
        <p className="muted">Understand exactly how each score component contributes to the final result.</p>
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
          <button type="button" onClick={runExplain} disabled={loading}>
            {loading ? "Analyzing..." : "Explain Score"}
          </button>
        </div>
        {error && <p className="error">{formatErrorForDisplay(error)}</p>}
      </section>

      {explanation && (
        <>
          <section className="card">
            <h3>Skill Comparison Table</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Resume</th>
                  <th>JD</th>
                </tr>
              </thead>
              <tbody>
                {skillRows.length ? (
                  skillRows.map((row) => (
                    <tr key={row.skill}>
                      <td>{row.skill}</td>
                      <td>{row.inResume ? "✔" : "❌"}</td>
                      <td>{row.inJd ? "✔" : "❌"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3">No skills found for this pairing.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h3>Score Breakdown</h3>
            <p><strong>Confidence Score</strong> → {explanation.confidence_score ?? 0}%</p>
            <p><strong>Skill Score (60%)</strong> → {explanation.score_breakdown?.skill ?? 0}</p>
            <p><strong>Experience (10%)</strong> → {explanation.score_breakdown?.experience ?? 0}</p>
            <p><strong>Education (5%)</strong> → {explanation.score_breakdown?.education ?? 0}</p>
            <p><strong>Certification (5%)</strong> → {explanation.score_breakdown?.certification ?? 0}</p>
            <p><strong>Format (5%)</strong> → {explanation.score_breakdown?.format ?? 0}</p>
            <p><strong>Similarity (15%)</strong> → {explanation.score_breakdown?.similarity ?? 0}</p>
            <p><strong>Final Score</strong> = {explanation.final_score ?? 0}</p>
          </section>

          <section className="card">
            <h3>Why This Score</h3>
            <p><strong>Matched skills:</strong> {(explanation.matched_skills || []).join(", ") || "N/A"}</p>
            <p><strong>Missing skills:</strong> {(explanation.missing_skills || []).join(", ") || "N/A"}</p>
            <p>
              <strong>Experience comparison:</strong>{" "}
              {(explanation.experience?.total_years ?? 0)}y total vs {(explanation.experience?.required_years ?? 0)}y
              {" "}required
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default ExplainPage;

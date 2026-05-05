import React, { useState } from "react";
import { apiClient } from "./api";

function ResultsPanel({ results, shortlistedIds, onToggleShortlist }) {
  const [loadingKey, setLoadingKey] = useState("");
  const [feedbackByKey, setFeedbackByKey] = useState({});
  const [expandedByKey, setExpandedByKey] = useState({});
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [error, setError] = useState("");

const getKey = (item) =>
  item.id || `${item.resume_name}-${item.jd_name}`;
  const getScoreLabel = (score) => {
    if (score >= 85) return "Excellent match";
    if (score >= 75) return "Strong fit";
    if (score >= 65) return "Good fit";
    return "Needs improvement";
  };

  const getScoreClass = (score) => {
    if (score >= 85) return "score-chip excellent";
    if (score >= 75) return "score-chip good";
    if (score >= 65) return "score-chip caution";
    return "score-chip weak";
  };

  const generateFeedback = async (item, forceRegenerate = false) => {
    const key = getKey(item);
    setError("");
    if (!forceRegenerate && feedbackByKey[key]) {
      setSelectedFeedback({ key, item, feedback: feedbackByKey[key] });
      return;
    }
    setLoadingKey(key);
    try {
      const res = await apiClient.post(
        "/ai-feedback",
        {
          resume_text: item.resume_text || "",
          jd_text: item.jd_text || "",
          score: Number(item.score || 0),
          matched_skills: item.matched_skills || [],
          missing_skills: item.missing_skills || [],
        },
      );
      const aiFeedback = res.data?.ai_feedback || {};
      setFeedbackByKey((prev) => ({ ...prev, [key]: aiFeedback }));
      setSelectedFeedback({ key, item, feedback: aiFeedback });
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to generate AI feedback.");
    } finally {
      setLoadingKey("");
    }
  };

  if (!results || !results.length) {
    return (
      <section className="card">
        <h3>AI Insights</h3>
        <p>Upload files to view screening analytics and AI feedback.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Scoring Dashboard</h3>
      {error && <p className="error">{error}</p>}
      <div className="stack">
        {results.map((item, index) => (
          <div className="chart-box" key={getKey(item)}>
            <div className="score-row">
              <p className="score-line">{item.resume_name}</p>
              <div className="inline-controls">
                <span className="pill">{item.jd_name}</span>
                {(shortlistedIds || []).includes(Number(item.id)) && (
                  <span className="shortlisted-badge">Shortlisted</span>
                )}
              </div>
            </div>
            <p>
              <strong>Final score:</strong>{" "}
              <span className={getScoreClass(Number(item.score))}>
                {item.score} – {getScoreLabel(Number(item.score))}
              </span>
            </p>
            <div className="inline-controls">
              <button
                type="button"
                onClick={() => generateFeedback(item, false)}
                disabled={loadingKey === getKey(item)}
              >
                {loadingKey === getKey(item) ? "Generating..." : "Generate AI Feedback"}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => generateFeedback(item, true)}
                disabled={loadingKey === getKey(item)}
              >
                Regenerate Feedback
              </button>
              <button
                type="button"
                className={(shortlistedIds || []).includes(Number(item.id)) ? "secondary-btn" : ""}
                onClick={() =>
                  onToggleShortlist(Number(item.id), !(shortlistedIds || []).includes(Number(item.id)))
                }
              >
                {(shortlistedIds || []).includes(Number(item.id)) ? "Remove Shortlist" : "Shortlist"}
              </button>
              {!!feedbackByKey[getKey(item)] && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setExpandedByKey((prev) => ({ ...prev, [getKey(item)]: !prev[getKey(item)] }))
                  }
                >
                  {expandedByKey[getKey(item)] ? "Collapse" : "Expand"}
                </button>
              )}
            </div>
            {!!feedbackByKey[getKey(item)] && expandedByKey[getKey(item)] && (
              <div className="feedback-preview">
                <p className="feedback-green">
                  <strong>Strengths:</strong> {(feedbackByKey[getKey(item)].strengths || []).join(" | ")}
                </p>
                <p className="feedback-red">
                  <strong>Weaknesses:</strong> {(feedbackByKey[getKey(item)].weaknesses || []).join(" | ")}
                </p>
                <p className="feedback-yellow">
                  <strong>Missing Skills:</strong>{" "}
                  {(feedbackByKey[getKey(item)].missing_skills || []).join(" | ")}
                </p>
                <p className="feedback-blue">
                  <strong>Suggestions:</strong> {(feedbackByKey[getKey(item)].suggestions || []).join(" | ")}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      {selectedFeedback && (
        <div className="modal-overlay" onClick={() => setSelectedFeedback(null)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="presentation">
            <h4>AI Resume Feedback</h4>
            <p className="muted">
              {selectedFeedback.item.resume_name} - {selectedFeedback.item.jd_name}
            </p>
            <div className="feedback-preview">
              <p className="feedback-green">
                <strong>Strengths:</strong> {(selectedFeedback.feedback?.strengths || []).join(" | ")}
              </p>
              <p className="feedback-red">
                <strong>Weaknesses:</strong> {(selectedFeedback.feedback?.weaknesses || []).join(" | ")}
              </p>
              <p className="feedback-yellow">
                <strong>Missing Skills:</strong>{" "}
                {(selectedFeedback.feedback?.missing_skills || []).join(" | ")}
              </p>
              <p className="feedback-blue">
                <strong>Suggestions:</strong> {(selectedFeedback.feedback?.suggestions || []).join(" | ")}
              </p>
            </div>
            <div className="inline-controls">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setExpandedByKey((prev) => ({
                    ...prev,
                    [selectedFeedback.key]: !prev[selectedFeedback.key],
                  }))
                }
              >
                {expandedByKey[selectedFeedback.key] ? "Collapse" : "Expand"}
              </button>
              <button type="button" onClick={() => setSelectedFeedback(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ResultsPanel;

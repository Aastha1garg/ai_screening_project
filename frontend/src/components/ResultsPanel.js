import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "./api";
import { formatErrorForDisplay } from "../utils/errorHandler";

function ResultsPanel({ results, shortlistedIds, onToggleShortlist }) {
  const { t } = useTranslation();
  const [loadingKey, setLoadingKey] = useState("");
  const [feedbackByKey, setFeedbackByKey] = useState({});
  const [expandedByKey, setExpandedByKey] = useState({});
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [error, setError] = useState("");

const getKey = (item) =>
  item.id || `${item.resume_name}-${item.jd_name}`;
  const getScoreLabel = (score) => {
    if (score >= 85) return t("results.excellentMatch");
    if (score >= 75) return t("results.strongFit");
    if (score >= 65) return t("results.goodFit");
    return t("results.needsImprovement");
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
      setError(formatErrorForDisplay(err?.response?.data?.detail, t("results.feedbackFailed")));
    } finally {
      setLoadingKey("");
    }
  };

  if (!results || !results.length) {
    return (
      <section className="card">
        <h3>{t("results.title")}</h3>
        <p>{t("results.emptyDescription")}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>{t("results.title")}</h3>
      {error && <p className="error">{formatErrorForDisplay(error)}</p>}
      <div className="stack">
        {results.map((item, index) => (
          <div className="chart-box" key={getKey(item)}>
            <div className="score-row">
              <p className="score-line">{item.resume_name}</p>
              <div className="inline-controls">
                <span className="pill">{item.jd_name}</span>
                {(shortlistedIds || []).includes(Number(item.id)) && (
                  <span className="shortlisted-badge">{t("results.shortlisted")}</span>
                )}
              </div>
            </div>
            <p>
              <strong>{t("results.finalScore")}</strong>{" "}
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
                {loadingKey === getKey(item) ? t("results.generating") : t("results.generateFeedback")}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => generateFeedback(item, true)}
                disabled={loadingKey === getKey(item)}
              >
                {t("results.regenerateFeedback")}
              </button>
              <button
                type="button"
                className={(shortlistedIds || []).includes(Number(item.id)) ? "secondary-btn" : ""}
                onClick={() =>
                  onToggleShortlist(Number(item.id), !(shortlistedIds || []).includes(Number(item.id)))
                }
              >
                {(shortlistedIds || []).includes(Number(item.id)) ? t("results.removeShortlist") : t("results.shortlist")}
              </button>
              {!!feedbackByKey[getKey(item)] && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() =>
                    setExpandedByKey((prev) => ({ ...prev, [getKey(item)]: !prev[getKey(item)] }))
                  }
                >
                  {expandedByKey[getKey(item)] ? t("results.collapse") : t("results.expand")}
                </button>
              )}
            </div>
            {!!feedbackByKey[getKey(item)] && expandedByKey[getKey(item)] && (
              <div className="feedback-preview">
                {(() => {
                  const feedback = feedbackByKey[getKey(item)];
                  const strengths = feedback?.strengths || [];
                  const weaknesses = feedback?.weaknesses || [];
                  const missing_skills = feedback?.missing_skills || [];
                  const suggestions = feedback?.suggestions || [];

                  const hasStrengths = Array.isArray(strengths) ? strengths.length > 0 : Boolean(strengths);
                  const hasWeaknesses = Array.isArray(weaknesses) ? weaknesses.length > 0 : Boolean(weaknesses);
                  const hasMissingSkills = Array.isArray(missing_skills) ? missing_skills.length > 0 : Boolean(missing_skills);
                  const hasSuggestions = Array.isArray(suggestions) ? suggestions.length > 0 : Boolean(suggestions);

                  return (
                    <>
                      {hasStrengths && (
                        <p className="feedback-green">
                          <strong>{t("results.strengths")}</strong>: {Array.isArray(strengths) ? strengths.join(" | ") : strengths}
                        </p>
                      )}
                      {hasWeaknesses && (
                        <p className="feedback-red">
                          <strong>{t("results.weaknesses")}</strong>: {Array.isArray(weaknesses) ? weaknesses.join(" | ") : weaknesses}
                        </p>
                      )}
                      {hasMissingSkills && (
                        <p className="feedback-yellow">
                          <strong>{t("results.missingSkills")}</strong>: {Array.isArray(missing_skills) ? missing_skills.join(" | ") : missing_skills}
                        </p>
                      )}
                      {hasSuggestions && (
                        <p className="feedback-blue">
                          <strong>{t("results.suggestions")}</strong>: {Array.isArray(suggestions) ? suggestions.join(" | ") : suggestions}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
      {selectedFeedback && (
        <div className="modal-overlay" onClick={() => setSelectedFeedback(null)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="presentation">
            <h4>{t("results.aiFeedbackTitle")}</h4>
            <p className="muted">
              {selectedFeedback.item.resume_name} - {selectedFeedback.item.jd_name}
            </p>
            <div className="feedback-preview">
              {(() => {
                const feedback = selectedFeedback.feedback;
                const strengths = feedback?.strengths || [];
                const weaknesses = feedback?.weaknesses || [];
                const missing_skills = feedback?.missing_skills || [];
                const suggestions = feedback?.suggestions || [];

                const hasStrengths = Array.isArray(strengths) ? strengths.length > 0 : Boolean(strengths);
                const hasWeaknesses = Array.isArray(weaknesses) ? weaknesses.length > 0 : Boolean(weaknesses);
                const hasMissingSkills = Array.isArray(missing_skills) ? missing_skills.length > 0 : Boolean(missing_skills);
                const hasSuggestions = Array.isArray(suggestions) ? suggestions.length > 0 : Boolean(suggestions);

                return (
                  <>
                    {hasStrengths && (
                      <p className="feedback-green">
                        <strong>{t("results.strengths")}</strong>: {Array.isArray(strengths) ? strengths.join(" | ") : strengths}
                      </p>
                    )}
                    {hasWeaknesses && (
                      <p className="feedback-red">
                        <strong>{t("results.weaknesses")}</strong>: {Array.isArray(weaknesses) ? weaknesses.join(" | ") : weaknesses}
                      </p>
                    )}
                    {hasMissingSkills && (
                      <p className="feedback-yellow">
                        <strong>{t("results.missingSkills")}</strong>: {Array.isArray(missing_skills) ? missing_skills.join(" | ") : missing_skills}
                      </p>
                    )}
                    {hasSuggestions && (
                      <p className="feedback-blue">
                        <strong>{t("results.suggestions")}</strong>: {Array.isArray(suggestions) ? suggestions.join(" | ") : suggestions}
                      </p>
                    )}
                  </>
                );
              })()}
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
                {expandedByKey[selectedFeedback.key] ? t("results.collapse") : t("results.expand")}
              </button>
              <button type="button" onClick={() => setSelectedFeedback(null)}>
                {t("results.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ResultsPanel;

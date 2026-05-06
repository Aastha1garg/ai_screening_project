import React, { useState } from "react";
import { apiClient } from "./api";
import { formatErrorForDisplay } from "../utils/errorHandler";

function ShortlistedCandidatesPage({ history = [], shortlistedIds = [], onToggleShortlist, onShortlistChanged }) {
  const [thresholds, setThresholds] = useState({
    min_skill_match: "",
    min_score: "",
    min_experience: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const candidates = history.filter(
    (row) => row.shortlisted || shortlistedIds.includes(Number(row.id))
  );

  const handleAutoShortlist = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        min_skill_match: thresholds.min_skill_match === "" ? null : Number(thresholds.min_skill_match),
        min_score: thresholds.min_score === "" ? null : Number(thresholds.min_score),
        min_experience: thresholds.min_experience === "" ? null : Number(thresholds.min_experience),
      };
      const res = await apiClient.post("/shortlist/auto", payload);
      setMessage(`Auto-shortlisted ${res.data?.count || 0} candidate(s).`);
      await onShortlistChanged();
    } catch (err) {
      setError(formatErrorForDisplay(err?.response?.data?.detail, "Auto-shortlist failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h3>Shortlisted Candidates</h3>
      <p className="muted">Manage manual shortlist and run auto-shortlist using thresholds.</p>

      <div className="filter-grid">
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Skill Match % threshold"
          value={thresholds.min_skill_match}
          onChange={(e) => setThresholds((prev) => ({ ...prev, min_skill_match: e.target.value }))}
        />
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Score threshold"
          value={thresholds.min_score}
          onChange={(e) => setThresholds((prev) => ({ ...prev, min_score: e.target.value }))}
        />
        <input
          type="number"
          min="0"
          placeholder="Experience threshold (years)"
          value={thresholds.min_experience}
          onChange={(e) => setThresholds((prev) => ({ ...prev, min_experience: e.target.value }))}
        />
      </div>
      <div className="inline-controls">
        <button type="button" disabled={loading} onClick={handleAutoShortlist}>
          {loading ? "Auto-shortlisting..." : "Run Auto-Shortlist"}
        </button>
      </div>

      {message && <p>{formatErrorForDisplay(message)}</p>}
      {error && <p className="error">{formatErrorForDisplay(error)}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Score</th>
            <th>Skill Match</th>
            <th>Experience</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.length ? (
            candidates.map((candidate) => {
              const experienceValue = candidate.experience;

              const experienceText =
                typeof experienceValue === "object"
                  ? `${experienceValue?.total_years ?? experienceValue?.relevant_years ?? 0}y`
                  : experienceValue;

              return (
                <tr key={candidate.id}>
                  <td>
                    {candidate.name || candidate.resume_name}{" "}
                    <span className="shortlisted-badge">Shortlisted</span>
                  </td>

                  <td>{candidate.email || "N/A"}</td>
                  <td>{candidate.score}</td>
                  <td>{candidate.skill_score}</td>

                  <td>{experienceText}</td>

                  <td>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={async () => {
                        await onToggleShortlist(Number(candidate.id), false);
                        await onShortlistChanged();
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="6">No shortlisted candidates yet.</td>
            </tr>
          )}
       </tbody>
      </table>
    </section>
  );
}

export default ShortlistedCandidatesPage;

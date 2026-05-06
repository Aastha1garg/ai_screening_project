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
  const [validationError, setValidationError] = useState("");

  // Validate and convert numeric input
  const validateAndConvertNumber = (value, fieldName) => {
    if (value === "" || value === null || value === undefined) {
      return { valid: true, result: null };
    }
    
    // Convert to number if string, or accept if already a number
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    
    if (isNaN(numValue)) {
      setValidationError(`${fieldName} must be a valid number`);
      return { valid: false, result: null };
    }
    if (numValue < 0) {
      setValidationError(`${fieldName} must be >= 0`);
      return { valid: false, result: null };
    }
    return { valid: true, result: numValue };
  };

  // Handle input change with proper conversion
  const handleThresholdChange = (field, value) => {
    setValidationError("");
    // For number inputs, convert to integer if not empty
    if (value === "") {
      setThresholds((prev) => ({ ...prev, [field]: "" }));
    } else {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        setThresholds((prev) => ({ ...prev, [field]: parsed }));
      }
      // If invalid, state remains unchanged (doesn't update)
    }
  };

  const candidates = history.filter(
    (row) => row.shortlisted || shortlistedIds.includes(Number(row.id))
  );

  const handleAutoShortlist = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    setValidationError("");

    try {
      // Validate and convert all inputs
      const skillMatchResult = validateAndConvertNumber(
        thresholds.min_skill_match,
        "Skill Match threshold"
      );
      if (!skillMatchResult.valid) {
        setLoading(false);
        return;
      }

      const scoreResult = validateAndConvertNumber(
        thresholds.min_score,
        "Score threshold"
      );
      if (!scoreResult.valid) {
        setLoading(false);
        return;
      }

      const experienceResult = validateAndConvertNumber(
        thresholds.min_experience,
        "Experience threshold"
      );
      if (!experienceResult.valid) {
        setLoading(false);
        return;
      }

      // Build payload with validated integers or null
      const payload = {
        min_skill_match: skillMatchResult.result,
        min_score: scoreResult.result,
        min_experience: experienceResult.result,
      };

      console.log("Payload being sent:", payload);
      console.log("Payload types:", {
        min_skill_match: typeof payload.min_skill_match,
        min_score: typeof payload.min_score,
        min_experience: typeof payload.min_experience,
      });

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
          step="1"
          placeholder="Skill Match % threshold"
          value={thresholds.min_skill_match}
          onChange={(e) => handleThresholdChange("min_skill_match", e.target.value)}
        />
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="Score threshold"
          value={thresholds.min_score}
          onChange={(e) => handleThresholdChange("min_score", e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Experience threshold (years)"
          value={thresholds.min_experience}
          onChange={(e) => handleThresholdChange("min_experience", e.target.value)}
        />
      </div>
      <div className="inline-controls">
        <button type="button" disabled={loading} onClick={handleAutoShortlist}>
          {loading ? "Auto-shortlisting..." : "Run Auto-Shortlist"}
        </button>
      </div>

      {validationError && <p className="error">{validationError}</p>}
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

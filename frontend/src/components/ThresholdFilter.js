import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

function ThresholdFilter({ onThresholdChange, currentThreshold = 60 }) {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState(currentThreshold);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setThreshold(currentThreshold);
    setError("");
  }, [currentThreshold]);

  const handleThresholdChange = (e) => {
    const value = e.target.value;
    setSuccess(false);

    // Allow empty string while typing
    if (value === "") {
      setThreshold("");
      setError("");
      return;
    }

    const numValue = Number(value);

    // Validate input
    if (isNaN(numValue)) {
      setError("Please enter a valid number");
      return;
    }

    if (numValue < 0 || numValue > 100) {
      setError("Threshold must be between 0 and 100");
      return;
    }

    setThreshold(numValue);
    setError("");
  };

  const handleApplyThreshold = async () => {
    if (threshold === "" || threshold === null || threshold === undefined) {
      setError("Please enter a threshold value");
      return;
    }

    const numValue = Number(threshold);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      setError("Threshold must be a number between 0 and 100");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess(false);
    
    try {
      await onThresholdChange(numValue);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to apply threshold");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleApplyThreshold();
    }
  };

  return (
    <div className="threshold-filter-container">
      <div className="threshold-filter-group">
        <label htmlFor="threshold-input" className="threshold-label">
          Auto-Shortlist Threshold (%)
        </label>
        <div className="threshold-input-wrapper">
          <input
            id="threshold-input"
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={handleThresholdChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter threshold (0-100)"
            className={`threshold-input ${error ? "error" : ""} ${success ? "success" : ""}`}
            disabled={isLoading}
          />
          <span className="threshold-unit">%</span>
        </div>
        {error && <p className="threshold-error">{error}</p>}
        {success && <p className="threshold-success">✓ Threshold applied successfully</p>}
        <p className="threshold-description">
          Candidates with scores ≥ threshold will be automatically shortlisted.<br />
          Candidates below threshold will be rejected.
        </p>
        <button
          type="button"
          onClick={handleApplyThreshold}
          disabled={isLoading || threshold === "" || threshold === null}
          className={`threshold-apply-btn ${isLoading ? "loading" : ""} ${success ? "success" : ""}`}
        >
          {isLoading ? "Applying..." : success ? "Applied!" : "Apply Threshold"}
        </button>
      </div>
    </div>
  );
}

export default ThresholdFilter;


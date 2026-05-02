import React, { useState } from "react";
import { apiClient } from "./api";

const downloadActions = [
  { label: "Download All CSV", endpoint: "/download/all", filename: "all_resumes.csv" },
  { label: "Download Rejected", endpoint: "/download/rejected", filename: "rejected_resumes.csv" },
  {
    label: "Download Format Matched",
    endpoint: "/download/format-matched",
    filename: "format_matched_resumes.csv",
  },
  { label: "Download With Scores", endpoint: "/download/scored", filename: "scored_resumes.csv" },
];

function DownloadPanel({ history = [], token }) {
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("");
  const [filters, setFilters] = useState({
    min_score: "",
    min_experience: "",
    min_skill_match: "",
    status: "",
    min_format_score: "",
  });

  const handleDownload = async ({ endpoint, filename, label }) => {
    setError("");
    setLoadingLabel(label);
    try {
      const res = await apiClient.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to download CSV.");
    } finally {
      setLoadingLabel("");
    }
  };

  const handleFilteredDownload = async () => {
    const payload = {
      min_score: filters.min_score === "" ? null : Number(filters.min_score),
      min_experience: filters.min_experience === "" ? null : Number(filters.min_experience),
      min_skill_match: filters.min_skill_match === "" ? null : Number(filters.min_skill_match),
      status: filters.status || null,
      min_format_score: filters.min_format_score === "" ? null : Number(filters.min_format_score),
    };
    setError("");
    setLoadingLabel("Download Filtered CSV");
    try {
      const res = await apiClient.post("/download-filtered", payload, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "filtered_resumes.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to download filtered CSV.");
    } finally {
      setLoadingLabel("");
    }
  };

  const hasHistory = history.length > 0;

  return (
    <section className="card">
      <h3>Download Panel</h3>
      <p className="muted">Export screened resumes by status, score, and format quality.</p>
      <p className="muted">Available history items: {history.length}</p>
      <div className="filter-grid">
        <input
          type="number"
          placeholder="Score threshold"
          value={filters.min_score}
          onChange={(e) => setFilters((prev) => ({ ...prev, min_score: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Experience min years"
          value={filters.min_experience}
          onChange={(e) => setFilters((prev) => ({ ...prev, min_experience: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Skill match min %"
          value={filters.min_skill_match}
          onChange={(e) => setFilters((prev) => ({ ...prev, min_skill_match: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Format score min"
          value={filters.min_format_score}
          onChange={(e) => setFilters((prev) => ({ ...prev, min_format_score: e.target.value }))}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="">Status (all)</option>
          <option value="selected">selected</option>
          <option value="pending">pending</option>
          <option value="rejected">rejected</option>
        </select>
      </div>
      <div className="stack">
        {downloadActions.map((action) => (
          <button
            key={action.endpoint}
            type="button"
            disabled={!hasHistory || loadingLabel === action.label}
            onClick={() => handleDownload({ ...action, label: action.label })}
          >
            {loadingLabel === action.label ? "Preparing..." : action.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!hasHistory || loadingLabel === "Download Filtered CSV"}
          onClick={handleFilteredDownload}
        >
          {loadingLabel === "Download Filtered CSV" ? "Preparing..." : "Download Filtered CSV"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default DownloadPanel;

import React, { useMemo, useState } from "react";
import { formatEducationList } from "../formatEducation";
import FilterPanel from "./FilterPanel";

function ResumeTable({ rows, shortlistedIds, onToggleShortlist }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const [filters, setFilters] = useState({
    score: "",
    experience: "",
    skillMatch: "",
    status: "",
    formatScore: "",
    shortlistedOnly: false,
  });
  const [appliedFilters, setAppliedFilters] = useState({
    score: "",
    experience: "",
    skillMatch: "",
    status: "",
    formatScore: "",
    shortlistedOnly: false,
  });
  const [sortBy, setSortBy] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [quickTop10, setQuickTop10] = useState(false);

  const activeFilters = useMemo(
    () =>
      Object.entries(appliedFilters)
        .filter(([, value]) => value !== "" && value !== null && value !== undefined && value !== false)
        .map(([key, value]) => ({ key, value })),
    [appliedFilters]
  );

  const filteredRows = useMemo(() => {
    const filtered = (rows || []).filter(
      (r) =>
        (!appliedFilters.score || r.scoreValue >= Number(appliedFilters.score)) &&
        (!appliedFilters.experience || r.totalExperience >= Number(appliedFilters.experience)) &&
        (!appliedFilters.skillMatch || r.skillScore >= Number(appliedFilters.skillMatch)) &&
        (!appliedFilters.status || r.status === appliedFilters.status) &&
        (!appliedFilters.formatScore || r.formatScore >= Number(appliedFilters.formatScore)) &&
        (!appliedFilters.shortlistedOnly || r.shortlisted)
    );
    const sorted = [...filtered];
    if (sortBy === "score") {
      sorted.sort((a, b) =>
        sortOrder === "asc" ? a.scoreValue - b.scoreValue : b.scoreValue - a.scoreValue
      );
    } else if (sortBy === "experience") {
      sorted.sort((a, b) =>
        sortOrder === "asc" ? a.totalExperience - b.totalExperience : b.totalExperience - a.totalExperience
      );
    }
    return sorted;
  }, [rows, appliedFilters, sortBy, sortOrder]);

  const applyQuickFilter = (type) => {
    if (type === "score50") {
      setQuickTop10(false);
      setAppliedFilters((prev) => ({ ...prev, score: "50" }));
      setFilters((prev) => ({ ...prev, score: "50" }));
      return;
    }
    if (type === "score70") {
      setQuickTop10(false);
      setAppliedFilters((prev) => ({ ...prev, score: "70" }));
      setFilters((prev) => ({ ...prev, score: "70" }));
      return;
    }
    if (type === "highSkill") {
      setQuickTop10(false);
      setAppliedFilters((prev) => ({ ...prev, skillMatch: "70" }));
      setFilters((prev) => ({ ...prev, skillMatch: "70" }));
      return;
    }
    if (type === "top10") {
      setQuickTop10(true);
      setSortBy("score");
      setSortOrder("desc");
      setAppliedFilters({
        score: "",
        experience: "",
        skillMatch: "",
        status: "",
        formatScore: "",
        shortlistedOnly: false,
      });
      setFilters({
        score: "",
        experience: "",
        skillMatch: "",
        status: "",
        formatScore: "",
        shortlistedOnly: false,
      });
      setSelectedRow(null);
      return;
    }
  };

  const displayRows = useMemo(() => {
    if (quickTop10) {
      return filteredRows.slice(0, 10);
    }
    return filteredRows;
  }, [filteredRows, quickTop10]);

  const handleApplyFilters = () => {
    setQuickTop10(false);
    setAppliedFilters({ ...filters });
  };

  const handleClearFilters = () => {
    const empty = {
      score: "",
      experience: "",
      skillMatch: "",
      status: "",
      formatScore: "",
      shortlistedOnly: false,
    };
    setQuickTop10(false);
    setFilters(empty);
    setAppliedFilters(empty);
  };

  return (
    <>
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        activeFilters={activeFilters}
        resultCount={displayRows.length}
      />
      <section className="card">
      <div className="table-header-row">
        <h3>Parsed Resume Table</h3>
        <div className="inline-controls">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">Sort by score</option>
            <option value="experience">Sort by experience</option>
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </div>
      </div>
      <div className="quick-filter-row">
        <button type="button" onClick={() => applyQuickFilter("score50")}>50+ Score</button>
        <button type="button" onClick={() => applyQuickFilter("score70")}>70+ Score</button>
        <button type="button" onClick={() => applyQuickFilter("top10")}>Top 10 Candidates</button>
        <button type="button" onClick={() => applyQuickFilter("highSkill")}>High Skill Match</button>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Final Score</th>
            <th>Skill Match</th>
            <th>Format Score</th>
            <th>Experience</th>
            <th>Matched / Missing Skills</th>
            <th>Sentiment</th>
            <th>Status</th>
            <th>Shortlist</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.length ? (
            displayRows.map((row) => (
              <tr key={`${row.name}-${row.jobRole}-${row.score}`}>
                <td>{row.name}</td>
                <td>{row.score}</td>
                <td>{row.skillScore}%</td>
                <td>{row.formatScore}</td>
                <td>{`${row.totalExperience}y / ${row.relevantExperience}y`}</td>
                <td>
                  <div className="skill-tags">
                    {row.matchedSkills.slice(0, 3).map((skill) => (
                      <span key={`${row.name}-m-${skill}`} className="skill-tag match">
                        {skill}
                      </span>
                    ))}
                    {row.missingSkills.slice(0, 3).map((skill) => (
                      <span key={`${row.name}-x-${skill}`} className="skill-tag missing">
                        {skill}
                      </span>
                    ))}
                    {row.partialMatches.slice(0, 2).map((skill) => (
                      <span key={`${row.name}-p-${skill}`} className="skill-tag partial">
                        {skill}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`pill sentiment-${row.sentiment}`}>{row.profileLabel}</span>
                </td>
                <td>
                  <span className={`status-pill ${row.status}`}>{row.status}</span>
                  {(shortlistedIds.includes(row.historyId) || row.shortlisted) && (
                    <span className="shortlisted-badge">Shortlisted</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={
                      shortlistedIds.includes(row.historyId) || row.shortlisted
                        ? "secondary-btn"
                        : ""
                    }
                    onClick={() =>
                      onToggleShortlist(
                        row.historyId,
                        !(shortlistedIds.includes(row.historyId) || row.shortlisted)
                      )
                    }
                  >
                    {shortlistedIds.includes(row.historyId) || row.shortlisted
                      ? "Remove"
                      : "Shortlist"}
                  </button>
                </td>
                <td>
                  <button type="button" onClick={() => setSelectedRow(row)}>
                    View Details
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10">No parsed resumes yet. Upload files to populate this table.</td>
            </tr>
          )}
        </tbody>
      </table>
      {selectedRow && (
        <div className="modal-overlay" onClick={() => setSelectedRow(null)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="presentation">
            <h4>{selectedRow.name}</h4>
            <p>
              <strong>Applied JD:</strong> {selectedRow.jobRole}
            </p>
            <p>
              <strong>Education:</strong> {formatEducationList(selectedRow.education)}
            </p>
            <p>
              <strong>Certifications:</strong> {selectedRow.certifications.join(", ") || "N/A"}
            </p>
            <p>
              <strong>Matched Skills:</strong> {selectedRow.matchedSkills.join(", ") || "N/A"}
            </p>
            <p>
              <strong>Missing Skills:</strong> {selectedRow.missingSkills.join(", ") || "N/A"}
            </p>
            <p>
              <strong>AI Strengths:</strong> {(selectedRow.feedback?.strengths || []).join(" | ")}
            </p>
            <p>
              <strong>AI Weaknesses:</strong> {(selectedRow.feedback?.weaknesses || []).join(" | ")}
            </p>
            <p>
              <strong>AI Suggestions:</strong> {(selectedRow.feedback?.suggestions || []).join(" | ")}
            </p>
            <button type="button" onClick={() => setSelectedRow(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
    </>
  );
}

export default ResumeTable;

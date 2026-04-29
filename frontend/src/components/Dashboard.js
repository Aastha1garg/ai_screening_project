import React, { useMemo } from "react";
import Charts from "./Charts";

function inferStatus(score) {
  if (Number.isNaN(score)) {
    return "failed";
  }
  if (score >= 75) {
    return "selected";
  }
  if (score >= 50) {
    return "pending";
  }
  return "rejected";
}

function normalizeRows(results) {
  return results.map((item) => {
    const numericScore = Number(item.score) || 0;
    const feedback = item.feedback || {};
    return {
      name: item.resume_name || "Unknown Candidate",
      jobRole: item.jd_name || "General Role",
      score: `${numericScore}%`,
      scoreValue: numericScore,
      skillScore: Number(item.skill_score || 0),
      formatScore: Number(item.format_score || 0),
      matchedSkills: item.matched_skills || [],
      missingSkills: item.missing_skills || [],
      partialMatches: item.partial_matches || [],
      totalExperience: Number(item.experience?.total_years || 0),
      relevantExperience: Number(item.experience?.relevant_years || 0),
      education: item.education || [],
      certifications: item.certifications || [],
      sentiment: item.sentiment || "neutral",
      profileLabel: item.profile_label || "Needs Improvement",
      feedback,
      status: inferStatus(numericScore),
    };
  });
}

function Dashboard({ results, searchQuery }) {
  const rows = useMemo(() => normalizeRows(results || []), [results]);
  const filteredRows = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.jobRole.toLowerCase().includes(term) ||
        row.matchedSkills.join(" ").toLowerCase().includes(term)
    );
  }, [rows, searchQuery]);
  const topCandidates = useMemo(
    () => [...filteredRows].sort((a, b) => b.scoreValue - a.scoreValue).slice(0, 10),
    [filteredRows]
  );

  const getBadge = (rank) => {
    if (rank === 1) return "🥇 Top Candidate";
    if (rank <= 3) return "🥈 Strong Match";
    return "🥉 Moderate Match";
  };

  return (
    <div className="dashboard-content">
      <section className="card">
        <h3>Top 10 Candidates</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Score</th>
              <th>Key Skills</th>
              <th>Badge</th>
            </tr>
          </thead>
          <tbody>
            {topCandidates.length ? (
              topCandidates.map((candidate, index) => (
                <tr key={`${candidate.name}-${candidate.jobRole}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{candidate.name}</td>
                  <td>{candidate.score}</td>
                  <td>{(candidate.matchedSkills || []).slice(0, 4).join(", ") || "N/A"}</td>
                  <td>{getBadge(index + 1)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">Upload and score resumes to view top candidates.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <Charts rows={filteredRows} />
    </div>
  );
}

export default Dashboard;

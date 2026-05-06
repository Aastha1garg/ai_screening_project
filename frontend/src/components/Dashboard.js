import React, { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Charts from "./Charts";
import AnalyticsDashboard from "./AnalyticsDashboard";

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
      extraSkills: item.extra_skills || [],
      partialMatches: item.partial_matches || [],
      totalExperience: Number(item.experience?.total_years || 0),
      relevantExperience: Number(item.experience?.relevant_years || 0),
      requiredExperience: Number(item.experience?.required_years || 0),
      education: item.education || [],
      requiredEducation: item.required_education || [],
      certifications: item.certifications || [],
      requiredCertifications: item.required_certifications || [],
      matchedCertifications: item.matched_certifications || [],
      missingCertifications: item.missing_certifications || [],
      extraCertifications: item.extra_certifications || [],
      educationMatch: item.education_match || "",
      experienceMatch: item.experience_match || "",
      scoreBreakdown: item.score_breakdown || {},
      sentiment: item.sentiment || "neutral",
      profileLabel: item.profile_label || "Needs Improvement",
      feedback,
      status: item.status || inferStatus(numericScore),
    };
  });
}

function Dashboard({ groupedResults, searchQuery }) {
  const { t } = useTranslation();
  const [activeJD, setActiveJD] = useState(groupedResults?.[0]?.jd_name || "");

  const groups = useMemo(
    () =>
      (groupedResults || []).map((group) => ({
        ...group,
        candidates: normalizeRows(group.candidates || []),
      })),
    [groupedResults]
  );

  useEffect(() => {
    if (!activeJD && groups.length) {
      setActiveJD(groups[0].jd_name);
      return;
    }
    if (activeJD && !groups.some((group) => group.jd_name === activeJD) && groups.length) {
      setActiveJD(groups[0].jd_name);
    }
  }, [groups, activeJD]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.jd_name === activeJD) || groups[0] || { candidates: [], jd_name: "Unknown JD", graph_data: { status_distribution: [], score_data: [], skill_distribution: [] } },
    [groups, activeJD]
  );

  const filteredRows = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const rows = selectedGroup.candidates || [];
    if (!term) {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.jobRole.toLowerCase().includes(term) ||
        row.matchedSkills.join(" ").toLowerCase().includes(term)
    );
  }, [selectedGroup, searchQuery]);

  const topCandidates = useMemo(
    () => [...filteredRows].sort((a, b) => b.scoreValue - a.scoreValue).slice(0, 10),
    [filteredRows]
  );

  const getBadge = (rank) => {
    if (rank === 1) return `🥇 ${t("dashboard.topCandidate")}`;
    if (rank <= 3) return `🥈 ${t("dashboard.strongMatch")}`;
    return `🥉 ${t("dashboard.moderateMatch")}`;
  };

  return (
    <div className="dashboard-content">
      <section className="card">
        <div className="dashboard-header-row">
          <div>
            <h3>{t("dashboard.jobDescriptionResults")}</h3>
            <p className="muted">{t("dashboard.showingResults", { jdName: selectedGroup.jd_name })}</p>
          </div>
          {groups.length > 1 && (
            <div className="jd-tabs">
              {groups.map((group) => (
                <button
                  key={group.jd_name}
                  type="button"
                  className={`tab-item ${group.jd_name === activeJD ? "active" : ""}`}
                  onClick={() => setActiveJD(group.jd_name)}
                >
                  {group.jd_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h3>{t("dashboard.topCandidatesForJD", { jdName: selectedGroup.jd_name })}</h3>
        <table className="table">
          <thead>
            <tr>
              <th>{t("dashboard.rank")}</th>
              <th>{t("dashboard.name")}</th>
              <th>{t("dashboard.score")}</th>
              <th>{t("dashboard.keySkills")}</th>
              <th>{t("dashboard.badge")}</th>
            </tr>
          </thead>
          <tbody>
            {topCandidates.length ? (
              topCandidates.map((candidate, index) => (
                <tr key={candidate.name + "-" + candidate.scoreValue + "-" + index}>
                  <td>{index + 1}</td>
                  <td>{candidate.name}</td>
                  <td>{candidate.score}</td>
                  <td>{(candidate.matchedSkills || []).slice(0, 4).join(", ") || "N/A"}</td>
                  <td>{getBadge(index + 1)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">{t("dashboard.emptyTopCandidates")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Charts rows={filteredRows} />
      <AnalyticsDashboard rows={filteredRows} />
    </div>
  );
}

export default Dashboard;

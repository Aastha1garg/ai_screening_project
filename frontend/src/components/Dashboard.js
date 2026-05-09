import React, { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
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
    const numericScore = Number(item.score ?? item.final_score) || 0;
    const feedback = item.feedback || {};
    
    // Safely extract certifications from various backend formats
    const certifications = item.certifications_all || item.certifications || [];
    const requiredCertifications = item.certifications_required || item.required_certifications || [];
    const matchedCertifications = item.certifications_matched || item.matched_certifications || [];
    const missingCertifications = item.certifications_missing || item.missing_certifications || [];
    const extraCertifications = item.certifications_extra || item.extra_certifications || [];
    
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
      certifications: certifications,
      requiredCertifications: requiredCertifications,
      matchedCertifications: matchedCertifications,
      missingCertifications: missingCertifications,
      extraCertifications: extraCertifications,
      educationMatch: item.education_match || "",
      experienceMatch: item.experience_match || "",
      scoreBreakdown: item.score_breakdown || {},
      sentiment: item.sentiment || "neutral",
      profileLabel: item.profile_label || "Needs Improvement",
      feedback,
      status: item.status || inferStatus(numericScore),
      formatCheck: item.format_check || {},
      formatScore: Number(item.format_score || 0),
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

  const getFormatBadge = (score) => {
    if (score >= 80) return <span style={{ color: "#22c55e", fontWeight: "bold" }}>✅ ATS Friendly</span>;
    if (score >= 50) return <span style={{ color: "#f59e0b", fontWeight: "bold" }}>⚠️ Needs Improvement</span>;
    return <span style={{ color: "#ef4444", fontWeight: "bold" }}>❌ Poor Formatting</span>;
  };

  const summaryStats = useMemo(() => {
    const total = filteredRows.length;
    const shortlisted = filteredRows.filter(r => r.status === "selected").length;
    const rejected = filteredRows.filter(r => r.status === "rejected").length;
    const pending = filteredRows.filter(r => r.status === "pending").length;
    const avgScore = total > 0 ? (filteredRows.reduce((acc, r) => acc + r.scoreValue, 0) / total).toFixed(1) : 0;
    
    return { total, shortlisted, rejected, pending, avgScore };
  }, [filteredRows]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.4,
        ease: "easeOut",
      },
    }),
  };

  return (
    <div className="dashboard-content">
      <section className="dashboard-header-row" style={{ marginBottom: "20px" }}>
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants} className="card stat-card glass-card" style={{ flex: 1, textAlign: "center", padding: "20px" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Total Uploaded</h4>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#38bdf8", margin: 0 }}>{summaryStats.total}</p>
        </motion.div>
        
        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} className="card stat-card glass-card" style={{ flex: 1, textAlign: "center", padding: "20px" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Shortlisted</h4>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#22c55e", margin: 0 }}>{summaryStats.shortlisted}</p>
        </motion.div>
        
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} className="card stat-card glass-card" style={{ flex: 1, textAlign: "center", padding: "20px" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Pending</h4>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#f59e0b", margin: 0 }}>{summaryStats.pending}</p>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants} className="card stat-card glass-card" style={{ flex: 1, textAlign: "center", padding: "20px" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Rejected</h4>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#ef4444", margin: 0 }}>{summaryStats.rejected}</p>
        </motion.div>

        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants} className="card stat-card glass-card" style={{ flex: 1, textAlign: "center", padding: "20px" }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>Avg Score</h4>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "#8b5cf6", margin: 0 }}>{summaryStats.avgScore}%</p>
        </motion.div>
      </section>

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
              <th>Format Status</th>
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
                  <td title={candidate.formatCheck?.feedback || "No feedback"}>
                    {getFormatBadge(candidate.formatScore)} ({candidate.formatScore}%)
                  </td>
                  <td>{getBadge(index + 1)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">{t("dashboard.emptyTopCandidates")}</td>
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

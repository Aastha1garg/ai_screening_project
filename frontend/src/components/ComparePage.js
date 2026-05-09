import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";
import { apiClient } from "./api";
import { formatErrorForDisplay } from "../utils/errorHandler";

// Custom tooltip with dark background and white text
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #4f46e5",
          borderRadius: "8px",
          padding: "10px 12px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
        }}
      >
        <p style={{ color: "#ffffff", margin: "0 0 4px 0", fontWeight: "600", fontSize: "13px" }}>
          {label || data.name || ""}
        </p>
        <p style={{ color: "#e2e8f0", margin: 0, fontSize: "12px" }}>
          {`${data.name}: ${data.value}${data.name.includes("experience") ? " years" : ""}`}
        </p>
      </div>
    );
  }
  return null;
};

// Custom tooltip for stacked bars
const CustomStackedTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #4f46e5",
          borderRadius: "8px",
          padding: "10px 12px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
        }}
      >
        <p style={{ color: "#ffffff", margin: "0 0 6px 0", fontWeight: "600", fontSize: "13px" }}>
          {label}
        </p>
        {payload.map((item, index) => (
          <p key={index} style={{ color: item.color, margin: "2px 0", fontSize: "12px" }}>
            {`${item.name}: ${item.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CircularProgress = ({ value, label, color }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="circular-progress-container">
      <svg width="80" height="80" className="circular-progress">
        <circle cx="40" cy="40" r={radius} stroke="#1e293b" strokeWidth="6" fill="none" />
        <circle cx="40" cy="40" r={radius} stroke={color} strokeWidth="6" fill="none" 
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} 
          style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
          transform="rotate(-90 40 40)" />
      </svg>
      <div className="progress-value" style={{position: 'absolute'}}>
        <span className="val" style={{color: color}}>{value}%</span>
        <span className="lbl">{label}</span>
      </div>
    </div>
  );
};

const CandidateCard = ({ candidate, isBest }) => {
  return (
    <div className={`compare-candidate-card ${isBest ? 'recommended-card' : ''}`}>
      {isBest && <div className="recommendation-badge">🏆 Top Recommendation</div>}
      <div className="cc-header">
        <div className="cc-avatar">{candidate.name.substring(0, 2).toUpperCase()}</div>
        <div className="cc-title">
          <h3>{candidate.name}</h3>
          <span className="cc-exp">{typeof candidate.experience === "object" ? `${candidate.experience.total_years ?? candidate.experience.relevant_years ?? 0}` : candidate.experience} Years Exp • {candidate.status}</span>
        </div>
      </div>

      <div className="cc-metrics">
        <CircularProgress value={candidate.score} label="ATS" color={candidate.score >= 75 ? "#22c55e" : "#f59e0b"} />
        <CircularProgress value={candidate.skill_score} label="Skills" color="#00b4ff" />
        <CircularProgress value={candidate.format_score} label="Format" color="#6d4dff" />
      </div>

      <div className="cc-skills">
        <h4>Matched Skills</h4>
        <div className="skill-badges matched">
          {(candidate.matched_skills || []).slice(0, 8).map(s => <span key={s}>{s}</span>)}
          {(candidate.matched_skills || []).length > 8 && <span>+{(candidate.matched_skills.length - 8)} more</span>}
        </div>
      </div>

      <div className="cc-skills">
        <h4>Missing Skills</h4>
        <div className="skill-badges missing">
          {(candidate.missing_skills || []).slice(0, 8).map(s => <span key={s}>{s}</span>)}
        </div>
      </div>
    </div>
  );
};

function ComparePage({ history = [], token }) {
  const [selectedResumes, setSelectedResumes] = useState([]);
  const [selectedJD, setSelectedJD] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resumeOptions = useMemo(() => {
    const byName = new Map();
    history.forEach((row) => {
      const existing = byName.get(row.resume_name);
      // Keep record with higher score, or if equal, keep the more recent (higher ID)
      if (!existing || row.final_score > existing.final_score || (row.final_score === existing.final_score && row.id > existing.id)) {
        byName.set(row.resume_name, row);
      }
    });
    return Array.from(byName.values());
  }, [history]);

  const jdOptions = useMemo(() => {
    const unique = new Map();
    history.forEach((row) => {
      if (!unique.has(row.jd_name)) {
        unique.set(row.jd_name, row.id);
      }
    });
    return Array.from(unique.entries()).map(([name, id]) => ({ id, name }));
  }, [history]);

  const bestCandidateId = useMemo(() => {
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => b.score - a.score)[0].id;
  }, [candidates]);

  const toggleResume = (id) => {
    setSelectedResumes((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const compareNow = async () => {
    if (!selectedResumes.length) {
      setError("Select at least one resume to compare.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await apiClient.post(
        "/compare",
        {
          resume_ids: selectedResumes,
          jd_id: selectedJD ? Number(selectedJD) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCandidates(res.data?.candidates || []);
    } catch (err) {
      setError(formatErrorForDisplay(err?.response?.data?.detail, "Comparison failed."));
    } finally {
      setLoading(false);
    }
  };

  const getExperienceYears = (experience) => {
    if (typeof experience === "object" && experience !== null) {
      return Number(experience.total_years ?? experience.relevant_years ?? experience.required_years ?? 0);
    }
    return Number(experience || 0);
  };

  const candidatesWithExperience = useMemo(
    () =>
      candidates.map((c) => ({
        ...c,
        experienceYears: getExperienceYears(c.experience),
      })),
    [candidates]
  );

  const skillChartData = useMemo(
    () =>
      candidatesWithExperience.map((c) => ({
        name: c.name,
        matched: (c.matched_skills || []).length,
        missing: (c.missing_skills || []).length,
      })),
    [candidatesWithExperience]
  );

  const experienceChartData = useMemo(
    () =>
      candidatesWithExperience.map((c) => ({
        name: c.name,
        experience: c.experienceYears,
      })),
    [candidatesWithExperience]
  );

  return (
    <div className="dashboard-content">
      <section className="card">
        <h3>Compare Resumes</h3>
        <p className="muted">Select resumes, optionally choose a JD, and compare candidate quality.</p>
        <div className="compare-grid">
          <div>
            <h4>Resume Selection</h4>
            <div className="compare-list">
              {resumeOptions.map((row) => (
                <label key={row.id} className="compare-item">
                  <input
                    type="checkbox"
                    checked={selectedResumes.includes(row.id)}
                    onChange={() => toggleResume(row.id)}
                  />
                  <span>{row.resume_name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4>JD Selection (optional)</h4>
            <select value={selectedJD} onChange={(e) => setSelectedJD(e.target.value)}>
              <option value="">Use original JD mapping</option>
              {jdOptions.map((jd) => (
                <option key={jd.id} value={jd.id}>
                  {jd.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={compareNow} disabled={loading}>
              {loading ? "Comparing..." : "Compare Now"}
            </button>
          </div>
        </div>
        {error && <p className="error">{formatErrorForDisplay(error)}</p>}
      </section>

      {!!candidates.length && (
        <>
          <section className="card modern-comparison-dashboard">
            <div className="recommendation-banner">
              <h2>Comparison Results</h2>
              <p className="muted">AI-driven side-by-side analysis of your selected candidates.</p>
            </div>
            
            <div className="candidate-cards-container">
              {candidatesWithExperience.map(c => (
                <CandidateCard key={c.id} candidate={c} isBest={c.id === bestCandidateId} />
              ))}
            </div>
          </section>

          <section className="card charts-section">
            <h3>Deep Analysis</h3>
            <div className="charts-grid">
              <div className="chart-wrapper">
                <h4>Skill Gap Analysis</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={skillChartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                    <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                    <Tooltip content={<CustomStackedTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
                    <Legend wrapperStyle={{ paddingTop: "16px" }} />
                    <Bar dataKey="matched" name="Matched Skills" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={true} />
                    <Bar dataKey="missing" name="Missing Skills" fill="#ef4444" radius={[8, 8, 0, 0]} isAnimationActive={true} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-wrapper">
                <h4>Experience Breakdown</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={experienceChartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                    <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
                    <Legend wrapperStyle={{ paddingTop: "16px" }} />
                    <Bar dataKey="experience" name="Experience (years)" fill="#00b4ff" radius={[8, 8, 0, 0]} isAnimationActive={true} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default ComparePage;

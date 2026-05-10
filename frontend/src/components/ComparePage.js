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

const CircularProgress = ({ value, label, colorClass, strokeColor }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center w-[90px] h-[90px] mb-4">
      <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
        <circle cx="45" cy="45" r={radius} stroke="#1e293b" strokeWidth="6" fill="none" />
        <circle cx="45" cy="45" r={radius} stroke={strokeColor} strokeWidth="6" fill="none" 
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} 
          className="transition-all duration-1000 ease-in-out" />
      </svg>
      <div className="z-10 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${colorClass}`}>{value}%</span>
      </div>
      <span className="text-xs text-gray-400 mt-2 uppercase tracking-wider absolute -bottom-6 whitespace-nowrap">{label}</span>
    </div>
  );
};

const CandidateCard = ({ candidate, isBest }) => {
  const expYears = typeof candidate.experience === "object" 
    ? `${candidate.experience.total_years ?? candidate.experience.relevant_years ?? 0}` 
    : candidate.experience;

  return (
    <div className={`relative flex flex-col gap-6 p-6 rounded-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 ${isBest ? 'bg-gradient-to-b from-[#16a34a15] to-[#1b1740] border-2 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]' : 'bg-[#1b1740] border border-indigo-500/30 shadow-xl'}`}>
      {isBest && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-600 to-green-400 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 whitespace-nowrap">
          🏆 Top Recommendation
        </div>
      )}
      
      <div className="flex items-center gap-4 mt-2">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shrink-0">
          {candidate.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-white m-0 truncate">{candidate.name}</h3>
          <p className="text-sm text-gray-400 m-0 mt-1 truncate">{expYears} Years Exp • {candidate.status}</p>
        </div>
      </div>

      <div className="flex justify-around py-6 border-y border-white/10 mt-2 mb-4">
        <CircularProgress value={candidate.score} label="ATS Score" colorClass="text-[#22d3ee]" strokeColor="#22d3ee" />
        <CircularProgress value={candidate.skill_score} label="Skills Match" colorClass="text-[#8b5cf6]" strokeColor="#8b5cf6" />
        <CircularProgress value={candidate.format_score} label="Format" colorClass="text-[#22c55e]" strokeColor="#22c55e" />
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-gray-300 m-0">Matched Skills</h4>
        <div className="flex flex-wrap gap-2">
          {(candidate.matched_skills || []).slice(0, 8).map(s => (
            <span key={s} className="px-3 py-1 bg-green-500/15 text-green-400 border border-green-500/20 rounded-full text-xs font-medium">
              {s}
            </span>
          ))}
          {(candidate.matched_skills || []).length > 8 && (
            <span className="px-3 py-1 bg-gray-500/15 text-gray-400 border border-gray-500/20 rounded-full text-xs font-medium">
              +{(candidate.matched_skills.length - 8)} more
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-gray-300 m-0">Missing Skills</h4>
        <div className="flex flex-wrap gap-2">
          {(candidate.missing_skills || []).slice(0, 8).map(s => (
            <span key={s} className="px-3 py-1 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full text-xs font-medium">
              {s}
            </span>
          ))}
          {(!candidate.missing_skills || candidate.missing_skills.length === 0) && (
            <span className="text-sm text-gray-500 italic">No missing skills!</span>
          )}
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
          <section className="mt-12 w-full max-w-[1400px] mx-auto px-4">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-3">
                Comparison Results
              </h2>
              <p className="text-gray-400 text-lg">AI-driven side-by-side analysis of your selected candidates.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6">
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

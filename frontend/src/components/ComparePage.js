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
} from "recharts";
import { apiClient } from "./api";
import { formatEducationList } from "../formatEducation";
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

function ComparePage({ history = [], token }) {
  const [selectedResumes, setSelectedResumes] = useState([]);
  const [selectedJD, setSelectedJD] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
              {history.map((row) => (
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
          <section className="card">
            <h3>Comparison Table</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Final Score</th>
                  <th>Skill Score</th>
                  <th>Experience</th>
                  <th>Education</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className={candidate.id === bestCandidateId ? "best-candidate-row" : ""}
                  >
                    <td>
                      {candidate.name}{" "}
                      {candidate.id === bestCandidateId && <span className="pill">Best Match</span>}
                    </td>
                    <td>{candidate.score}</td>
                    <td>{candidate.skill_score}</td>
                    <td>{typeof candidate.experience === "object" ? `${candidate.experience.total_years ?? candidate.experience.relevant_years ?? 0}y` : candidate.experience}</td>
                    <td>{formatEducationList(candidate.education)}</td>
                    <td>
                      <span className={`status-pill ${candidate.status}`}>{candidate.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card">
            <h3>Score Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={candidates} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <Bar dataKey="score" name="Score" fill="#6d4dff" radius={[8, 8, 0, 0]} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <section className="card">
            <h3>Skills Matched vs Missing</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillChartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
                <Tooltip content={<CustomStackedTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <Bar dataKey="matched" name="Matched" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={true} />
                <Bar dataKey="missing" name="Missing" fill="#ef4444" isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <section className="card">
            <h3>Experience Comparison</h3>
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
          </section>
        </>
      )}
    </div>
  );
}

export default ComparePage;

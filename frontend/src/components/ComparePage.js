import React, { useEffect, useMemo, useState } from "react";
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

function ComparePage({ token }) {
  const [history, setHistory] = useState([]);
  const [selectedResumes, setSelectedResumes] = useState([]);
  const [selectedJD, setSelectedJD] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await apiClient.get("/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistory(res.data || []);
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load history");
      }
    };
    loadHistory();
  }, [token]);

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
      setError(err?.response?.data?.detail || "Comparison failed.");
    } finally {
      setLoading(false);
    }
  };

  const skillChartData = useMemo(
    () =>
      candidates.map((c) => ({
        name: c.name,
        matched: (c.matched_skills || []).length,
        missing: (c.missing_skills || []).length,
      })),
    [candidates]
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
        {error && <p className="error">{error}</p>}
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
                    <td>{candidate.experience}</td>
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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={candidates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="#6d4dff" />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <section className="card">
            <h3>Skills Matched vs Missing</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={skillChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="matched" fill="#22c55e" />
                <Bar dataKey="missing" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </section>
          <section className="card">
            <h3>Experience Comparison</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={candidates}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="experience" fill="#00b4ff" />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  );
}

export default ComparePage;

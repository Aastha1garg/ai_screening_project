import React, { useMemo } from "react";
import { formatEducationList } from "../formatEducation";
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

// Custom tooltip with dark background and white text
const CustomTooltip = ({ active, payload, label }) => {
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
            {`${item.name}: ${item.value}${item.name.includes("Experience") ? " years" : ""}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function AnalyticsDashboard({ rows }) {
  const experienceData = useMemo(() => {
    return (rows || []).map((row, index) => {
      const fullName = row.name || `Resume ${index + 1}`;
      return {
        resumeName: fullName,
        shortName: fullName.slice(0, 10) + (fullName.length > 10 ? "..." : ""),
        totalExperience: Number(row.totalExperience || 0),
        relevantExperience: Number(row.relevantExperience || 0),
      };
    });
  }, [rows]);

  const certificationData = useMemo(() => {
    return (rows || []).map((row, index) => {
      const fullName = row.name || `Resume ${index + 1}`;
      const matchedCerts = (row.matchedCertifications || []).length;
      const missingCerts = (row.missingCertifications || []).length;
      const extraCerts = (row.extraCertifications || []).length;
      
      // Debug logging
      console.log(`[AnalyticsDashboard] Cert data for ${fullName}:`, {
        matched: matchedCerts,
        missing: missingCerts,
        extra: extraCerts,
        certifications: row.certifications,
        matchedCertifications: row.matchedCertifications,
        missingCertifications: row.missingCertifications,
        extraCertifications: row.extraCertifications,
      });
      
      return {
        resumeName: fullName,
        shortName: fullName.slice(0, 10) + (fullName.length > 10 ? "..." : ""),
        matched: matchedCerts,
        missing: missingCerts,
        extra: extraCerts,
      };
    });
  }, [rows]);

  const skillData = useMemo(() => {
    return (rows || []).map((row, index) => {
      const fullName = row.name || `Resume ${index + 1}`;
      return {
        resumeName: fullName,
        shortName: fullName.slice(0, 10) + (fullName.length > 10 ? "..." : ""),
        matched: (row.matchedSkills || []).length,
        missing: (row.missingSkills || []).length,
        extra: (row.extraSkills || []).length,
      };
    });
  }, [rows]);

  return (
    <div className="dashboard-content">
      <section className="card chart-card">
        <h3>Experience Section</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={experienceData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
            <XAxis dataKey="shortName" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
            <Legend wrapperStyle={{ paddingTop: "16px" }} />
            <Bar dataKey="totalExperience" name="Total Experience" fill="#00b4ff" radius={[8, 8, 0, 0]} isAnimationActive={true} />
            <Bar dataKey="relevantExperience" name="Relevant Experience" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={true} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h3>Certification Section</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={certificationData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
            <XAxis dataKey="shortName" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
            <Legend wrapperStyle={{ paddingTop: "16px" }} />
            <Bar dataKey="matched" stackId="certs" name="Matched" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={true} />
            <Bar dataKey="missing" stackId="certs" name="Missing" fill="#ef4444" isAnimationActive={true} />
            <Bar dataKey="extra" stackId="certs" name="Extra" fill="#f59e0b" isAnimationActive={true} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h3>Skill Section</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={skillData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
            <XAxis dataKey="shortName" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
            <Legend wrapperStyle={{ paddingTop: "16px" }} />
            <Bar dataKey="matched" stackId="skills" name="Matched" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={true} />
            <Bar dataKey="missing" stackId="skills" name="Missing" fill="#ef4444" isAnimationActive={true} />
            <Bar dataKey="extra" stackId="skills" name="Extra" fill="#f59e0b" isAnimationActive={true} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h3>Per Resume Insights</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Resume</th>
              <th>Matched Skills</th>
              <th>Missing Skills</th>
              <th>Experience</th>
              <th>Education</th>
              <th>Certifications</th>
              <th>Final Score</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).length ? (
              (rows || []).map((row, index) => (
                <tr key={`${row.name}-${index}`}>
                  <td>{row.name}</td>
                  <td>{(row.matchedSkills || []).join(", ") || "N/A"}</td>
                  <td>{(row.missingSkills || []).join(", ") || "N/A"}</td>
                  <td>{`${row.totalExperience || 0}y (relevant ${row.relevantExperience || 0}y)`}</td>
                  <td>{formatEducationList(row.education)}</td>
                  <td>{(row.certifications || []).join(", ") || "N/A"}</td>
                  <td>{row.score}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">Upload and score resumes to view analytics.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default AnalyticsDashboard;

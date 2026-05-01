import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function AnalyticsDashboard({ rows }) {
  const experienceData = useMemo(() => {
    return (rows || []).map((row, index) => ({
      resumeName: row.name || `Resume ${index + 1}`,
      shortName: `R${index + 1}`,
      totalExperience: Number(row.totalExperience || 0),
      relevantExperience: Number(row.relevantExperience || 0),
    }));
  }, [rows]);

  const certificationData = useMemo(() => {
    return (rows || []).map((row, index) => ({
      resumeName: row.name || `Resume ${index + 1}`,
      shortName: `R${index + 1}`,
      matched: (row.matchedCertifications || []).length,
      missing: (row.missingCertifications || []).length,
      extra: (row.extraCertifications || []).length,
    }));
  }, [rows]);

  const skillData = useMemo(() => {
    return (rows || []).map((row, index) => ({
      resumeName: row.name || `Resume ${index + 1}`,
      shortName: `R${index + 1}`,
      matched: (row.matchedSkills || []).length,
      missing: (row.missingSkills || []).length,
      extra: (row.extraSkills || []).length,
    }));
  }, [rows]);

  return (
    <div className="dashboard-content">
      <section className="card chart-card">
        <h3>Experience Section</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={experienceData}>
            <XAxis dataKey="shortName" stroke="#c7d2fe" />
            <YAxis stroke="#c7d2fe" />
            <Tooltip
              formatter={(value, key) => [`${value} years`, key]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.resumeName || ""}
            />
            <Bar dataKey="totalExperience" fill="#00b4ff" radius={[8, 8, 0, 0]} />
            <Bar dataKey="relevantExperience" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h3>Certification Section</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={certificationData}>
            <XAxis dataKey="shortName" stroke="#c7d2fe" />
            <YAxis allowDecimals={false} stroke="#c7d2fe" />
            <Tooltip
              formatter={(value, key) => [value, key]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.resumeName || ""}
            />
            <Bar dataKey="matched" stackId="certs" fill="#22c55e" radius={[8, 8, 0, 0]} />
            <Bar dataKey="missing" stackId="certs" fill="#f43f5e" />
            <Bar dataKey="extra" stackId="certs" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h3>Skill Section</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={skillData}>
            <XAxis dataKey="shortName" stroke="#c7d2fe" />
            <YAxis allowDecimals={false} stroke="#c7d2fe" />
            <Tooltip
              formatter={(value, key) => [value, key]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.resumeName || ""}
            />
            <Bar dataKey="matched" stackId="skills" fill="#22c55e" radius={[8, 8, 0, 0]} />
            <Bar dataKey="missing" stackId="skills" fill="#f43f5e" />
            <Bar dataKey="extra" stackId="skills" fill="#f59e0b" />
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
                  <td>{(row.education || []).join(", ") || "N/A"}</td>
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

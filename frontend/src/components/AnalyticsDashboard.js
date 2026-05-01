import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const EDUCATION_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function hasAnyKeyword(values, keywords) {
  return values.some((value) => keywords.some((kw) => value.includes(kw)));
}

function AnalyticsDashboard({ rows }) {
  const experienceData = useMemo(() => {
    const buckets = { "0-1 years": 0, "2-4 years": 0, "5+ years": 0 };
    (rows || []).forEach((row) => {
      const years = Number(row.totalExperience || 0);
      if (years <= 1) {
        buckets["0-1 years"] += 1;
      } else if (years <= 4) {
        buckets["2-4 years"] += 1;
      } else {
        buckets["5+ years"] += 1;
      }
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const educationData = useMemo(() => {
    const counts = { "B.Tech": 0, "M.Tech": 0, MBA: 0, Others: 0 };
    (rows || []).forEach((row) => {
      const educationValues = (row.education || []).map((item) => normalizeText(item));
      if (educationValues.length === 0) {
        counts.Others += 1;
        return;
      }
      if (hasAnyKeyword(educationValues, ["b.tech", "btech", "bachelor of technology"])) {
        counts["B.Tech"] += 1;
        return;
      }
      if (hasAnyKeyword(educationValues, ["m.tech", "mtech", "master of technology"])) {
        counts["M.Tech"] += 1;
        return;
      }
      if (hasAnyKeyword(educationValues, ["mba", "master of business administration"])) {
        counts.MBA += 1;
        return;
      }
      counts.Others += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const certificationData = useMemo(() => {
    const counts = { AWS: 0, GCP: 0, Azure: 0, None: 0 };
    (rows || []).forEach((row) => {
      const certValues = (row.certifications || []).map((item) => normalizeText(item));
      if (certValues.length === 0) {
        counts.None += 1;
        return;
      }
      const hasAWS = hasAnyKeyword(certValues, ["aws", "amazon web services"]);
      const hasGCP = hasAnyKeyword(certValues, ["gcp", "google cloud"]);
      const hasAzure = hasAnyKeyword(certValues, ["azure", "microsoft azure"]);
      if (hasAWS) counts.AWS += 1;
      if (hasGCP) counts.GCP += 1;
      if (hasAzure) counts.Azure += 1;
      if (!hasAWS && !hasGCP && !hasAzure) counts.None += 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rows]);

  return (
    <div className="dashboard-content">
      <section className="card chart-card">
        <h3>Experience Section</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={experienceData}>
            <XAxis dataKey="name" stroke="#c7d2fe" />
            <YAxis allowDecimals={false} stroke="#c7d2fe" />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#00b4ff" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h3>Education Section</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={educationData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={90}
              paddingAngle={4}
            >
              {educationData.map((entry, index) => (
                <Cell key={`${entry.name}-${entry.value}`} fill={EDUCATION_COLORS[index % EDUCATION_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h3>Certification Section</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={certificationData}>
            <XAxis dataKey="name" stroke="#c7d2fe" />
            <YAxis allowDecimals={false} stroke="#c7d2fe" />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#14b8a6" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

export default AnalyticsDashboard;

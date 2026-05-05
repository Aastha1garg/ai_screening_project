import React, { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PIE_COLORS = ["#4f46e5", "#f43f5e", "#14b8a6"];

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
          {`${data.name}: ${data.value}`}
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

function Charts({ rows }) {
  const [hoveredStatIndex, setHoveredStatIndex] = useState(null);
  const [hoveredSkillIndex, setHoveredSkillIndex] = useState(null);

  const statsData = useMemo(() => {
    const total = rows.length;
    const matched = rows.filter((row) => row.status === "selected").length;
    const rejected = rows.filter((row) => row.status === "rejected").length;
    return [
      { name: "Total", value: total },
      { name: "Matched", value: matched },
      { name: "Rejected", value: rejected },
    ];
  }, [rows]);

  const statusData = useMemo(() => {
    const selected = rows.filter((row) => row.status === "selected").length;
    const rejected = rows.filter((row) => row.status === "rejected").length;
    const pending = rows.filter((row) => row.status === "pending").length;
    return [
      { name: "Selected", value: selected },
      { name: "Rejected", value: rejected },
      { name: "Pending", value: pending },
    ];
  }, [rows]);

  const skillDistribution = useMemo(() => {
    return (rows || []).slice(0, 12).map((row, index) => {
      const fullName = row.name || `Resume ${index + 1}`;
      return {
        name: fullName,
        shortName: fullName.slice(0, 10) + (fullName.length > 10 ? "..." : ""),
        matched: (row.matchedSkills || []).length,
        missing: (row.missingSkills || []).length,
        extra: (row.extraSkills || []).length,
      };
    });
  }, [rows]);

  return (
    <section className="charts-wrapper charts-wrapper-3">
      <article className="card chart-card">
        <h3>Resume Stats</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={statsData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
            <Legend wrapperStyle={{ paddingTop: "16px" }} />
            <Bar dataKey="value" name="Count" radius={[8, 8, 0, 0]} isAnimationActive={true}>
              {statsData.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${entry.value}`}
                  fill={hoveredStatIndex === index ? "#7c3aed" : "#4f46e5"}
                  onMouseEnter={() => setHoveredStatIndex(index)}
                  onMouseLeave={() => setHoveredStatIndex(null)}
                  style={{ transition: "fill 0.3s ease" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </article>
      <article className="card chart-card">
        <h3>Status Distribution</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={90}
              paddingAngle={4}
              isAnimationActive={true}
            >
              {statusData.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${entry.value}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "16px" }} />
          </PieChart>
        </ResponsiveContainer>
      </article>
      <article className="card chart-card">
        <h3>Skill Distribution</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={skillDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
            <XAxis dataKey="shortName" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <Tooltip content={<CustomStackedTooltip />} cursor={{ fill: "rgba(79, 70, 229, 0.1)" }} />
            <Legend wrapperStyle={{ paddingTop: "16px" }} />
            <Bar dataKey="matched" stackId="skills" name="Matched" radius={[8, 8, 0, 0]} isAnimationActive={true}>
              {skillDistribution.map((entry, index) => (
                <Cell
                  key={`matched-${index}`}
                  fill={hoveredSkillIndex === index ? "#16a34a" : "#22c55e"}
                  onMouseEnter={() => setHoveredSkillIndex(index)}
                  onMouseLeave={() => setHoveredSkillIndex(null)}
                  style={{ transition: "fill 0.3s ease" }}
                />
              ))}
            </Bar>
            <Bar dataKey="missing" stackId="skills" name="Missing" isAnimationActive={true}>
              {skillDistribution.map((entry, index) => (
                <Cell
                  key={`missing-${index}`}
                  fill={hoveredSkillIndex === index ? "#b91c1c" : "#ef4444"}
                  onMouseEnter={() => setHoveredSkillIndex(index)}
                  onMouseLeave={() => setHoveredSkillIndex(null)}
                  style={{ transition: "fill 0.3s ease" }}
                />
              ))}
            </Bar>
            <Bar dataKey="extra" stackId="skills" name="Extra" isAnimationActive={true}>
              {skillDistribution.map((entry, index) => (
                <Cell
                  key={`extra-${index}`}
                  fill={hoveredSkillIndex === index ? "#d97706" : "#f59e0b"}
                  onMouseEnter={() => setHoveredSkillIndex(index)}
                  onMouseLeave={() => setHoveredSkillIndex(null)}
                  style={{ transition: "fill 0.3s ease" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}

export default Charts;

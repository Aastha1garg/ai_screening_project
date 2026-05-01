import React, { useMemo } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PIE_COLORS = ["#4f46e5", "#f43f5e", "#14b8a6"];

function Charts({ rows }) {
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
    return (rows || []).slice(0, 12).map((row, index) => ({
      name: row.name || `Resume ${index + 1}`,
      shortName: `R${index + 1}`,
      matched: (row.matchedSkills || []).length,
      missing: (row.missingSkills || []).length,
      extra: (row.extraSkills || []).length,
    }));
  }, [rows]);

  return (
    <section className="charts-wrapper charts-wrapper-3">
      <article className="card chart-card">
        <h3>Resume Stats</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={statsData}>
            <XAxis dataKey="name" stroke="#c7d2fe" />
            <YAxis stroke="#c7d2fe" />
            <Tooltip />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      </article>
      <article className="card chart-card">
        <h3>Status Distribution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={90}
              paddingAngle={4}
            >
              {statusData.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${entry.value}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </article>
      <article className="card chart-card">
        <h3>Skill Distribution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={skillDistribution}>
            <XAxis dataKey="shortName" stroke="#c7d2fe" />
            <YAxis stroke="#c7d2fe" />
            <Tooltip
              formatter={(value, key) => [value, key]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
            />
            <Bar dataKey="matched" stackId="skills" radius={[8, 8, 0, 0]} fill="#22c55e" />
            <Bar dataKey="missing" stackId="skills" fill="#f43f5e" />
            <Bar dataKey="extra" stackId="skills" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}

export default Charts;

import React, { useEffect, useState } from "react";
import { apiClient } from "./api";

function HistoryPage({ token }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get("/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistory(res.data);
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load history");
      }
    };
    load();
  }, [token]);

  return (
    <section className="card">
      <h3>History</h3>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Resume Name</th>
            <th>Score</th>
            <th>Date</th>
            <th>Status</th>
            <th>Format Score</th>
          </tr>
        </thead>
        <tbody>
          {history.length ? (
            history.map((row) => (
              <tr key={row.id}>
                <td>{row.resume_name}</td>
                <td>{row.score}</td>
                <td>{new Date(row.date).toLocaleString()}</td>
                <td>
                  <span className={`status-pill ${row.status}`}>{row.status}</span>
                </td>
                <td>{row.format_score ?? 0}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5">No history yet for your account.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default HistoryPage;

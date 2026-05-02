import React from "react";

function HistoryPage({ history = [], shortlistedIds, onToggleShortlist }) {
  return (
    <section className="card">
      <h3>History</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Resume Name</th>
            <th>Score</th>
            <th>Date</th>
            <th>Status</th>
            <th>Format Score</th>
            <th>Shortlist</th>
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
                  {(shortlistedIds || []).includes(Number(row.id)) && (
                    <span className="shortlisted-badge">Shortlisted</span>
                  )}
                </td>
                <td>{row.format_score ?? 0}</td>
                <td>
                  <button
                    type="button"
                    className={(shortlistedIds || []).includes(Number(row.id)) ? "secondary-btn" : ""}
                    onClick={() =>
                      onToggleShortlist(
                        Number(row.id),
                        !(shortlistedIds || []).includes(Number(row.id))
                      )
                    }
                  >
                    {(shortlistedIds || []).includes(Number(row.id))
                      ? "Remove"
                      : "Shortlist"}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6">No history yet for your account.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default HistoryPage;

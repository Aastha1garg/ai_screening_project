import React from "react";

function ActionPanel({ rows, onRetry, retryDisabled }) {
  const lowScoringCandidates = rows.filter((row) => row.scoreValue < 60);
  const failedParsing = rows.filter((row) => row.status === "failed");

  return (
    <section className="card action-panel">
      <h3>Action Panel</h3>
      <div className="action-block">
        <h4>Low Scoring Candidates</h4>
        {lowScoringCandidates.length ? (
          lowScoringCandidates.map((row) => (
            <p key={`${row.name}-${row.score}`}>{`${row.name} - ${row.score}`}</p>
          ))
        ) : (
          <p className="muted">No low-scoring candidates right now.</p>
        )}
      </div>
      <div className="action-block">
        <h4>Failed Parsing</h4>
        {failedParsing.length ? (
          failedParsing.map((row) => <p key={`${row.name}-failed`}>{row.name}</p>)
        ) : (
          <p className="muted">No parsing failures detected.</p>
        )}
      </div>
      <button type="button" onClick={onRetry} disabled={retryDisabled}>
        Retry
      </button>
    </section>
  );
}

export default ActionPanel;

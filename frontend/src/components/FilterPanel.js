import React from "react";

function FilterPanel({ filters, setFilters, onApply, onClear, activeFilters, resultCount }) {
  const update = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="card">
      <h3>Advanced Filters</h3>
      <p className="muted">{resultCount} candidates found</p>
      <div className="filter-grid">
        <input
          type="number"
          min="0"
          placeholder="Score threshold (e.g. 50+)"
          value={filters.score}
          onChange={(e) => update("score", e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder="Experience (min years)"
          value={filters.experience}
          onChange={(e) => update("experience", e.target.value)}
        />
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Skill Match %"
          value={filters.skillMatch}
          onChange={(e) => update("skillMatch", e.target.value)}
        />
        <select value={filters.status} onChange={(e) => update("status", e.target.value)}>
          <option value="">Status (all)</option>
          <option value="selected">selected</option>
          <option value="pending">pending</option>
          <option value="rejected">rejected</option>
        </select>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="Format score (min)"
          value={filters.formatScore}
          onChange={(e) => update("formatScore", e.target.value)}
        />
      </div>
      <div className="inline-controls">
        <button type="button" onClick={onApply}>
          Apply Filters
        </button>
        <button type="button" className="secondary-btn" onClick={onClear}>
          Clear Filters
        </button>
      </div>
      {!!activeFilters.length && (
        <div className="active-filters">
          {activeFilters.map((item) => (
            <span key={`${item.key}-${item.value}`} className="pill">
              {item.key}: {item.value}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export default FilterPanel;

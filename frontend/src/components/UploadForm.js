import React from "react";

function UploadForm({
  resumes,
  jds,
  template,
  loading,
  error,
  restoreHint,
  realtimeMode = true,
  onToggleRealtimeMode,
  onAddResumes,
  onAddJds,
  onSetTemplate,
  onRemoveResume,
  onRemoveJD,
  onSubmit,
}) {
  const handleResumeUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    onAddResumes(selected);
    e.target.value = "";
  };

  const handleJDUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    onAddJds(selected);
    e.target.value = "";
  };

  const handleTemplateUpload = (e) => {
    onSetTemplate(e.target.files[0] || null);
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <section className="card">
      <h3>Candidate Input</h3>
      <p className="muted">Upload files to run AI scoring and fit analysis.</p>
      {restoreHint ? <p className="muted">{restoreHint}</p> : null}
      
      {/* Real-time mode toggle */}
      <div className="realtime-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={realtimeMode}
            onChange={(e) => onToggleRealtimeMode?.(e.target.checked)}
            disabled={loading}
          />
          <span className="toggle-text">
            {realtimeMode ? " Real-time Scoring" : " Traditional Upload"}
          </span>
        </label>
        <p className="toggle-hint">
          {realtimeMode
            ? "See scores update live as processing happens"
            : "Upload all at once and get results when complete"}
        </p>
      </div>

      <form onSubmit={submit} className="stack">
        <label>
          Upload Resume(s)
          <input
            type="file"
            onChange={handleResumeUpload}
            accept=".pdf,.docx,.txt"
            multiple
          />
        </label>
        {!!resumes.length && (
          <div className="uploaded-files">
            {resumes.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="inline-controls">
                <span className="muted">{file.name}</span>
                <button type="button" className="secondary-btn" onClick={() => onRemoveResume(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <label>
          Upload Job Description(s)
          <input
            type="file"
            onChange={handleJDUpload}
            accept=".pdf,.docx,.txt"
            multiple
          />
        </label>
        {!!jds.length && (
          <div className="uploaded-files">
            {jds.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="inline-controls">
                <span className="muted">{file.name}</span>
                <button type="button" className="secondary-btn" onClick={() => onRemoveJD(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <label>
          Optional Template Resume
          <input
            type="file"
            onChange={handleTemplateUpload}
            accept=".pdf,.docx,.txt"
          />
        </label>
        {template && <p className="muted uploaded-files">{template.name}</p>}

        <button disabled={loading} type="submit">
          {loading ? (
            <span className="button-loading">
              <span className="spinner" />
              Uploading...
            </span>
          ) : (
            "Upload & Analyze"
          )}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default UploadForm;

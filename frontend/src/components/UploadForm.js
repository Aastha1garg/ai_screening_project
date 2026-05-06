import React from "react";
import { useTranslation } from "react-i18next";
import { formatErrorForDisplay } from "../utils/errorHandler";

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
  const { t } = useTranslation();
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
      <h3>{t("upload.title")}</h3>
      <p className="muted">{t("upload.description")}</p>
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
            {realtimeMode ? ` ${t("upload.realTimeScoring")}` : ` ${t("upload.traditionalUpload")}`}
          </span>
        </label>
        <p className="toggle-hint">
          {realtimeMode
            ? t("upload.realTimeHint")
            : t("upload.traditionalHint")}
        </p>
      </div>

      <form onSubmit={submit} className="stack">
        <label>
          {t("upload.uploadResumes")}
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
                  {t("buttons.delete")}
                </button>
              </div>
            ))}
          </div>
        )}

        <label>
          {t("upload.uploadJDs")}
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
                  {t("buttons.delete")}
                </button>
              </div>
            ))}
          </div>
        )}

        <label>
          {t("upload.templateResume")}
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
              {t("upload.uploading")}
            </span>
          ) : (
            t("upload.uploadAnalyze")
          )}
        </button>
      </form>
      {error && <p className="error">{formatErrorForDisplay(error)}</p>}
    </section>
  );
}

export default UploadForm;

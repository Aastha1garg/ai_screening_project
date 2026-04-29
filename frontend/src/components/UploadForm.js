import React, { useState } from "react";

function UploadForm({ onSubmit, onPayloadCapture }) {
  const [resumes, setResumes] = useState([]);
  const [jds, setJds] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleResumeUpload = (e) => setResumes(e.target.files);
  const handleJDUpload = (e) => setJds(e.target.files);
  const handleTemplateUpload = (e) => setTemplate(e.target.files[0] || null);

  const submit = async (e) => {
    e.preventDefault();
    if (!resumes.length || !jds.length) {
      setError("Please upload at least one resume and one job description.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();

      for (let i = 0; i < resumes.length; i += 1) {
        formData.append("resumes", resumes[i]);
      }

      for (let i = 0; i < jds.length; i += 1) {
        formData.append("jds", jds[i]);
      }

      if (template) {
        formData.append("template_resume", template);
      }

      if (onPayloadCapture) {
        onPayloadCapture({
          resumes: Array.from(resumes),
          jds: Array.from(jds),
          template,
        });
      }

      await onSubmit(formData);
    } catch (err) {
      setError(err?.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h3>Candidate Input</h3>
      <p className="muted">Upload files to run AI scoring and fit analysis.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Upload Resume(s)
          <input
            type="file"
            onChange={handleResumeUpload}
            accept=".pdf,.docx,.txt"
            multiple
            required
          />
        </label>
        {!!resumes.length && (
          <p className="muted uploaded-files">
            {Array.from(resumes)
              .map((file) => file.name)
              .join(", ")}
          </p>
        )}

        <label>
          Upload Job Description(s)
          <input
            type="file"
            onChange={handleJDUpload}
            accept=".pdf,.docx,.txt"
            multiple
            required
          />
        </label>
        {!!jds.length && (
          <p className="muted uploaded-files">
            {Array.from(jds)
              .map((file) => file.name)
              .join(", ")}
          </p>
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

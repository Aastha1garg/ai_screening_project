import React, { useState } from "react";

function UploadForm({ onSubmit, onPayloadCapture }) {
  const [resumes, setResumes] = useState([]);
  const [jds, setJds] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dedupeFiles = (existingFiles, nextFiles) => {
    const seen = new Set(existingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
    const merged = [...existingFiles];
    nextFiles.forEach((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(file);
      }
    });
    return merged;
  };

  const handleResumeUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    setResumes((prev) => dedupeFiles(prev, selected));
    e.target.value = "";
  };

  const handleJDUpload = (e) => {
    const selected = Array.from(e.target.files || []);
    setJds((prev) => dedupeFiles(prev, selected));
    e.target.value = "";
  };
  const handleTemplateUpload = (e) => setTemplate(e.target.files[0] || null);

  const removeResume = (indexToRemove) => {
    setResumes((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const removeJD = (indexToRemove) => {
    setJds((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

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

      resumes.forEach((file) => formData.append("resumes", file));

      jds.forEach((file) => formData.append("jds", file));

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
          />
        </label>
        {!!resumes.length && (
          <div className="uploaded-files">
            {resumes.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`} className="inline-controls">
                <span className="muted">{file.name}</span>
                <button type="button" className="secondary-btn" onClick={() => removeResume(index)}>
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
                <button type="button" className="secondary-btn" onClick={() => removeJD(index)}>
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

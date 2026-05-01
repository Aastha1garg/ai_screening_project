import React, { useEffect, useMemo, useState } from "react";
import AuthForm from "./components/AuthForm";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import ResultsPanel from "./components/ResultsPanel";
import UploadForm from "./components/UploadForm";
import ResumeTable from "./components/ResumeTable";
import HistoryPage from "./components/HistoryPage";
import DownloadPanel from "./components/DownloadPanel";
import ComparePage from "./components/ComparePage";
import ShortlistedCandidatesPage from "./components/ShortlistedCandidatesPage";
import { apiClient } from "./components/api";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("userEmail") || "");
  const [activePage, setActivePage] = useState("dashboard");
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUploadPayload, setLastUploadPayload] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [shortlistedIds, setShortlistedIds] = useState([]);

  const parseJwtEmail = (jwtToken) => {
    try {
      const payloadPart = jwtToken.split(".")[1];
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(window.atob(normalized));
      return decoded?.sub || "";
    } catch (_err) {
      return "";
    }
  };

  const isAuthenticated = useMemo(() => !!token, [token]);

  useEffect(() => {
    if (!token) return;
    refreshShortlisted(token).catch(() => {});
  }, [token]);

  const handleLogin = (newToken) => {
    const email = parseJwtEmail(newToken);
    localStorage.setItem("token", newToken);
    localStorage.setItem("userEmail", email);
    setToken(newToken);
    setUserEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setToken("");
    setUserEmail("");
    setResults([]);
    setActivePage("dashboard");
    setNotifications([]);
    setShortlistedIds([]);
  };

  const fetchShortlistedCandidates = async (authToken) => {
    const res = await apiClient.get("/shortlist", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return res.data?.results || [];
  };

  const refreshShortlisted = async (authToken = token) => {
    if (!authToken) return;
    const candidates = await fetchShortlistedCandidates(authToken);
    setShortlistedIds(candidates.map((item) => Number(item.id)));
  };

  const handleUpload = async (formData) => {
    const response = await apiClient.post("/upload", formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const nextResults = response.data.results || [];
    setResults(nextResults);
    const now = new Date().toISOString();
    const newNotifs = [
      {
        id: `upload-${Date.now()}`,
        message: `Resume upload completed (${nextResults.length} results generated).`,
        timestamp: now,
      },
    ];
    if (nextResults.some((item) => Number(item.score) > 80)) {
      newNotifs.push({
        id: `high-score-${Date.now()}-1`,
        message: "New high-score candidate detected (>80).",
        timestamp: now,
      });
    }
    if (nextResults.some((item) => Number(item.format_score) < 70)) {
      newNotifs.push({
        id: `format-${Date.now()}-2`,
        message: "Format mismatch warning found in one or more resumes.",
        timestamp: now,
      });
    }
    setNotifications((prev) => [...newNotifs, ...prev].slice(0, 20));
    await refreshShortlisted(token);
  };

  const handleRetry = async () => {
    if (!lastUploadPayload) {
      return;
    }
    const formData = new FormData();
    lastUploadPayload.resumes.forEach((file) => formData.append("resumes", file));
    lastUploadPayload.jds.forEach((file) => formData.append("jds", file));
    if (lastUploadPayload.template) {
      formData.append("template_resume", lastUploadPayload.template);
    }
    await handleUpload(formData);
  };

  const parsedRows = useMemo(
    () =>
      (results || []).map((item) => {
        const numericScore = Number(item.score) || 0;
        return {
          historyId: Number(item.id),
          name: item.resume_name || "Unknown Candidate",
          jobRole: item.jd_name || "General Role",
          score: `${numericScore}%`,
          scoreValue: numericScore,
          skillScore: Number(item.skill_score || 0),
          formatScore: Number(item.format_score || 0),
          matchedSkills: item.matched_skills || [],
          missingSkills: item.missing_skills || [],
          partialMatches: item.partial_matches || [],
          totalExperience: Number(item.experience?.total_years || 0),
          relevantExperience: Number(item.experience?.relevant_years || 0),
          education: item.education || [],
          certifications: item.certifications || [],
          sentiment: item.sentiment || "neutral",
          profileLabel: item.profile_label || "Needs Improvement",
          feedback: item.feedback || {},
          status: numericScore >= 75 ? "selected" : numericScore >= 50 ? "pending" : "rejected",
          shortlisted:
            shortlistedIds.includes(Number(item.id)) || Boolean(item.shortlisted),
        };
      }),
    [results, shortlistedIds]
  );

  const handleToggleShortlist = async (historyId, shouldShortlist) => {
    if (!historyId) return;
    if (shouldShortlist) {
      await apiClient.post(`/shortlist/${historyId}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShortlistedIds((prev) => (prev.includes(historyId) ? prev : [...prev, historyId]));
      return;
    }
    await apiClient.delete(`/shortlist/${historyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setShortlistedIds((prev) => prev.filter((id) => id !== historyId));
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-wrapper">
        <AuthForm onAuthSuccess={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div className="bg-orb orb-c" />
      <div className="layout">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onLogout={handleLogout}
      />
      <main className="main-content">
        <Navbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUser={{ email: userEmail }}
          notifications={notifications}
          onLogout={handleLogout}
        />
        {activePage === "dashboard" && <Dashboard results={results} searchQuery={searchQuery} />}
        {activePage === "dashboard" && (
          <ResultsPanel
            results={results}
            token={token}
            shortlistedIds={shortlistedIds}
            onToggleShortlist={handleToggleShortlist}
          />
        )}
        {activePage === "upload" && (
          <UploadForm onSubmit={handleUpload} onPayloadCapture={setLastUploadPayload} />
        )}
        {activePage === "parsed" && (
          <ResumeTable
            rows={parsedRows}
            shortlistedIds={shortlistedIds}
            onToggleShortlist={handleToggleShortlist}
          />
        )}
        {activePage === "history" && (
          <HistoryPage
            token={token}
            shortlistedIds={shortlistedIds}
            onToggleShortlist={handleToggleShortlist}
          />
        )}
        {activePage === "shortlisted" && (
          <ShortlistedCandidatesPage
            token={token}
            onToggleShortlist={handleToggleShortlist}
            onShortlistChanged={() => refreshShortlisted(token)}
          />
        )}
        {activePage === "compare" && <ComparePage token={token} />}
        {activePage === "download" && <DownloadPanel token={token} />}
        {activePage === "settings" && (
          <section className="card">
            <h3>Settings</h3>
            <p className="muted">Settings panel is ready for future preferences and thresholds.</p>
            <button type="button" onClick={handleRetry} disabled={!lastUploadPayload}>
              Retry Last Upload
            </button>
          </section>
        )}
      </main>
      </div>
    </div>
  );
}

export default App;

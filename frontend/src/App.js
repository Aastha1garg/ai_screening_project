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
import ExplainPage from "./components/ExplainPage";
import ImproveResume from "./components/ImproveResume";
import { apiClient } from "./components/api";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("userEmail") || "");
  const [authError, setAuthError] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUploadPayload, setLastUploadPayload] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
    refreshNotifications(token).catch(() => {});
  }, [token]);

  const handleLogin = (newToken) => {
    const email = parseJwtEmail(newToken);
    localStorage.setItem("token", newToken);
    localStorage.setItem("userEmail", email);
    setToken(newToken);
    setUserEmail(email);
    setAuthError("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setToken("");
    setUserEmail("");
    setResults([]);
    setActivePage("dashboard");
    setNotifications([]);
    setUnreadNotifications(0);
    setShortlistedIds([]);
  };

  const handleAuthFailure = () => {
    handleLogout();
    setAuthError("Session expired. Please log in again.");
  };

  const fetchShortlistedCandidates = async (authToken) => {
    const res = await apiClient.get("/shortlist", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return res.data?.results || [];
  };

  const refreshNotifications = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await apiClient.get("/notifications", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setNotifications(res.data?.notifications || []);
      setUnreadNotifications(Number(res.data?.unread_count || 0));
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      throw err;
    }
  };

  const markNotificationsRead = async (authToken = token) => {
    if (!authToken) return;
    try {
      await apiClient.post(
        "/notifications/read-all",
        null,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setUnreadNotifications(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      throw err;
    }
  };

  const refreshShortlisted = async (authToken = token) => {
    if (!authToken) return;
    try {
      const candidates = await fetchShortlistedCandidates(authToken);
      setShortlistedIds(candidates.map((item) => Number(item.id)));
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      throw err;
    }
  };

  const handleUpload = async (formData) => {
    try {
      const response = await apiClient.post("/upload", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextResults = response.data.results || [];
      setResults(nextResults);
      await refreshNotifications(token);
      await refreshShortlisted(token);
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
      }
      throw err;
    }
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
          extraSkills: item.extra_skills || [],
          partialMatches: item.partial_matches || [],
          totalExperience: Number(item.experience?.total_years || 0),
          relevantExperience: Number(item.experience?.relevant_years || 0),
          requiredExperience: Number(item.experience?.required_years || 0),
          education: item.education || [],
          requiredEducation: item.required_education || [],
          certifications: item.certifications || [],
          requiredCertifications: item.required_certifications || [],
          matchedCertifications: item.matched_certifications || [],
          missingCertifications: item.missing_certifications || [],
          extraCertifications: item.extra_certifications || [],
          educationMatch: item.education_match || "",
          experienceMatch: item.experience_match || "",
          scoreBreakdown: item.score_breakdown || {},
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
    try {
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
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      throw err;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-wrapper">
        <AuthForm onAuthSuccess={handleLogin} initialError={authError} />
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
          unreadCount={unreadNotifications}
          onNotificationsOpen={() => markNotificationsRead(token)}
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
        {activePage === "explain" && <ExplainPage token={token} />}
        {activePage === "improve" && <ImproveResume token={token} />}
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

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import ProfilePage from "./components/ProfilePage";
import SettingsPage from "./components/SettingsPage";
import ProgressIndicator from "./components/ProgressIndicator";
import { useRealtimeScoring } from "./hooks/useRealtimeScoring";
import { SettingsProvider } from "./context/LanguageContext";
import { apiClient, AUTH_TOKEN_KEY } from "./components/api";

const LS_UPLOAD_META = "ai_resume_upload_meta";

function dedupeFiles(existingFiles, nextFiles) {
  const seen = new Set(
    existingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
  );
  const merged = [...existingFiles];
  nextFiles.forEach((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(file);
    }
  });
  return merged;
}

function groupResultsByJD(items) {
  const groups = {};
  items.forEach((item) => {
    const jdName = item.jd_name || "Unknown JD";
    if (!groups[jdName]) {
      groups[jdName] = {
        jd_name: jdName,
        candidates: [],
      };
    }
    groups[jdName].candidates.push(item);
  });

  return Object.values(groups).map((group) => {
    const candidates = [...group.candidates].sort(
      (a, b) => Number(b.score || 0) - Number(a.score || 0)
    );
    const statusTotals = { selected: 0, pending: 0, rejected: 0 };
    const scoreData = [];
    const skillDistribution = [];

    candidates.forEach((candidate) => {
      const scoreValue = Number(candidate.score || 0);
      const status = candidate.status ||
        (scoreValue >= 75 ? "selected" : scoreValue >= 50 ? "pending" : "rejected");
      statusTotals[status] = (statusTotals[status] || 0) + 1;
      scoreData.push({
        name: candidate.resume_name || `Candidate ${candidate.id}`,
        score: scoreValue,
      });
      skillDistribution.push({
        name: candidate.resume_name || `Candidate ${candidate.id}`,
        matched: (candidate.matched_skills || []).length,
        missing: (candidate.missing_skills || []).length,
        extra: (candidate.extra_skills || []).length,
      });
    });

    return {
      jd_name: group.jd_name,
      candidates,
      graph_data: {
        status_distribution: [
          { name: "Selected", value: statusTotals.selected },
          { name: "Pending", value: statusTotals.pending },
          { name: "Rejected", value: statusTotals.rejected },
        ],
        score_data: scoreData,
        skill_distribution: skillDistribution,
      },
    };
  });
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [userEmail, setUserEmail] = useState(localStorage.getItem("userEmail") || "");
  const [authError, setAuthError] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [results, setResults] = useState([]);
  const [groupedResults, setGroupedResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUploadPayload, setLastUploadPayload] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [shortlistedIds, setShortlistedIds] = useState([]);

  const [uploadResumes, setUploadResumes] = useState([]);
  const [uploadJds, setUploadJds] = useState([]);
  const [uploadTemplate, setUploadTemplate] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadRestoreHint, setUploadRestoreHint] = useState("");

  // Real-time scoring state
  const [useRealtimeMode, setUseRealtimeMode] = useState(true);
  const [realtimeProgress, setRealtimeProgress] = useState(null);
  const [realtimeResults, setRealtimeResults] = useState([]);
  
  const { connect: connectRealtime, progress, results: rtResults, isConnected: isRtConnected, error: rtError } = useRealtimeScoring((result) => {
    setRealtimeResults(prev => [...prev, result]);
  });

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

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("userEmail");
    localStorage.removeItem(LS_UPLOAD_META);
    setToken("");
    setUserEmail("");
    setResults([]);
    setActivePage("dashboard");
    setNotifications([]);
    setUnreadNotifications(0);
    setShortlistedIds([]);
    setUploadResumes([]);
    setUploadJds([]);
    setUploadTemplate(null);
    setUploadLoading(false);
    setUploadError("");
    setUploadRestoreHint("");
    setLastUploadPayload(null);
  };

  const handleAuthFailure = () => {
    handleLogout();
    setAuthError("Session expired. Please log in again.");
  };

  const fetchShortlistedCandidates = async () => {
    const res = await apiClient.get("/shortlist");
    return res.data?.results || [];
  };

  const refreshNotifications = async () => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return;
    try {
      const res = await apiClient.get("/notifications");
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

  const markNotificationsRead = async () => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return;
    try {
      await apiClient.post("/notifications/read-all", null);
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

  const refreshHistory = async () => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) {
      setResults([]);
      setGroupedResults([]);
      return [];
    }

    try {
      const res = await apiClient.get("/history/results");
      const historyRows = Array.isArray(res.data) ? res.data : [];
      setResults(historyRows);
      setGroupedResults(groupResultsByJD(historyRows));
      return historyRows;
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return [];
      }
      setResults([]);
      setGroupedResults([]);
      return [];
    }
  };

  const refreshShortlisted = async () => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return;
    try {
      const candidates = await fetchShortlistedCandidates();
      setShortlistedIds(candidates.map((item) => Number(item.id)));
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      throw err;
    }
  };

  useEffect(() => {
    if (!token) {
      setResults([]);
      return;
    }
    refreshShortlisted().catch(() => {});
    refreshNotifications().catch(() => {});
    refreshHistory().catch(() => {});
  }, [token]);

  // Track real-time progress updates
  useEffect(() => {
    if (progress) {
      setRealtimeProgress(progress);
    }
  }, [progress]);

  useEffect(() => {
    if (!token) return;
    try {
      const metaRaw = localStorage.getItem(LS_UPLOAD_META);
      if (metaRaw) {
        const m = JSON.parse(metaRaw);
        const parts = [];
        if (m.resumeNames?.length) parts.push(`${m.resumeNames.length} resume(s)`);
        if (m.jdNames?.length) parts.push(`${m.jdNames.length} JD(s)`);
        if (m.templateName) parts.push(`template: ${m.templateName}`);
        if (parts.length) {
          setUploadRestoreHint(
            `Previous session: ${parts.join(", ")}. Files cannot be restored after refresh — select files again to upload.`
          );
        }
      }
    } catch (_err) {
      /* ignore */
    }
  }, [token]);

  const handleLogin = (newToken) => {
    const email = parseJwtEmail(newToken);
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem("userEmail", email);
    setToken(newToken);
    setUserEmail(email);
    setAuthError("");
  };

  const handleUpload = async (formData) => {
    const res = await apiClient.post("/upload", formData);
    const groups = Array.isArray(res.data?.results) ? res.data.results : [];
    if (groups.length && groups[0]?.candidates) {
      setGroupedResults(groups);
      setResults(groups.flatMap((group) => group.candidates || []));
    }
    await refreshHistory();
    await refreshNotifications();
    await refreshShortlisted();
  };

  const performUpload = async () => {
    if (!uploadResumes.length || !uploadJds.length) {
      setUploadError("Please upload at least one resume and one job description.");
      return;
    }
    setUploadLoading(true);
    setUploadError("");
    setRealtimeProgress(null);
    setRealtimeResults([]);

    setLastUploadPayload({
      resumes: Array.from(uploadResumes),
      jds: Array.from(uploadJds),
      template: uploadTemplate,
    });

    try {
      // Use real-time scoring if enabled
      if (useRealtimeMode) {
        // Read files as text for WebSocket
        const readFileSafe = async (file) => {
          try {
            const text = await file.text();

            if (!text || text.length < 20) {
              return `Sample content from ${file.name}`;
            }

            return text;
          } catch {
            return `Sample content from ${file.name}`;
          }
        };

        const resumeTexts = [];
        for (const file of uploadResumes) {
          const text = await readFileSafe(file);
          resumeTexts.push({
            name: file.name,
            text: text && text.length > 10 ? text : "sample resume text"
          });
        }

        const jdTexts = [];
        for (const file of uploadJds) {
          const text = await readFileSafe(file);
          jdTexts.push({
            name: file.name,
            text: text && text.length > 10 ? text : "sample jd text"
          });
        }

      

        const templateText = uploadTemplate ? await uploadTemplate.text() : '';
        console.log("Sending:", resumeTexts, jdTexts);
        console.log("FINAL DATA:", resumeTexts, jdTexts);
        try {
          // Connect and stream results
          await connectRealtime(resumeTexts, jdTexts, templateText);

          // After real-time scoring completes, refresh history and process results
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for DB writes
          await refreshHistory();
        } catch (err) {
          // WebSocket unavailable; silently fall back to REST upload
          const formData = new FormData();
          uploadResumes.forEach((file) => formData.append('resumes', file));
          uploadJds.forEach((file) => formData.append('jds', file));
          if (uploadTemplate) {
            formData.append('template_resume', uploadTemplate);
          }
          await handleUpload(formData);
        }
      } else {
        // Fall back to traditional upload
        const formData = new FormData();
        uploadResumes.forEach((file) => formData.append("resumes", file));
        uploadJds.forEach((file) => formData.append("jds", file));
        if (uploadTemplate) {
          formData.append("template_resume", uploadTemplate);
        }
        await handleUpload(formData);
      }

      try {
        localStorage.setItem(
          LS_UPLOAD_META,
          JSON.stringify({
            resumeNames: uploadResumes.map((f) => f.name),
            jdNames: uploadJds.map((f) => f.name),
            templateName: uploadTemplate?.name || null,
          })
        );
      } catch (_err) {
        /* ignore */
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      setUploadError(err?.response?.data?.detail || err?.message || "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!lastUploadPayload) {
      return;
    }
    setUploadLoading(true);
    setUploadError("");
    const formData = new FormData();
    lastUploadPayload.resumes.forEach((file) => formData.append("resumes", file));
    lastUploadPayload.jds.forEach((file) => formData.append("jds", file));
    if (lastUploadPayload.template) {
      formData.append("template_resume", lastUploadPayload.template);
    }
    try {
      await handleUpload(formData);
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthFailure();
        return;
      }
      setUploadError(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const onAddResumes = useCallback((files) => {
    setUploadResumes((prev) => dedupeFiles(prev, files));
    setUploadRestoreHint("");
  }, []);

  const onAddJds = useCallback((files) => {
    setUploadJds((prev) => dedupeFiles(prev, files));
    setUploadRestoreHint("");
  }, []);

  const onSetTemplate = useCallback((file) => {
    setUploadTemplate(file);
    setUploadRestoreHint("");
  }, []);

  const onRemoveResume = useCallback((index) => {
    setUploadResumes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onRemoveJD = useCallback((index) => {
    setUploadJds((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
          certifications: item.certifications_all || item.certifications || [],
          requiredCertifications: item.certifications_required || item.required_certifications || [],
          matchedCertifications: item.certifications_matched || item.matched_certifications || [],
          missingCertifications: item.certifications_missing || item.missing_certifications || [],
          extraCertifications: item.certifications_extra || item.extra_certifications || [],
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
        await apiClient.post(`/shortlist/${historyId}`, null);
        setShortlistedIds((prev) => (prev.includes(historyId) ? prev : [...prev, historyId]));
      } else {
        await apiClient.delete(`/shortlist/${historyId}`);
        setShortlistedIds((prev) => prev.filter((id) => id !== historyId));
      }
      await refreshHistory();
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
    <SettingsProvider>
      <div className="app-shell">
        <div className="bg-orb orb-a" />
        <div className="bg-orb orb-b" />
        <div className="bg-orb orb-c" />
      
      {/* Real-time scoring progress indicator */}
      <ProgressIndicator progress={realtimeProgress} isVisible={uploadLoading && useRealtimeMode} />
      
      <div className="layout">
        <Sidebar activePage={activePage} onNavigate={setActivePage} onLogout={handleLogout} />
        <main className="main-content">
          <Navbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentUser={{ email: userEmail }}
            notifications={notifications}
            unreadCount={unreadNotifications}
            onNotificationsOpen={() => markNotificationsRead()}
            onLogout={handleLogout}
            onNavigateToProfile={() => setActivePage("profile")}
          />

          <div className="page-panel" hidden={activePage !== "dashboard"}>
            <Dashboard groupedResults={groupedResults.length ? groupedResults : groupResultsByJD(results)} searchQuery={searchQuery} />
            <ResultsPanel
              results={results}
              shortlistedIds={shortlistedIds}
              onToggleShortlist={handleToggleShortlist}
            />
          </div>

          <div className="page-panel" hidden={activePage !== "upload"}>
            <UploadForm
              resumes={uploadResumes}
              jds={uploadJds}
              template={uploadTemplate}
              loading={uploadLoading}
              error={uploadError}
              restoreHint={uploadRestoreHint}
              realtimeMode={useRealtimeMode}
              onToggleRealtimeMode={setUseRealtimeMode}
              onAddResumes={onAddResumes}
              onAddJds={onAddJds}
              onSetTemplate={onSetTemplate}
              onRemoveResume={onRemoveResume}
              onRemoveJD={onRemoveJD}
              onSubmit={performUpload}
            />
          </div>

          <div className="page-panel" hidden={activePage !== "parsed"}>
            <ResumeTable
              rows={parsedRows}
              shortlistedIds={shortlistedIds}
              onToggleShortlist={handleToggleShortlist}
            />
          </div>

          <div className="page-panel" hidden={activePage !== "history"}>
            <HistoryPage
              history={results}
              shortlistedIds={shortlistedIds}
              onToggleShortlist={handleToggleShortlist}
            />
          </div>

          <div className="page-panel" hidden={activePage !== "shortlisted"}>
            <ShortlistedCandidatesPage
              history={results}
              shortlistedIds={shortlistedIds}
              onToggleShortlist={handleToggleShortlist}
              onShortlistChanged={async () => {
                await refreshShortlisted();
                await refreshHistory();
              }}
            />
          </div>

          <div className="page-panel" hidden={activePage !== "compare"}>
            <ComparePage history={results} token={token} />
          </div>

          <div className="page-panel" hidden={activePage !== "explain"}>
            <ExplainPage history={results} token={token} />
          </div>

          <div className="page-panel" hidden={activePage !== "improve"}>
            <ImproveResume history={results} token={token} />
          </div>

          <div className="page-panel" hidden={activePage !== "download"}>
            <DownloadPanel history={results} token={token} />
          </div>

          <div className="page-panel" hidden={activePage !== "settings"}>
            <SettingsPage onSettingsChange={(settings) => {
              // Handle settings changes here if needed
              console.log("Settings updated:", settings);
            }} />
          </div>

          <div className="page-panel" hidden={activePage !== "profile"}>
            <ProfilePage
              currentUser={{ email: userEmail }}
              onUserUpdate={(userData) => {
                // Update user email if changed
                if (userData.email !== userEmail) {
                  setUserEmail(userData.email);
                  localStorage.setItem("userEmail", userData.email);
                }
              }}
            />
          </div>
        </main>
      </div>
    </div>
    </SettingsProvider>
  );
}

export default App;

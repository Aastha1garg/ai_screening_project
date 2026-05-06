import React from "react";
import {
  FiBarChart2,
  FiClock,
  FiGitBranch,
  FiDownload,
  FiFileText,
  FiStar,
  FiLogOut,
  FiSettings,
  FiUploadCloud,
  FiHelpCircle,
  FiEdit3,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";

function Sidebar({ activePage, onNavigate, onLogout }) {
  const { t } = useTranslation();

  const sidebarItems = [
    { key: "dashboard", label: t("sidebar.dashboard"), icon: FiBarChart2 },
    { key: "upload", label: t("sidebar.upload"), icon: FiUploadCloud },
    { key: "parsed", label: t("sidebar.parsedResumes"), icon: FiFileText },
    { key: "history", label: t("sidebar.history"), icon: FiClock },
    { key: "shortlisted", label: t("sidebar.shortlistedCandidates"), icon: FiStar },
    { key: "compare", label: t("sidebar.compare"), icon: FiGitBranch },
    { key: "explain", label: t("sidebar.explainAI"), icon: FiHelpCircle },
    { key: "improve", label: t("sidebar.improveResume"), icon: FiEdit3 },
    { key: "download", label: t("sidebar.download"), icon: FiDownload },
    { key: "settings", label: t("sidebar.settings"), icon: FiSettings },
  ];

  return (
    <aside className="sidebar">
      <h2>{t("sidebar.appName")}</h2>
      <p className="sidebar-subtitle">{t("sidebar.subtitle")}</p>
      <nav className="sidebar-nav">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={activePage === item.key ? "active" : ""}
              onClick={() => onNavigate(item.key)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <button className="logout" onClick={onLogout}>
        <FiLogOut size={16} />
        {t("navbar.logout")}
      </button>
    </aside>
  );
}

export default Sidebar;

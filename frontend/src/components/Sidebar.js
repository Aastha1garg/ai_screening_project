import React from "react";
import {
  FiBarChart2,
  FiClock,
  FiGitBranch,
  FiDownload,
  FiFileText,
  FiLogOut,
  FiSettings,
  FiUploadCloud,
} from "react-icons/fi";

const sidebarItems = [
  { key: "dashboard", label: "Dashboard", icon: FiBarChart2 },
  { key: "upload", label: "Upload", icon: FiUploadCloud },
  { key: "parsed", label: "Parsed Resumes", icon: FiFileText },
  { key: "history", label: "History", icon: FiClock },
  { key: "compare", label: "Compare", icon: FiGitBranch },
  { key: "download", label: "Download", icon: FiDownload },
  { key: "settings", label: "Settings", icon: FiSettings },
];

function Sidebar({ activePage, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      <h2>Resume Vision</h2>
      <p className="sidebar-subtitle">AI Resume Analytics</p>
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
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;

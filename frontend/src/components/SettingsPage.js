import React, { useState, useEffect } from "react";
import { FiCheck, FiEye, FiEyeOff, FiAlertTriangle } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useLanguageSettings } from "../context/LanguageContext";
import { formatDate } from "../utils/dateFormatter";
import i18n from "../i18n/i18n";

const SETTINGS_KEY = "app_settings";

const defaultSettings = {
  appearance: {
    theme: "dark",
  },
  notifications: {
    emailNotifications: true,
    uploadAlerts: true,
    scoringUpdates: true,
    weeklyDigest: false,
  },
  aiPreferences: {
    realtimeScoring: true,
    modelSelection: "gpt-4",
    autoRefresh: true,
  },
  resumeFilters: {
    minScore: 50,
    experienceYears: 0,
    matchThreshold: 70,
  },
};

function ToggleSwitch({ enabled, onChange, label }) {
  return (
    <div className="toggle-item">
      <label htmlFor={label} className="toggle-label">
        {label}
      </label>
      <button
        id={label}
        className={`toggle-switch ${enabled ? "enabled" : ""}`}
        onClick={() => onChange(!enabled)}
        role="switch"
        aria-checked={enabled}
      >
        <div className="toggle-thumb" />
      </button>
    </div>
  );
}

function SettingsPage({ onSettingsChange }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [settings, setSettings] = useState(defaultSettings);
  const [showSaved, setShowSaved] = useState(false);
  const { t } = useTranslation();
  const { languageSettings, updateLanguageSettings } = useLanguageSettings();
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }
  }, []);

  const saveSettings = (newSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    setSettings(newSettings);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);

    if (onSettingsChange) {
      onSettingsChange(newSettings);
    }
  };

  const handleToggle = (section, key) => {
    const updated = { ...settings };
    updated[section][key] = !updated[section][key];
    saveSettings(updated);
  };

  const handleSliderChange = (section, key, value) => {
    const updated = { ...settings };
    updated[section][key] = Number(value);
    saveSettings(updated);
  };

  const handleSelectChange = (section, key, value) => {
    const updated = { ...settings };
    updated[section][key] = value;
    saveSettings(updated);
  };

  const validatePasswordForm = () => {
    const errors = {};
    if (!passwordForm.current) errors.current = t("settings.currentPasswordRequired");
    if (!passwordForm.new) errors.new = t("settings.newPasswordRequired");
    if (passwordForm.new.length < 8) errors.new = t("settings.passwordMinLength");
    if (passwordForm.new !== passwordForm.confirm) errors.confirm = t("settings.passwordMismatch");
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = () => {
    if (!validatePasswordForm()) return;
    // In a real app, send to backend
    console.log("Password change requested");
    setPasswordForm({ current: "", new: "", confirm: "" });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleClearAllData = () => {
    if (window.confirm(t("settings.confirmClearData"))) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const renderProfileSection = () => (
    <div className="settings-section">
      <h3>{t("settings.profileSettings")}</h3>
      <p className="section-subtitle">{t("settings.profileSettingsSubtitle")}</p>

      <div className="settings-form">
        <div className="form-row">
          <label>{t("settings.fullName")}</label>
          <input type="text" placeholder={t("settings.nameplaceholder")} defaultValue="" />
        </div>

        <div className="form-row">
          <label>{t("settings.emailAddress")}</label>
          <input type="email" placeholder={t("settings.emailPlaceholder")} defaultValue="" />
        </div>

        <div className="form-row">
          <label>{t("settings.dateOfBirth")}</label>
          <input type="date" defaultValue="" />
        </div>

        <div className="form-row">
          <label>{t("settings.profilePicture")}</label>
          <div className="file-upload">
            <input type="file" accept="image/*" id="profile-pic" />
            <label htmlFor="profile-pic" className="file-label">
              {t("settings.chooseImage")}
            </label>
          </div>
        </div>

        <button className="btn-save">
          <FiCheck size={16} /> {t("settings.saveProfile")}
        </button>
      </div>
    </div>
  );

  const renderSecuritySection = () => (
    <div className="settings-section">
      <h3>{t("settings.securitySettings")}</h3>
      <p className="section-subtitle">{t("settings.securitySettingsSubtitle")}</p>

      <div className="settings-form">
        <h4>{t("settings.changePassword")}</h4>

        <div className="form-row">
          <label>{t("settings.currentPassword")}</label>
          <div className="password-input-group">
            <input
              type={showPasswords.current ? "text" : "password"}
              placeholder={t("settings.currentPasswordPlaceholder")}
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
            >
              {showPasswords.current ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {passwordErrors.current && <span className="error-message">{passwordErrors.current}</span>}
        </div>

        <div className="form-row">
          <label>{t("settings.newPassword")}</label>
          <div className="password-input-group">
            <input
              type={showPasswords.new ? "text" : "password"}
              placeholder={t("settings.newPasswordPlaceholder")}
              value={passwordForm.new}
              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
            >
              {showPasswords.new ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {passwordErrors.new && <span className="error-message">{passwordErrors.new}</span>}
        </div>

        <div className="form-row">
          <label>{t("settings.confirmNewPassword")}</label>
          <div className="password-input-group">
            <input
              type={showPasswords.confirm ? "text" : "password"}
              placeholder={t("settings.confirmPasswordPlaceholder")}
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
            >
              {showPasswords.confirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
          {passwordErrors.confirm && <span className="error-message">{passwordErrors.confirm}</span>}
        </div>

        <button className="btn-save" onClick={handleChangePassword}>
          <FiCheck size={16} /> {t("settings.updatePassword")}
        </button>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="settings-section">
      <h3>{t("settings.notificationPreferences")}</h3>
      <p className="section-subtitle">{t("settings.notificationPreferencesSubtitle")}</p>

      <div className="toggles-group">
        <ToggleSwitch
          enabled={settings.notifications.emailNotifications}
          onChange={() => handleToggle("notifications", "emailNotifications")}
          label={t("settings.emailNotifications")}
        />
        <p className="toggle-description">{t("settings.emailNotificationsDesc")}</p>

        <ToggleSwitch
          enabled={settings.notifications.uploadAlerts}
          onChange={() => handleToggle("notifications", "uploadAlerts")}
          label={t("settings.uploadAlerts")}
        />
        <p className="toggle-description">{t("settings.uploadAlertsDesc")}</p>

        <ToggleSwitch
          enabled={settings.notifications.scoringUpdates}
          onChange={() => handleToggle("notifications", "scoringUpdates")}
          label={t("settings.scoringUpdates")}
        />
        <p className="toggle-description">{t("settings.scoringUpdatesDesc")}</p>

        <ToggleSwitch
          enabled={settings.notifications.weeklyDigest}
          onChange={() => handleToggle("notifications", "weeklyDigest")}
          label={t("settings.weeklyDigest")}
        />
        <p className="toggle-description">{t("settings.weeklyDigestDesc")}</p>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="settings-section">
      <h3>{t("settings.appearance")}</h3>
      <p className="section-subtitle">{t("settings.appearanceSubtitle")}</p>

      <div className="appearance-options">
        <div className="theme-option">
          <input
            type="radio"
            id="theme-dark"
            name="theme"
            value="dark"
            checked={settings.appearance.theme === "dark"}
            onChange={(e) => handleSelectChange("appearance", "theme", e.target.value)}
          />
          <label htmlFor="theme-dark">
            <div className="theme-preview dark-preview" />
            <span>{t("settings.darkMode")}</span>
          </label>
        </div>

        <div className="theme-option">
          <input
            type="radio"
            id="theme-light"
            name="theme"
            value="light"
            checked={settings.appearance.theme === "light"}
            onChange={(e) => handleSelectChange("appearance", "theme", e.target.value)}
          />
          <label htmlFor="theme-light">
            <div className="theme-preview light-preview" />
            <span>{t("settings.lightMode")}</span>
          </label>
        </div>
      </div>

      <p className="muted" style={{ marginTop: "16px" }}>
        {t("settings.themePreference")}
      </p>
    </div>
  );

  const renderLanguageRegionSection = () => (
    <div className="settings-section">
      <h3>{t("settings.languageRegion")}</h3>
      <p className="section-subtitle">{t("settings.languageRegionSubtitle")}</p>

      <div className="settings-form">
        <div className="form-row">
          <label htmlFor="language-select">{t("settings.language")}</label>
          <select
            id="language-select"
            value={i18n.language}
            onChange={(e) => {
              i18n.changeLanguage(e.target.value);
              setShowSaved(true);
              setTimeout(() => setShowSaved(false), 2000);
            }}
          >
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="timezone-select">{t("settings.timezone")}</label>
          <select
            id="timezone-select"
            value={languageSettings.timezone}
            onChange={(e) => {
              updateLanguageSettings({ timezone: e.target.value });
              setShowSaved(true);
              setTimeout(() => setShowSaved(false), 2000);
            }}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            <option value="Australia/Sydney">Australia/Sydney (AEDT)</option>
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="dateformat-select">{t("settings.dateFormat")}</label>
          <select
            id="dateformat-select"
            value={languageSettings.dateFormat}
            onChange={(e) => {
              updateLanguageSettings({ dateFormat: e.target.value });
              setShowSaved(true);
              setTimeout(() => setShowSaved(false), 2000);
            }}
          >
            <option value="DD MMM YYYY">05 May 2026 (DD MMM YYYY)</option>
            <option value="MM/DD/YYYY">05/05/2026 (MM/DD/YYYY)</option>
            <option value="YYYY-MM-DD">2026-05-05 (YYYY-MM-DD)</option>
          </select>
        </div>

        <div className="preview-box">
          <p className="preview-label">{t("settings.preview")}</p>
          <p className="preview-value">
            {formatDate(new Date(), languageSettings)}
          </p>
        </div>
      </div>
    </div>
  );

  const renderAIPreferencesSection = () => (
    <div className="settings-section">
      <h3>{t("settings.aiPreferences")}</h3>
      <p className="section-subtitle">{t("settings.aiPreferencesSubtitle")}</p>

      <div className="toggles-group">
        <ToggleSwitch
          enabled={settings.aiPreferences.realtimeScoring}
          onChange={() => handleToggle("aiPreferences", "realtimeScoring")}
          label={t("settings.realTimeScoring")}
        />
        <p className="toggle-description">{t("settings.realtimeScoringDesc")}</p>

        <ToggleSwitch
          enabled={settings.aiPreferences.autoRefresh}
          onChange={() => handleToggle("aiPreferences", "autoRefresh")}
          label={t("settings.autoRefresh")}
        />
        <p className="toggle-description">{t("settings.autoRefreshDesc")}</p>
      </div>

      <div className="settings-form" style={{ marginTop: "24px" }}>
        <div className="form-row">
          <label htmlFor="model-select">{t("settings.aiModel")}</label>
          <select
            id="model-select"
            value={settings.aiPreferences.modelSelection}
            onChange={(e) => handleSelectChange("aiPreferences", "modelSelection", e.target.value)}
          >
            <option value="gpt-4">{t("settings.gpt4")}</option>
            <option value="gpt-35">{t("settings.gpt35")}</option>
            <option value="claude">{t("settings.claude")}</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderResumeFiltersSection = () => (
    <div className="settings-section">
      <h3>{t("settings.resumeFilters")}</h3>
      <p className="section-subtitle">{t("settings.resumeFiltersSubtitle")}</p>

      <div className="settings-form">
        <div className="form-row">
          <label>
            {t("settings.minimumScore")} <strong>{settings.resumeFilters.minScore}</strong>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.resumeFilters.minScore}
            onChange={(e) => handleSliderChange("resumeFilters", "minScore", e.target.value)}
            className="slider"
          />
          <div className="slider-labels">
            <span>0</span>
            <span>100</span>
          </div>
        </div>

        <div className="form-row">
          <label>
            {t("settings.experienceYears")} <strong>{settings.resumeFilters.experienceYears}</strong>
          </label>
          <input
            type="range"
            min="0"
            max="50"
            value={settings.resumeFilters.experienceYears}
            onChange={(e) => handleSliderChange("resumeFilters", "experienceYears", e.target.value)}
            className="slider"
          />
          <div className="slider-labels">
            <span>0 {t("history.score")}</span>
            <span>50+ years</span>
          </div>
        </div>

        <div className="form-row">
          <label>
            {t("settings.matchThreshold")} <strong>{settings.resumeFilters.matchThreshold}%</strong>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.resumeFilters.matchThreshold}
            onChange={(e) => handleSliderChange("resumeFilters", "matchThreshold", e.target.value)}
            className="slider"
          />
          <div className="slider-labels">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDangerZoneSection = () => (
    <div className="settings-section danger-zone">
      <h3>
        <FiAlertTriangle size={20} /> {t("settings.dangerZone")}
      </h3>
      <p className="section-subtitle">{t("settings.dangerZoneSubtitle")}</p>

      <div className="danger-actions">
        <div className="danger-item">
          <div>
            <p className="danger-title">{t("settings.clearAllData")}</p>
            <p className="danger-description">
              {t("settings.clearAllDataDesc")}
            </p>
          </div>
          <button className="btn-danger" onClick={handleClearAllData}>
            {t("settings.clearAllData")}
          </button>
        </div>
      </div>
    </div>
  );

  const sections = [
    { id: "profile", label: t("settings.profileSettings") },
    { id: "security", label: t("settings.securitySettings") },
    { id: "notifications", label: t("settings.notificationPreferences") },
    { id: "appearance", label: t("settings.appearance") },
    { id: "language", label: t("settings.languageRegion")},
    { id: "ai", label: t("settings.aiPreferences") },
    { id: "filters", label: t("settings.resumeFilters") },
    { id: "danger", label: t("settings.dangerZone") },
  ];

  return (
    <div className="settings-page-wrapper">
      {showSaved && (
        <div className="success-banner">
          <FiCheck size={18} />
          <span>{t("settings.save")}</span>
        </div>
      )}

      <div className="settings-container">
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <h3 className="sidebar-title">Settings</h3>
          <nav className="settings-tabs">
            {sections.map((section) => (
              <button
                key={section.id}
                className={`tab-button ${activeTab === section.id ? "active" : ""}`}
                onClick={() => setActiveTab(section.id)}
              >
                <span className="tab-icon">{section.icon}</span>
                <span className="tab-label">{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="settings-content">
          {activeTab === "profile" && renderProfileSection()}
          {activeTab === "security" && renderSecuritySection()}
          {activeTab === "notifications" && renderNotificationsSection()}
          {activeTab === "appearance" && renderAppearanceSection()}
          {activeTab === "language" && renderLanguageRegionSection()}
          {activeTab === "ai" && renderAIPreferencesSection()}
          {activeTab === "filters" && renderResumeFiltersSection()}
          {activeTab === "danger" && renderDangerZoneSection()}
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;

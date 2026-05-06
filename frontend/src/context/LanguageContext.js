import React, { createContext, useContext, useState, useEffect } from "react";
import i18n from "../i18n/i18n";

const SettingsContext = createContext();

const defaultLanguageSettings = {
  language: "en",
  timezone: "Asia/Kolkata",
  dateFormat: "DD MMM YYYY", // "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
};

export function SettingsProvider({ children }) {
  const [languageSettings, setLanguageSettings] = useState(defaultLanguageSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("language_region_settings");
    const savedLang = localStorage.getItem("i18n_language");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLanguageSettings(parsed);
        if (parsed.language && parsed.language !== i18n.language) {
          i18n.changeLanguage(parsed.language);
        }
      } catch (err) {
        console.error("Error loading language settings:", err);
      }
    }
    if (!saved && savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang);
      setLanguageSettings((prev) => ({ ...prev, language: savedLang }));
    }
  }, []);

  const updateLanguageSettings = (newSettings) => {
    const updated = { ...languageSettings, ...newSettings };
    setLanguageSettings(updated);
    localStorage.setItem("language_region_settings", JSON.stringify(updated));
    if (newSettings.language) {
      i18n.changeLanguage(newSettings.language);
    }
  };

  const value = {
    languageSettings,
    updateLanguageSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useLanguageSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    console.warn("useLanguageSettings must be used within SettingsProvider");
    return {
      languageSettings: defaultLanguageSettings,
      updateLanguageSettings: () => {},
    };
  }
  return context;
}

export default SettingsContext;

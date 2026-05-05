import React, { createContext, useContext, useState, useEffect } from "react";

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
    if (saved) {
      try {
        setLanguageSettings(JSON.parse(saved));
      } catch (err) {
        console.error("Error loading language settings:", err);
      }
    }
  }, []);

  const updateLanguageSettings = (newSettings) => {
    const updated = { ...languageSettings, ...newSettings };
    setLanguageSettings(updated);
    localStorage.setItem("language_region_settings", JSON.stringify(updated));
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

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import kn from './locales/kn.json';

const resources = {
  en: { translation: en },
  kn: { translation: kn },
};

// Get saved language from localStorage or detect from browser
const savedLanguage = localStorage.getItem('i18n_language');
const detectedLanguage = LanguageDetector.detect();
const defaultLanguage = savedLanguage || detectedLanguage || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// Persist language selection
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n_language', lng);
});

export default i18n;

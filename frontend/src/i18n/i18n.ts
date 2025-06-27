import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import roTranslations from '../locales/ro/translation.json';
import enTranslations from '../locales/en/translation.json';
import itTranslations from '../locales/it/translation.json';

const resources = {
  ro: {
    translation: roTranslations
  },
  en: {
    translation: enTranslations
  },
  it: {
    translation: itTranslations
  }
};

// Ottieni la lingua salvata o usa quella predefinita
const savedLanguage = localStorage.getItem('userLanguage') || 'ro';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage, // Usa la lingua salvata
    fallbackLng: 'ro',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'userLanguage' // Specifica la chiave localStorage
    }
  });

export default i18n;
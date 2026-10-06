import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import bn from "./locales/bn.json";
import en from "./locales/en.json";

/**
 * Internationalisation.
 *
 * Bangla is the fallback — the site is made for a Bangladeshi village audience and
 * an English-only visitor is the edge case, not the default. Detection order puts
 * a previous explicit choice first, so switching language sticks.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "bn", label: "বাংলা", shortLabel: "বাং" },
  { code: "en", label: "English", shortLabel: "EN" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      bn: { translation: bn },
      en: { translation: en },
    },
    fallbackLng: "bn",
    supportedLngs: ["bn", "en"],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "sppl:lang",
      caches: ["localStorage"],
    },
    interpolation: {
      // React already escapes output; double-escaping would mangle Bangla punctuation.
      escapeValue: false,
    },
    returnObjects: true,
    debug: false,
  });

/** Keep the document language in sync so screen readers and font fallbacks agree. */
const applyDocumentLanguage = (lng) => {
  const lang = lng?.startsWith("bn") ? "bn" : "en";
  document.documentElement.lang = lang;
};

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

export default i18n;

import { useCallback, useMemo, useState } from "react";
import { LocaleContext } from "../context/localeContextInstance";
import { MARKETING_TR } from "./marketingPhrases.tr.js";
import { applyDocumentLang, readStoredLanguage, writeStoredLanguage } from "../i18n/storage.js";
import { normalizeLocale, detectDefaultLocale } from "../i18n/detect.js";

const LOCALES = [
  { id: "en", labelKey: "settings.english", nativeLabel: "English" },
  { id: "tr", labelKey: "settings.turkish", nativeLabel: "Türkçe" },
];

function interpolate(str, vars) {
  if (!vars || typeof str !== "string") return str;
  return str.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_, a, b) => {
    const key = a || b;
    return vars[key] != null ? String(vars[key]) : "";
  });
}

function resolveLocale() {
  try {
    const stored = normalizeLocale(readStoredLanguage());
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return detectDefaultLocale() || "en";
}

/**
 * Slim locale provider for public marketing pages — no 120KB+ phrase catalogs.
 * English source strings pass through; TR uses a curated marketing subset.
 */
export default function MarketingLocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(resolveLocale);

  const setLocale = useCallback((next) => {
    const normalized = normalizeLocale(next) || "en";
    setLocaleState(normalized);
    try {
      writeStoredLanguage(normalized);
      applyDocumentLang(normalized);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      if (key == null) return "";
      const k = String(key);
      if (locale === "tr" && MARKETING_TR[k]) return interpolate(MARKETING_TR[k], vars);
      return interpolate(k, vars);
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, locales: LOCALES }),
    [locale, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

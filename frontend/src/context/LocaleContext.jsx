import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  persistLocale,
  resolveInitialLocale,
  translate,
  SUPPORTED_LOCALES,
  normalizeLocale,
} from "../i18n/index.js";
import { API_BASE_URL } from "../config/api";

const LocaleContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => String(key ?? ""),
  locales: SUPPORTED_LOCALES,
});

export function LocaleProvider({ children, meLanguage = null }) {
  const [locale, setLocaleState] = useState(() => resolveInitialLocale({ meLanguage }));

  // When server profile language arrives and user has no explicit local override,
  // prefer account language. Explicit localStorage language always wins.
  useEffect(() => {
    const fromMe = normalizeLocale(meLanguage);
    if (!fromMe) return;
    try {
      const hasExplicit = !!localStorage.getItem("descall_language");
      if (!hasExplicit) {
        setLocaleState(fromMe);
        persistLocale(fromMe);
      }
    } catch {
      /* ignore */
    }
  }, [meLanguage]);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    const normalized = normalizeLocale(next) || "en";
    setLocaleState(normalized);
    persistLocale(normalized);

    // Best-effort sync to account regional settings when logged in
    try {
      const token = localStorage.getItem("descall_token");
      if (token) {
        fetch(`${API_BASE_URL}/api/user/regional`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ language: normalized }),
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }

    // Notify non-React listeners (notifications, electron helpers)
    try {
      window.dispatchEvent(new CustomEvent("descall:locale", { detail: { locale: normalized } }));
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, locales: SUPPORTED_LOCALES }),
    [locale, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}

export default LocaleContext;

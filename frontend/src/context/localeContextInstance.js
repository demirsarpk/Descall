/**
 * Shared LocaleContext instance — avoid importing full i18n catalogs via LocaleContext.jsx
 * from the marketing entry graph.
 */
import { createContext, useContext } from "react";

export const LocaleContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: (key) => String(key ?? ""),
  locales: [
    { id: "en", labelKey: "settings.english", nativeLabel: "English" },
    { id: "tr", labelKey: "settings.turkish", nativeLabel: "Türkçe" },
  ],
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}

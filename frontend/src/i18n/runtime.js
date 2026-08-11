import { resolveInitialLocale, translate } from "./index.js";

let currentLocale = resolveInitialLocale();

if (typeof window !== "undefined") {
  window.addEventListener("descall:locale", (e) => {
    const next = e?.detail?.locale;
    if (next === "tr" || next === "en") currentLocale = next;
  });
}

/** Translate outside React (notifications, services, plain modules). */
export function t(key, vars) {
  return translate(currentLocale, key, vars);
}

export function getLocale() {
  return currentLocale;
}

export function setRuntimeLocale(locale) {
  if (locale === "tr" || locale === "en") currentLocale = locale;
}

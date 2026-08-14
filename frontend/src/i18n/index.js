import { detectDefaultLocale, normalizeLocale } from "./detect.js";
import { applyDocumentLang, readStoredLanguage, writeStoredLanguage } from "./storage.js";

export const SUPPORTED_LOCALES = [
  { id: "en", labelKey: "settings.english", nativeLabel: "English" },
  { id: "tr", labelKey: "settings.turkish", nativeLabel: "Türkçe" },
];

/** Placeholders until `loadI18nCatalogs()` resolves (app boot). */
let catalogs = {
  en: { phrases: {}, nested: {} },
  tr: { phrases: {}, nested: {} },
};
let catalogsReady = false;
let loadPromise = null;

/**
 * Load full EN/TR catalogs. Marketing entry must NOT call this — use slim phrases instead.
 */
export function loadI18nCatalogs() {
  if (catalogsReady) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all([
    import("./locales/en.js"),
    import("./locales/tr.js"),
  ])
    .then(([enMod, trMod]) => {
      catalogs = { en: enMod.default, tr: trMod.default };
      catalogsReady = true;
    })
    .catch((err) => {
      loadPromise = null;
      console.warn("[i18n] catalog load failed", err);
    });
  return loadPromise;
}

export function i18nCatalogsReady() {
  return catalogsReady;
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(str, vars) {
  if (!vars || typeof str !== "string") return str;
  return str.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_, a, b) => {
    const key = a || b;
    return vars[key] != null ? String(vars[key]) : "";
  });
}

/**
 * Translate a key or English source string.
 * Lookup order: nested path → phrases[exact] → original key (English fallback).
 */
export function translate(locale, key, vars) {
  if (key == null) return "";
  const k = String(key);
  const cat = catalogs[locale] || catalogs.en;
  const nestedHit = getByPath(cat.nested, k);
  if (nestedHit != null) return interpolate(nestedHit, vars);

  const phraseHit = cat.phrases?.[k];
  if (phraseHit != null) return interpolate(phraseHit, vars);

  const enNested = getByPath(catalogs.en.nested, k);
  if (enNested != null) {
    const fromPhrase = cat.phrases?.[enNested];
    if (fromPhrase != null) return interpolate(fromPhrase, vars);
    return interpolate(enNested, vars);
  }

  return interpolate(k, vars);
}

export function resolveInitialLocale({ meLanguage } = {}) {
  const stored = normalizeLocale(readStoredLanguage());
  if (stored) return stored;
  const fromMe = normalizeLocale(meLanguage);
  if (fromMe) return fromMe;
  return detectDefaultLocale();
}

export function persistLocale(locale) {
  const normalized = normalizeLocale(locale) || "en";
  writeStoredLanguage(normalized);
  applyDocumentLang(normalized);
  return normalized;
}

try {
  applyDocumentLang(resolveInitialLocale());
} catch {
  /* ignore */
}

export { detectDefaultLocale, normalizeLocale, applyDocumentLang, readStoredLanguage };
export default translate;

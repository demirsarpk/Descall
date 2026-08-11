const SETTINGS_KEY = "descall_user_settings";
const LEGACY_SETTINGS_KEY = "descall_settings";
const LANG_KEY = "descall_language";

export function readStoredLanguage() {
  try {
    const direct = localStorage.getItem(LANG_KEY);
    if (direct === "tr" || direct === "en") return direct;

    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem(LEGACY_SETTINGS_KEY) ||
      "{}";
    const settings = JSON.parse(raw);
    if (settings?.language === "tr" || settings?.language === "en") {
      return settings.language;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredLanguage(language) {
  if (language !== "tr" && language !== "en") return;
  try {
    localStorage.setItem(LANG_KEY, language);

    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem(LEGACY_SETTINGS_KEY) ||
      "{}";
    const settings = JSON.parse(raw || "{}");
    settings.language = language;
    const json = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, json);
    localStorage.setItem(LEGACY_SETTINGS_KEY, json);
  } catch {
    /* ignore */
  }
}

export function applyDocumentLang(language) {
  try {
    document.documentElement.setAttribute("lang", language === "tr" ? "tr" : "en");
  } catch {
    /* ignore */
  }
}

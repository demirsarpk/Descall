/**
 * Detect whether the device should default to Turkish.
 * Priority for defaults (not overrides): TR language OR Europe/Istanbul timezone.
 */
export function isTurkeyDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    const langs = [navigator.language, ...(navigator.languages || [])]
      .filter(Boolean)
      .map((l) => String(l).toLowerCase());
    if (langs.some((l) => l === "tr" || l.startsWith("tr-"))) return true;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz === "Europe/Istanbul") return true;

    // Some browsers expose region via locale (e.g. en-TR)
    if (langs.some((l) => l.endsWith("-tr"))) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function detectDefaultLocale() {
  return isTurkeyDevice() ? "tr" : "en";
}

export function normalizeLocale(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "tr" || v.startsWith("tr")) return "tr";
  if (v === "en" || v.startsWith("en")) return "en";
  return null;
}

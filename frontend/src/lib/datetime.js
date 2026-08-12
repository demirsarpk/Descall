/**
 * Parse app timestamps that may come from Postgres `timestamp` (no tz).
 * Those values are UTC wall-clock; without a Z/offset, JS would treat them
 * as local time and show ~3h early in Turkey (UTC+3).
 */

const HAS_TZ_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function parseAppDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (HAS_TZ_RE.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (DATE_TIME_RE.test(raw)) {
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const d = new Date(`${normalized}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatMessageClock(value, locale) {
  const d = parseAppDate(value);
  if (!d) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatMessageDate(value, locale, options) {
  const d = parseAppDate(value);
  if (!d) return "";
  return d.toLocaleDateString(locale, options);
}

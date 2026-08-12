"use strict";

/**
 * Normalize DB timestamps to ISO-8601 UTC with Z.
 * Postgres `timestamp without time zone` values from Supabase often arrive
 * as "2026-08-12T00:28:01.568" with no offset; treat those as UTC.
 */

const HAS_TZ_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

function toUtcIso(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (HAS_TZ_RE.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (DATE_TIME_RE.test(raw)) {
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const d = new Date(`${normalized}Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = { toUtcIso };

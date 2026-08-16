"use strict";

const PROVIDER_LEAK =
  /\b(gemini(?:[-\s]?(?:pro|flash|ultra|nano))?|google\s*ai|google\s*generative|generativelanguage|googleapis|vertex\s*ai|bard|palm)\b/gi;

const MODEL_ID_LEAK = /\b(gemini-[a-z0-9.\-]+|models\/[a-z0-9.\-\/]+|AIza[0-9A-Za-z_\-]{10,})\b/gi;

const USER_UNAVAILABLE = "Dima is temporarily unavailable. Please try again shortly.";
const USER_GENERIC = "Dima could not complete that request. Please try again.";
const USER_RATE = "You're sending messages too quickly. Please wait a moment.";
const USER_TOO_LONG = "That message is too long. Please shorten it and try again.";

function sanitizeProviderText(text) {
  return String(text || "")
    .replace(MODEL_ID_LEAK, "Dima 1.0")
    .replace(PROVIDER_LEAK, "Dima")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
}

function publicErrorForStatus(status) {
  if (status === 429) return USER_RATE;
  if (status === 401 || status === 403) return USER_UNAVAILABLE;
  if (status >= 500 || status === 408) return USER_UNAVAILABLE;
  return USER_GENERIC;
}

function adminPingError(code) {
  if (code === "auth") return "This key was rejected.";
  if (code === "quota") return USER_RATE;
  if (code === "request") return "This key could not be verified.";
  if (code === "unavailable") return USER_UNAVAILABLE;
  return "This key is not available right now.";
}

function logInternal(scope, err, extra = {}) {
  const msg = err?.message || String(err || "unknown");
  const safe = sanitizeProviderText(msg).slice(0, 300);
  console.error(`[dimaai:${scope}]`, safe, extra.status ? { status: extra.status } : "");
}

module.exports = {
  USER_UNAVAILABLE,
  USER_GENERIC,
  USER_RATE,
  USER_TOO_LONG,
  sanitizeProviderText,
  publicErrorForStatus,
  adminPingError,
  logInternal,
};

"use strict";

const crypto = require("crypto");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

/** True while a previously-issued code is still inside its validity window. */
function isCodeFresh(sentAtIso) {
  if (!sentAtIso) return false;
  const sentAt = new Date(sentAtIso).getTime();
  if (Number.isNaN(sentAt)) return false;
  return Date.now() - sentAt < CODE_TTL_MS;
}

/**
 * Verify a user-entered code against a stored hash + timestamp.
 * Attempts is tracked by the caller (column-backed) to rate-limit guessing.
 */
function verifyStoredCode({ code, storedHash, sentAtIso, attempts = 0 }) {
  if (!storedHash || !sentAtIso) return { ok: false, reason: "no_pending_code" };
  if (attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (!isCodeFresh(sentAtIso)) return { ok: false, reason: "expired" };
  const match = hashCode(code) === storedHash;
  return { ok: match, reason: match ? null : "invalid_code" };
}

module.exports = { hashCode, isCodeFresh, verifyStoredCode, CODE_TTL_MS, MAX_ATTEMPTS };

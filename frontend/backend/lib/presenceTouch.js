"use strict";

const supabase = require("../db/supabase");
const { userLastLoginAt, lastSeenByUserId } = require("../runtime/sharedState");

/** Avoid hammering Postgres on rapid reconnects / multi-tab sockets. */
const MIN_INTERVAL_MS = 60_000;
const lastDbWriteAt = new Map();

/**
 * Record that a user was active now.
 * Updates in-memory maps always; persists to users.last_seen (throttled unless force).
 */
async function touchLastSeen(userId, { force = false } = {}) {
  if (!userId) return null;
  const nowIso = new Date().toISOString();
  userLastLoginAt.set(userId, nowIso);
  lastSeenByUserId.set(userId, nowIso);

  const prev = lastDbWriteAt.get(userId) || 0;
  if (!force && Date.now() - prev < MIN_INTERVAL_MS) {
    return nowIso;
  }
  lastDbWriteAt.set(userId, Date.now());

  try {
    const { error } = await supabase.from("users").update({ last_seen: nowIso }).eq("id", userId);
    if (error) {
      console.warn("[presence] last_seen update failed:", error.message);
    }
  } catch (err) {
    console.warn("[presence] last_seen update failed:", err?.message || err);
  }
  return nowIso;
}

module.exports = { touchLastSeen };

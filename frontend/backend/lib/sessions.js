"use strict";

const { v4: uuidv4 } = require("uuid");
const supabase = require("../db/supabase");

const MAX_SESSIONS_PER_USER = 10;

/** Lightweight device/browser label from a User-Agent string — no extra deps. */
function describeDevice(userAgent = "") {
  const ua = String(userAgent || "");
  if (/Descall-Electron/i.test(ua) || /Electron/i.test(ua)) return "Descall Desktop";
  if (/Descall-Android|; wv\)/i.test(ua) || (/Android/i.test(ua) && /Descall/i.test(ua))) return "Descall Android";

  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
}

function clientIp(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Append a new session to the user's active_sessions column, keep only the
 * most recent MAX_SESSIONS_PER_USER, and return the created session + full
 * list. active_sessions is the durable source of truth shown in Settings;
 * instant revocation is layered on top via an in-memory set (see
 * runtime/sharedState.revokedSessionIds) checked on every request.
 */
async function createSession(userId, { userAgent, ip } = {}) {
  const session = {
    id: uuidv4(),
    device: describeDevice(userAgent),
    ip: ip || "unknown",
    userAgent: String(userAgent || "").slice(0, 300),
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const { data: userRow } = await supabase
    .from("users")
    .select("active_sessions")
    .eq("id", userId)
    .maybeSingle();

  const existing = Array.isArray(userRow?.active_sessions) ? userRow.active_sessions : [];
  const next = [session, ...existing].slice(0, MAX_SESSIONS_PER_USER);

  await supabase.from("users").update({ active_sessions: next }).eq("id", userId);

  return { session, sessions: next };
}

async function listSessions(userId) {
  const { data } = await supabase
    .from("users")
    .select("active_sessions")
    .eq("id", userId)
    .maybeSingle();
  return Array.isArray(data?.active_sessions) ? data.active_sessions : [];
}

async function removeSession(userId, sessionId) {
  const sessions = await listSessions(userId);
  const next = sessions.filter((s) => s.id !== sessionId);
  await supabase.from("users").update({ active_sessions: next }).eq("id", userId);
  return next;
}

async function removeOtherSessions(userId, keepSessionId) {
  const sessions = await listSessions(userId);
  const removed = sessions.filter((s) => s.id !== keepSessionId).map((s) => s.id);
  const next = sessions.filter((s) => s.id === keepSessionId);
  await supabase.from("users").update({ active_sessions: next }).eq("id", userId);
  return { removed, sessions: next };
}

async function touchSession(userId, sessionId) {
  if (!userId || !sessionId) return;
  try {
    const sessions = await listSessions(userId);
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx] = { ...sessions[idx], lastActiveAt: new Date().toISOString() };
    await supabase.from("users").update({ active_sessions: sessions }).eq("id", userId);
  } catch {
    /* best-effort */
  }
}

module.exports = {
  describeDevice,
  clientIp,
  createSession,
  listSessions,
  removeSession,
  removeOtherSessions,
  touchSession,
  MAX_SESSIONS_PER_USER,
};

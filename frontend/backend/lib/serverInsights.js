"use strict";

const supabase = require("../db/supabase");

function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildDaySeries(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      messages: 0,
      joins: 0,
      voiceMinutes: 0,
    });
  }
  return out;
}

/**
 * Aggregate server activity for the last N days (UTC).
 */
async function getServerInsights(serverId, { days = 7 } = {}) {
  const safeDays = Math.min(30, Math.max(1, Number(days) || 7));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (safeDays - 1));
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const series = buildDaySeries(safeDays);
  const byDay = new Map(series.map((row) => [row.date, row]));

  const [messagesRes, joinsRes, voiceRes, memberCountRes] = await Promise.all([
    supabase
      .from("server_messages")
      .select("created_at, message_type")
      .eq("server_id", serverId)
      .gte("created_at", sinceIso)
      .limit(20000),
    supabase
      .from("server_audit_logs")
      .select("created_at, action")
      .eq("server_id", serverId)
      .eq("action", "MEMBER_JOIN")
      .gte("created_at", sinceIso)
      .limit(10000),
    supabase
      .from("server_voice_sessions")
      .select("joined_at, duration_seconds")
      .eq("server_id", serverId)
      .gte("joined_at", sinceIso)
      .limit(20000),
    supabase
      .from("server_members")
      .select("user_id", { count: "exact", head: true })
      .eq("server_id", serverId),
  ]);

  if (messagesRes.error) throw messagesRes.error;
  if (joinsRes.error) throw joinsRes.error;
  if (voiceRes.error) {
    // Table may not exist yet on older deploys — degrade gracefully.
    console.warn("[Insights] voice sessions query failed:", voiceRes.error.message);
  }
  if (memberCountRes.error) throw memberCountRes.error;

  let totalMessages = 0;
  let systemMessages = 0;
  for (const row of messagesRes.data || []) {
    const key = dayKey(row.created_at);
    const bucket = key ? byDay.get(key) : null;
    if (!bucket) continue;
    if (row.message_type === "system") {
      systemMessages += 1;
      continue;
    }
    bucket.messages += 1;
    totalMessages += 1;
  }

  let totalJoins = 0;
  for (const row of joinsRes.data || []) {
    const key = dayKey(row.created_at);
    const bucket = key ? byDay.get(key) : null;
    if (!bucket) continue;
    bucket.joins += 1;
    totalJoins += 1;
  }

  let totalVoiceSeconds = 0;
  for (const row of voiceRes.data || []) {
    const key = dayKey(row.joined_at);
    const bucket = key ? byDay.get(key) : null;
    const secs = Math.max(0, Number(row.duration_seconds) || 0);
    totalVoiceSeconds += secs;
    if (bucket) bucket.voiceMinutes += secs / 60;
  }

  for (const row of series) {
    row.voiceMinutes = Math.round(row.voiceMinutes * 10) / 10;
  }

  return {
    rangeDays: safeDays,
    since: sinceIso,
    memberCount: memberCountRes.count || 0,
    totals: {
      messages: totalMessages,
      joins: totalJoins,
      voiceMinutes: Math.round((totalVoiceSeconds / 60) * 10) / 10,
      systemMessages,
    },
    daily: series,
  };
}

/**
 * Persist a closed voice session (best-effort).
 */
async function recordVoiceSession({ serverId, channelId, userId, joinedAtMs, leftAtMs = Date.now() }) {
  if (!serverId || !channelId || !userId || !joinedAtMs) return;
  const joinedAt = new Date(joinedAtMs);
  const leftAt = new Date(leftAtMs);
  if (Number.isNaN(joinedAt.getTime()) || Number.isNaN(leftAt.getTime())) return;
  const durationSeconds = Math.max(0, Math.round((leftAt.getTime() - joinedAt.getTime()) / 1000));
  // Ignore tiny blips (channel hop noise)
  if (durationSeconds < 5) return;

  const { error } = await supabase.from("server_voice_sessions").insert({
    server_id: serverId,
    channel_id: channelId,
    user_id: userId,
    joined_at: joinedAt.toISOString(),
    left_at: leftAt.toISOString(),
    duration_seconds: durationSeconds,
  });
  if (error) {
    console.warn("[Insights] voice session insert failed:", error.message);
  }
}

module.exports = {
  getServerInsights,
  recordVoiceSession,
};

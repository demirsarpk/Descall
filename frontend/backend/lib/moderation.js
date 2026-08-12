"use strict";

const supabase = require("../db/supabase");
const state = require("../runtime/sharedState");

/** Rich reason taxonomy for bans/timeouts — keys are stable API ids. */
const MOD_CATEGORIES = [
  { id: "harassment", label: "Harassment / Bullying", group: "safety" },
  { id: "hate_speech", label: "Hate Speech", group: "safety" },
  { id: "threats", label: "Threats / Violence", group: "safety" },
  { id: "self_harm", label: "Self-Harm Content", group: "safety" },
  { id: "child_safety", label: "Child Safety", group: "safety" },
  { id: "extremism", label: "Extremism", group: "safety" },
  { id: "spam", label: "Spam", group: "abuse" },
  { id: "scam", label: "Scam / Phishing", group: "abuse" },
  { id: "fraud", label: "Fraud", group: "abuse" },
  { id: "malware", label: "Malware / Malicious Links", group: "abuse" },
  { id: "advertising", label: "Unauthorized Advertising", group: "abuse" },
  { id: "raid", label: "Raid / Coordinated Attack", group: "abuse" },
  { id: "impersonation", label: "Impersonation", group: "identity" },
  { id: "multi_account", label: "Multiple Accounts Abuse", group: "identity" },
  { id: "ban_evasion", label: "Ban Evasion", group: "identity" },
  { id: "underage", label: "Underage User", group: "identity" },
  { id: "nsfw", label: "NSFW / Sexual Content", group: "content" },
  { id: "illegal", label: "Illegal Content", group: "content" },
  { id: "doxxing", label: "Doxxing / Privacy Violation", group: "content" },
  { id: "copyright", label: "Copyright Infringement", group: "content" },
  { id: "language", label: "Abusive Language", group: "content" },
  { id: "voice_abuse", label: "Voice Chat Abuse", group: "platform" },
  { id: "screenshare_abuse", label: "Screen Share Abuse", group: "platform" },
  { id: "feature_abuse", label: "Feature Abuse", group: "platform" },
  { id: "report_abuse", label: "False Reports / Report Abuse", group: "platform" },
  { id: "disruptive", label: "Disruptive Behavior", group: "community" },
  { id: "tos", label: "Terms of Service Violation", group: "community" },
  { id: "guidelines", label: "Community Guidelines Violation", group: "community" },
  { id: "suspicious", label: "Suspicious Activity", group: "community" },
  { id: "other", label: "Other", group: "other" },
];

const CATEGORY_IDS = new Set(MOD_CATEGORIES.map((c) => c.id));

const TIMEOUT_PRESETS = [
  { id: "5m", label: "5 minutes", seconds: 5 * 60 },
  { id: "15m", label: "15 minutes", seconds: 15 * 60 },
  { id: "30m", label: "30 minutes", seconds: 30 * 60 },
  { id: "1h", label: "1 hour", seconds: 60 * 60 },
  { id: "6h", label: "6 hours", seconds: 6 * 60 * 60 },
  { id: "12h", label: "12 hours", seconds: 12 * 60 * 60 },
  { id: "24h", label: "24 hours", seconds: 24 * 60 * 60 },
  { id: "3d", label: "3 days", seconds: 3 * 24 * 60 * 60 },
  { id: "7d", label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "14d", label: "14 days", seconds: 14 * 24 * 60 * 60 },
  { id: "30d", label: "30 days", seconds: 30 * 24 * 60 * 60 },
];

const BAN_PRESETS = [
  { id: "permanent", label: "Permanent", seconds: null },
  { id: "24h", label: "24 hours", seconds: 24 * 60 * 60 },
  { id: "3d", label: "3 days", seconds: 3 * 24 * 60 * 60 },
  { id: "7d", label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "30d", label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { id: "90d", label: "90 days", seconds: 90 * 24 * 60 * 60 },
  { id: "365d", label: "1 year", seconds: 365 * 24 * 60 * 60 },
];

function categoryLabel(id) {
  return MOD_CATEGORIES.find((c) => c.id === id)?.label || id || "Other";
}

function normalizeCategory(category, otherText) {
  const id = String(category || "other").trim();
  if (!CATEGORY_IDS.has(id)) return { category: "other", reason: String(otherText || category || "Other").trim() };
  if (id === "other") {
    const reason = String(otherText || "").trim();
    return { category: "other", reason: reason || "Other" };
  }
  return { category: id, reason: categoryLabel(id) };
}

function resolveDurationSeconds({ durationSeconds, presetId, presets }) {
  if (durationSeconds != null && Number.isFinite(Number(durationSeconds))) {
    const n = Math.floor(Number(durationSeconds));
    if (n > 0) return n;
  }
  if (presetId === "permanent" || presetId === "perm") return null;
  const preset = (presets || []).find((p) => p.id === presetId);
  if (preset) return preset.seconds;
  return null;
}

function expiresFromSeconds(seconds) {
  if (seconds == null) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function publicBanPayload(row) {
  if (!row?.is_banned) return null;
  if (row.ban_expires_at && new Date(row.ban_expires_at).getTime() <= Date.now()) return null;
  return {
    banned: true,
    category: row.ban_category || "other",
    categoryLabel: categoryLabel(row.ban_category),
    reason: row.ban_reason || null,
    message: row.ban_message || null,
    bannedAt: row.banned_at || null,
    expiresAt: row.ban_expires_at || null,
  };
}

function publicTimeoutPayload(entryOrRow) {
  if (!entryOrRow) return null;
  const until = entryOrRow.until || entryOrRow.timeout_until;
  if (!until || new Date(until).getTime() <= Date.now()) return null;
  return {
    timedOut: true,
    category: entryOrRow.category || entryOrRow.timeout_category || "other",
    categoryLabel: categoryLabel(entryOrRow.category || entryOrRow.timeout_category),
    reason: entryOrRow.reason || entryOrRow.timeout_reason || null,
    message: entryOrRow.message || entryOrRow.timeout_message || null,
    until,
    timedOutAt: entryOrRow.timedOutAt || entryOrRow.timed_out_at || null,
  };
}

function getActiveTimeout(userId) {
  const entry = state.timedOutUsers.get(String(userId));
  if (!entry) return null;
  if (new Date(entry.until).getTime() <= Date.now()) {
    state.timedOutUsers.delete(String(userId));
    clearTimeoutInDb(userId).catch(() => {});
    return null;
  }
  return publicTimeoutPayload(entry);
}

function isTimedOut(userId) {
  return Boolean(getActiveTimeout(userId));
}

function isBanned(userId) {
  return state.bannedUserIds.has(String(userId));
}

async function recordAction({
  actionType,
  targetUserId,
  actorUserId,
  category,
  reason,
  message,
  durationSeconds,
  expiresAt,
  meta = {},
}) {
  const { data, error } = await supabase
    .from("moderation_actions")
    .insert({
      action_type: actionType,
      target_user_id: targetUserId,
      actor_user_id: actorUserId || null,
      category: category || null,
      reason: reason || null,
      message: message || null,
      duration_seconds: durationSeconds ?? null,
      expires_at: expiresAt || null,
      meta,
    })
    .select("*")
    .single();
  if (error) {
    console.warn("[moderation] recordAction failed:", error.message);
    return null;
  }
  return data;
}

async function clearTimeoutInDb(userId) {
  await supabase
    .from("users")
    .update({
      timeout_until: null,
      timeout_category: null,
      timeout_reason: null,
      timeout_message: null,
      timed_out_at: null,
      timed_out_by: null,
    })
    .eq("id", userId);
}

async function applyBan({
  targetUserId,
  actorUserId,
  category,
  otherText,
  message,
  presetId,
  durationSeconds,
}) {
  const { category: cat, reason } = normalizeCategory(category, otherText);
  const seconds = resolveDurationSeconds({
    durationSeconds,
    presetId: presetId || "permanent",
    presets: BAN_PRESETS,
  });
  const expiresAt = expiresFromSeconds(seconds);
  const now = new Date().toISOString();
  const msg = String(message || "").trim() || null;

  const { error } = await supabase
    .from("users")
    .update({
      is_banned: true,
      ban_category: cat,
      ban_reason: reason,
      ban_message: msg,
      banned_at: now,
      banned_by: actorUserId || null,
      ban_expires_at: expiresAt,
      // Ban supersedes an active timeout
      timeout_until: null,
      timeout_category: null,
      timeout_reason: null,
      timeout_message: null,
      timed_out_at: null,
      timed_out_by: null,
    })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);

  state.bannedUserIds.add(String(targetUserId));
  state.timedOutUsers.delete(String(targetUserId));
  state.banDetailsByUser.set(String(targetUserId), {
    category: cat,
    reason,
    message: msg,
    bannedAt: now,
    expiresAt,
  });

  await recordAction({
    actionType: "ban",
    targetUserId,
    actorUserId,
    category: cat,
    reason,
    message: msg,
    durationSeconds: seconds,
    expiresAt,
  });

  return {
    ok: true,
    category: cat,
    reason,
    message: msg,
    expiresAt,
    durationSeconds: seconds,
  };
}

async function revokeBan({ targetUserId, actorUserId, note }) {
  const { error } = await supabase
    .from("users")
    .update({
      is_banned: false,
      ban_category: null,
      ban_reason: null,
      ban_message: null,
      banned_at: null,
      banned_by: null,
      ban_expires_at: null,
    })
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);

  state.bannedUserIds.delete(String(targetUserId));
  state.banDetailsByUser.delete(String(targetUserId));

  await recordAction({
    actionType: "unban",
    targetUserId,
    actorUserId,
    message: note || null,
  });

  return { ok: true };
}

async function applyTimeout({
  targetUserId,
  actorUserId,
  category,
  otherText,
  message,
  presetId,
  durationSeconds,
}) {
  const { category: cat, reason } = normalizeCategory(category, otherText);
  const seconds = resolveDurationSeconds({
    durationSeconds,
    presetId: presetId || "1h",
    presets: TIMEOUT_PRESETS,
  });
  if (!seconds || seconds < 60) {
    throw new Error("Timeout duration must be at least 60 seconds.");
  }
  const until = expiresFromSeconds(seconds);
  const now = new Date().toISOString();
  const msg = String(message || "").trim() || null;

  const { error } = await supabase
    .from("users")
    .update({
      timeout_until: until,
      timeout_category: cat,
      timeout_reason: reason,
      timeout_message: msg,
      timed_out_at: now,
      timed_out_by: actorUserId || null,
    })
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);

  const entry = {
    until,
    category: cat,
    reason,
    message: msg,
    timedOutAt: now,
    actorId: actorUserId || null,
  };
  state.timedOutUsers.set(String(targetUserId), entry);

  await recordAction({
    actionType: "timeout",
    targetUserId,
    actorUserId,
    category: cat,
    reason,
    message: msg,
    durationSeconds: seconds,
    expiresAt: until,
  });

  return {
    ok: true,
    ...publicTimeoutPayload(entry),
    durationSeconds: seconds,
  };
}

async function revokeTimeout({ targetUserId, actorUserId, note }) {
  await clearTimeoutInDb(targetUserId);
  state.timedOutUsers.delete(String(targetUserId));
  await recordAction({
    actionType: "untimeout",
    targetUserId,
    actorUserId,
    message: note || null,
  });
  return { ok: true };
}

async function loadModerationStateFromDb() {
  try {
    const nowIso = new Date().toISOString();

    // Expire temporary bans whose clock has elapsed
    await supabase
      .from("users")
      .update({
        is_banned: false,
        ban_category: null,
        ban_reason: null,
        ban_message: null,
        banned_at: null,
        banned_by: null,
        ban_expires_at: null,
      })
      .eq("is_banned", true)
      .not("ban_expires_at", "is", null)
      .lte("ban_expires_at", nowIso);

    const { data: banned, error: banErr } = await supabase
      .from("users")
      .select("id, ban_category, ban_reason, ban_message, banned_at, ban_expires_at")
      .eq("is_banned", true);
    if (banErr) {
      console.warn("[moderation] load bans:", banErr.message);
    } else {
      state.bannedUserIds.clear();
      state.banDetailsByUser.clear();
      for (const row of banned || []) {
        const id = String(row.id);
        state.bannedUserIds.add(id);
        state.banDetailsByUser.set(id, {
          category: row.ban_category || "other",
          reason: row.ban_reason || null,
          message: row.ban_message || null,
          bannedAt: row.banned_at || null,
          expiresAt: row.ban_expires_at || null,
        });
      }
    }

    // Clear expired timeouts in DB
    await supabase
      .from("users")
      .update({
        timeout_until: null,
        timeout_category: null,
        timeout_reason: null,
        timeout_message: null,
        timed_out_at: null,
        timed_out_by: null,
      })
      .not("timeout_until", "is", null)
      .lte("timeout_until", nowIso);

    const { data: timed, error: tErr } = await supabase
      .from("users")
      .select("id, timeout_until, timeout_category, timeout_reason, timeout_message, timed_out_at, timed_out_by")
      .not("timeout_until", "is", null)
      .gt("timeout_until", nowIso);
    if (tErr) {
      console.warn("[moderation] load timeouts:", tErr.message);
    } else {
      state.timedOutUsers.clear();
      for (const row of timed || []) {
        state.timedOutUsers.set(String(row.id), {
          until: row.timeout_until,
          category: row.timeout_category || "other",
          reason: row.timeout_reason || null,
          message: row.timeout_message || null,
          timedOutAt: row.timed_out_at || null,
          actorId: row.timed_out_by || null,
        });
      }
    }

    console.log(
      `[moderation] Loaded bans=${state.bannedUserIds.size} timeouts=${state.timedOutUsers.size}`
    );
  } catch (e) {
    console.warn("[moderation] loadModerationStateFromDb:", e.message);
  }
}

async function listActiveSanctions() {
  const now = Date.now();
  const bans = [];
  for (const id of state.bannedUserIds) {
    const d = state.banDetailsByUser.get(id) || {};
    if (d.expiresAt && new Date(d.expiresAt).getTime() <= now) continue;
    bans.push({
      userId: id,
      type: "ban",
      category: d.category || "other",
      categoryLabel: categoryLabel(d.category),
      reason: d.reason || null,
      message: d.message || null,
      bannedAt: d.bannedAt || null,
      expiresAt: d.expiresAt || null,
    });
  }
  const timeouts = [];
  for (const [id, entry] of state.timedOutUsers) {
    if (new Date(entry.until).getTime() <= now) continue;
    timeouts.push({
      userId: id,
      type: "timeout",
      ...publicTimeoutPayload(entry),
    });
  }

  const ids = [...new Set([...bans.map((b) => b.userId), ...timeouts.map((t) => t.userId)])];
  let usersById = {};
  if (ids.length) {
    const { data } = await supabase.from("users").select("id, username, avatar_url, display_name").in("id", ids);
    for (const u of data || []) usersById[u.id] = u;
  }

  const enrich = (row) => ({
    ...row,
    username: usersById[row.userId]?.username || state.usernameById.get(row.userId) || row.userId.slice(0, 8),
    avatarUrl: usersById[row.userId]?.avatar_url || null,
    displayName: usersById[row.userId]?.display_name || null,
  });

  return {
    bans: bans.map(enrich),
    timeouts: timeouts.map(enrich),
  };
}

async function listHistory({ limit = 50, targetUserId } = {}) {
  let q = supabase
    .from("moderation_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  if (targetUserId) q = q.eq("target_user_id", targetUserId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data || [];
  const userIds = [
    ...new Set(rows.flatMap((r) => [r.target_user_id, r.actor_user_id].filter(Boolean))),
  ];
  let usersById = {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", userIds);
    for (const u of users || []) usersById[u.id] = u;
  }
  return rows.map((r) => ({
    ...r,
    categoryLabel: categoryLabel(r.category),
    targetUsername: usersById[r.target_user_id]?.username || null,
    actorUsername: usersById[r.actor_user_id]?.username || null,
  }));
}

async function fetchUserBanRow(userId) {
  const { data } = await supabase
    .from("users")
    .select(
      "id, username, is_banned, ban_category, ban_reason, ban_message, banned_at, ban_expires_at, timeout_until, timeout_category, timeout_reason, timeout_message, timed_out_at"
    )
    .eq("id", userId)
    .maybeSingle();
  return data;
}

module.exports = {
  MOD_CATEGORIES,
  TIMEOUT_PRESETS,
  BAN_PRESETS,
  categoryLabel,
  normalizeCategory,
  publicBanPayload,
  publicTimeoutPayload,
  getActiveTimeout,
  isTimedOut,
  isBanned,
  applyBan,
  revokeBan,
  applyTimeout,
  revokeTimeout,
  loadModerationStateFromDb,
  listActiveSanctions,
  listHistory,
  fetchUserBanRow,
  recordAction,
};

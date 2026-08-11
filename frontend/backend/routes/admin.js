"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const state = require("../runtime/sharedState");
const {
  kickUser,
  disconnectAll,
  notifyAdminRoom,
  buildSnapshot,
} = require("../socket/adminHandlers");

const router = express.Router();
const BCRYPT_ROUNDS = 12;

router.use(requireAuth, requireAdmin);

function getIo(req) {
  return req.app.get("io");
}

function audit(actor, action, target, meta) {
  return state.appendAudit(actor.id, actor.username, action, target, meta);
}

function cleanupUserMemory(userId) {
  state.presence.delete(userId);
  state.socketToUser.forEach((uid, sid) => {
    if (uid === userId) state.socketToUser.delete(sid);
  });
  state.friends.delete(userId);
  for (const [, set] of state.friends) {
    if (set?.has(userId)) set.delete(userId);
  }
  state.pendingRequests.delete(userId);
  for (const [, m] of state.pendingRequests) {
    if (m?.has(userId)) m.delete(userId);
  }
  for (const key of [...state.dmHistory.keys()]) {
    const parts = key.split("::");
    if (parts.includes(userId)) state.dmHistory.delete(key);
  }
  state.notificationsByUser.delete(userId);
  state.dmUnreadByUser.delete(userId);
  state.generalReadAt.delete(userId);
  state.usernameById.delete(userId);
  state.userRoles.delete(userId);
  state.rateLimitGeneral.delete(userId);
  state.rateLimitDm.delete(userId);
  state.slowModeLastPost.delete(userId);
  state.userSessionStartMs.delete(userId);
  state.generalMessages.splice(
    0,
    state.generalMessages.length,
    ...state.generalMessages.filter((m) => m.userId !== userId),
  );
}

router.get("/stats", (_req, res) => {
  try {
    res.json({
      uptime: process.uptime(),
      onlineUsers: state?.presence?.size || 0,
      generalMessageCount: state?.generalMessages?.length || 0,
      dmConversationKeys: state?.dmHistory?.size || 0,
      bannedUsers: state?.bannedUserIds?.size || 0,
      auditEntries: state?.auditLog?.length || 0,
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load stats." });
  }
});

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    maintenanceMode: state.systemConfig.maintenanceMode,
    chatFrozen: state.systemConfig.chatFrozen,
  });
});

router.get("/users", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(0, parseInt(req.query.page || "0", 10) || 0);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || "200", 10) || 200));
    const from = page * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("users")
      .select("id, username, display_name, created_at, avatar_url, is_admin, last_seen", { count: "exact" });
    if (q) {
      query = query.ilike("username", `%${q}%`);
    }
    const { data, error, count } = await query.order("username", { ascending: true }).range(from, to);
    if (error) return res.status(500).json({ error: error.message });

    const rows = (data || []).map((u) => {
      const isAdmin = Boolean(u.is_admin) || u.username === "admin";
      // Keep in-memory role map in sync with durable DB flag
      if (isAdmin) state.userRoles.set(u.id, "admin");
      else if (state.userRoles.get(u.id) === "admin") state.userRoles.set(u.id, "user");
      const role = isAdmin ? "admin" : (state.userRoles.get(u.id) || "user");
      const lastSeen =
        state.userLastLoginAt.get(u.id) ||
        state.lastSeenByUserId.get(u.id) ||
        u.last_seen ||
        null;
      return {
        ...u,
        displayName: u.display_name || u.username,
        is_admin: isAdmin,
        isOnline: state.presence.has(u.id),
        last_seen: lastSeen,
        banned: state.bannedUserIds.has(u.id),
        role,
        lastLoginAt: lastSeen,
        onlineMsTotal: state.userOnlineAccumMs.get(u.id) || 0,
      };
    });

    res.json({ users: rows, total: count ?? rows.length, page, limit });
  } catch (e) {
    res.status(500).json({ error: "Failed to list users." });
  }
});

/** Recently active + newly joined boards for the admin panel. */
router.get("/member-pulse", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "40", 10) || 40));

    const [joinedRes, activeRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, display_name, avatar_url, created_at, last_seen, is_admin")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("users")
        .select("id, username, display_name, avatar_url, created_at, last_seen, is_admin")
        .not("last_seen", "is", null)
        .order("last_seen", { ascending: false })
        .limit(limit),
    ]);

    if (joinedRes.error) return res.status(500).json({ error: joinedRes.error.message });
    if (activeRes.error) return res.status(500).json({ error: activeRes.error.message });

    const enrich = (u) => {
      const lastSeen =
        state.userLastLoginAt.get(u.id) ||
        state.lastSeenByUserId.get(u.id) ||
        u.last_seen ||
        null;
      const p = state.presence.get(u.id);
      return {
        id: u.id,
        username: u.username,
        display_name: u.display_name || null,
        displayName: u.display_name || u.username,
        avatar_url: u.avatar_url || p?.avatar_url || null,
        created_at: u.created_at || null,
        last_seen: lastSeen,
        is_admin: Boolean(u.is_admin) || u.username === "admin",
        isOnline: Boolean(p),
        status: p?.status || "offline",
      };
    };

    const newlyJoined = (joinedRes.data || []).map(enrich);

    const byId = new Map();
    for (const [id, p] of state.presence.entries()) {
      byId.set(id, {
        id,
        username: p.username || state.usernameById.get(id) || "?",
        display_name: null,
        displayName: p.username || state.usernameById.get(id) || "?",
        avatar_url: p.avatar_url || null,
        created_at: null,
        last_seen: state.userLastLoginAt.get(id) || new Date().toISOString(),
        is_admin: state.userRoles.get(id) === "admin" || p.username === "admin",
        isOnline: true,
        status: p.status || "online",
      });
    }
    for (const row of (activeRes.data || []).map(enrich)) {
      const existing = byId.get(row.id);
      if (existing) {
        byId.set(row.id, {
          ...row,
          ...existing,
          display_name: row.display_name || existing.display_name,
          displayName: row.displayName || existing.displayName,
          avatar_url: row.avatar_url || existing.avatar_url,
          created_at: row.created_at || existing.created_at,
          last_seen: existing.last_seen || row.last_seen,
          isOnline: true,
        });
      } else {
        byId.set(row.id, row);
      }
    }

    const recentlyActive = [...byId.values()].sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return tb - ta;
    }).slice(0, limit);

    res.json({
      newlyJoined,
      recentlyActive,
      onlineCount: state.presence.size,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load member pulse." });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "User not found." });

    const p = state.presence.get(data.id);
    res.json({
      user: data,
      presence: p
        ? { status: p.status, socketId: p.socketId }
        : { status: "offline", socketId: null },
      banned: state.bannedUserIds.has(data.id),
      role: state.userRoles.get(data.id) || "user",
      friends: state.friends.get(data.id) ? [...state.friends.get(data.id)] : [],
      lastLoginAt: state.userLastLoginAt.get(data.id) || null,
      onlineMsTotal: state.userOnlineAccumMs.get(data.id) || 0,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load user." });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "username and password required." });
    }
    const clean = username.trim();
    if (clean.length < 2) return res.status(400).json({ error: "Invalid username." });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { data, error } = await supabase
      .from("users")
      .insert({ username: clean, password_hash: hash })
      .select("id, username")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    audit(req.user, "user_create", data.id, { username: data.username });
    notifyAdminRoom(getIo(req), { type: "user_created", id: data.id });
    res.status(201).json({ user: data });
  } catch (e) {
    res.status(500).json({ error: "Create failed." });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const { role } = req.body || {};
    if (role && ["user", "mod", "admin"].includes(role)) {
      state.userRoles.set(req.params.id, role);
      // Persist admin flag to DB — in-memory role alone does not grant AdminPanel access
      if (role === "admin" || role === "user") {
        const { error } = await supabase
          .from("users")
          .update({ is_admin: role === "admin" })
          .eq("id", req.params.id);
        if (error) return res.status(500).json({ error: error.message });
        const io = getIo(req);
        io?.to(`user:${req.params.id}`)?.emit("user:updated", { is_admin: role === "admin" });
      }
      audit(req.user, "user_role", req.params.id, { role });
    }
    notifyAdminRoom(getIo(req), { type: "user_patch", id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Patch failed." });
  }
});

// Durable make/remove admin — used by AdminPanel Users tab
router.put("/make-admin/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });
    const { data, error } = await supabase
      .from("users")
      .update({ is_admin: true })
      .eq("id", userId)
      .select("id, username, avatar_url, is_admin")
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    state.userRoles.set(userId, "admin");
    audit(req.user, "make_admin", userId, {});
    const io = getIo(req);
    io?.to(`user:${userId}`)?.emit("user:updated", { is_admin: true });
    notifyAdminRoom(io, { type: "user_admin", id: userId, is_admin: true });
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/remove-admin/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, error: "Cannot remove your own admin." });
    }
    const { data, error } = await supabase
      .from("users")
      .update({ is_admin: false })
      .eq("id", userId)
      .select("id, username, avatar_url, is_admin")
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    state.userRoles.set(userId, "user");
    audit(req.user, "remove_admin", userId, {});
    const io = getIo(req);
    io?.to(`user:${userId}`)?.emit("user:updated", { is_admin: false });
    notifyAdminRoom(io, { type: "user_admin", id: userId, is_admin: false });
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself." });
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    cleanupUserMemory(id);
    state.bannedUserIds.delete(id);
    audit(req.user, "user_delete", id, {});
    notifyAdminRoom(getIo(req), { type: "user_deleted", id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed." });
  }
});

router.post("/users/:id/ban", async (req, res) => {
  const id = req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: "Cannot ban yourself." });
  const { error } = await supabase.from("users").update({ is_banned: true }).eq("id", id);
  if (error) console.warn("[ban] DB update failed (is_banned column may be missing):", error.message);
  state.bannedUserIds.add(id);
  kickUser(getIo(req), {
    actorId: req.user.id,
    actorUsername: req.user.username,
    targetUserId: id,
    reason: req.body?.reason || "Banned",
  });
  audit(req.user, "ban", id, { reason: req.body?.reason });
  notifyAdminRoom(getIo(req), { type: "ban", userId: id });
  res.json({ ok: true });
});

router.post("/users/:id/unban", async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from("users").update({ is_banned: false }).eq("id", id);
  if (error) console.warn("[unban] DB update failed:", error.message);
  state.bannedUserIds.delete(id);
  audit(req.user, "unban", id, {});
  notifyAdminRoom(getIo(req), { type: "unban", userId: req.params.id });
  res.json({ ok: true });
});

router.post("/users/:id/kick", (req, res) => {
  kickUser(getIo(req), {
    actorId: req.user.id,
    actorUsername: req.user.username,
    targetUserId: req.params.id,
    reason: req.body?.reason || "Kicked",
  });
  res.json({ ok: true });
});

router.patch("/users/:id/status", (req, res) => {
  const { status } = req.body || {};
  const allowed = ["online", "idle", "dnd", "invisible"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  const p = state.presence.get(req.params.id);
  if (p) {
    p.status = status;
    state.presence.set(req.params.id, p);
    getIo(req).emit("users:update", [...state.presence].map(([id, x]) => ({ id, username: x.username, status: x.status })));
  }
  audit(req.user, "force_status", req.params.id, { status });
  res.json({ ok: true });
});

router.post("/users/bulk", async (req, res) => {
  const { userIds, action } = req.body || {};
  if (!Array.isArray(userIds)) return res.status(400).json({ error: "userIds array required." });
  const io = getIo(req);
  let n = 0;
  for (const id of userIds) {
    if (typeof id !== "string" || id === req.user.id) continue;
    if (action === "ban") {
      await supabase.from("users").update({ is_banned: true }).eq("id", id);
      state.bannedUserIds.add(id);
      kickUser(io, { actorId: req.user.id, actorUsername: req.user.username, targetUserId: id, reason: "Bulk ban" });
      n++;
    } else if (action === "unban") {
      await supabase.from("users").update({ is_banned: false }).eq("id", id);
      state.bannedUserIds.delete(id);
      n++;
    } else if (action === "kick") {
      kickUser(io, { actorId: req.user.id, actorUsername: req.user.username, targetUserId: id, reason: "Bulk kick" });
      n++;
    }
  }
  audit(req.user, "bulk", action, { count: n });
  res.json({ ok: true, affected: n });
});

router.get("/users/:id/activity", (req, res) => {
  const id = req.params.id;
  const tail = state.auditLog.filter((e) => e.target === id || e.actorId === id).slice(0, 100);
  res.json({
    lastLoginAt: state.userLastLoginAt.get(id) || null,
    onlineMsTotal: state.userOnlineAccumMs.get(id) || 0,
    sessionStartMs: state.userSessionStartMs.get(id) || null,
    audit: tail,
  });
});

router.get("/messages", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const userId = req.query.userId;
  const messages = state.generalMessages || [];
  let list = [...messages];
  if (userId) list = list.filter((m) => m.userId === userId);
  if (q) list = list.filter((m) => (m.text || "").toLowerCase().includes(q));
  const limit = Math.min(500, parseInt(req.query.limit || "200", 10) || 200);
  res.json({ messages: list.slice(-limit), total: list.length });
});

router.delete("/messages/:msgId", (req, res) => {
  const messages = state.generalMessages || [];
  const idx = messages.findIndex((m) => m.id === req.params.msgId);
  if (idx < 0) return res.status(404).json({ error: "Not found." });
  messages.splice(idx, 1);
  getIo(req).emit("message:deleted", { msgId: req.params.msgId });
  audit(req.user, "message_delete", req.params.msgId, {});
  notifyAdminRoom(getIo(req), { type: "message_delete", msgId: req.params.msgId });
  res.json({ ok: true });
});

router.patch("/messages/:msgId", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text required." });
  const m = state.generalMessages.find((x) => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ error: "Not found." });
  m.text = text;
  m.edited = true;
  m.editedAt = new Date().toISOString();
  m.adminEdit = true;
  getIo(req).emit("message:updated", {
    msgId: m.id,
    text: m.text,
    edited: true,
    editedAt: m.editedAt,
  });
  audit(req.user, "message_edit", m.id, {});
  res.json({ ok: true, message: m });
});

router.delete("/messages/user/:userId", (req, res) => {
  const uid = req.params.userId;
  const before = state.generalMessages.length;
  const next = state.generalMessages.filter((m) => m.userId !== uid);
  state.generalMessages.length = 0;
  state.generalMessages.push(...next);
  getIo(req).emit("admin:user_messages_removed", { userId: uid });
  audit(req.user, "purge_user_messages", uid, { removed: before - next.length });
  res.json({ ok: true, removed: before - next.length });
});

router.delete("/messages/:msgId/reactions", (req, res) => {
  const m = state.generalMessages.find((x) => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ error: "Not found." });
  m.reactions = {};
  getIo(req).emit("message:reaction:update", { msgId: m.id, reactions: {} });
  audit(req.user, "reactions_clear", m.id, {});
  res.json({ ok: true });
});

router.post("/messages/:msgId/flag", (req, res) => {
  const m = state.generalMessages.find((x) => x.id === req.params.msgId);
  if (!m) return res.status(404).json({ error: "Not found." });
  state.flaggedMessages.push({
    msgId: m.id,
    userId: m.userId,
    at: new Date().toISOString(),
    reason: req.body?.reason || "flag",
  });
  audit(req.user, "message_flag", m.id, {});
  res.json({ ok: true });
});

router.get("/export/messages", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(state.generalMessages, null, 2));
});

router.get("/dm/conversations", (_req, res) => {
  const out = [];
  for (const [key, arr] of state.dmHistory) {
    const last = arr.length ? arr[arr.length - 1] : null;
    out.push({ key, messageCount: arr.length, last });
  }
  res.json({ conversations: out });
});

router.get("/dm/export", (_req, res) => {
  const out = {};
  for (const [k, v] of state.dmHistory) out[k] = v;
  res.json(out);
});

router.get("/dm/:key", (req, res) => {
  const arr = state.dmHistory.get(req.params.key) || [];
  res.json({ messages: arr });
});

router.delete("/dm/:key", (req, res) => {
  state.dmHistory.delete(req.params.key);
  audit(req.user, "dm_conv_delete", req.params.key, {});
  res.json({ ok: true });
});

router.delete("/dm/:key/messages/:msgId", (req, res) => {
  const arr = state.dmHistory.get(req.params.key);
  if (!arr) return res.status(404).json({ error: "Not found." });
  const next = arr.filter((m) => m.id !== req.params.msgId);
  state.dmHistory.set(req.params.key, next);
  audit(req.user, "dm_msg_delete", req.params.msgId, {});
  res.json({ ok: true });
});

router.post("/dm/block", (req, res) => {
  const { userIdA, userIdB } = req.body || {};
  if (typeof userIdA !== "string" || typeof userIdB !== "string") {
    return res.status(400).json({ error: "userIdA and userIdB required." });
  }
  const key = [userIdA, userIdB].sort().join("::");
  state.dmBlockPairs.add(key);
  audit(req.user, "dm_block", key, {});
  res.json({ ok: true });
});

router.post("/dm/unblock", (req, res) => {
  const { userIdA, userIdB } = req.body || {};
  const key = [userIdA, userIdB].sort().join("::");
  state.dmBlockPairs.delete(key);
  res.json({ ok: true });
});

router.get("/friends/graph", (_req, res) => {
  const edges = [];
  for (const [uid, set] of state.friends) {
    for (const fid of set || []) {
      edges.push({ a: uid, b: fid });
    }
  }
  res.json({ edges, pending: [...state.pendingRequests.entries()].map(([uid, m]) => ({ uid, pending: [...m.keys()] })) });
});

router.get("/system", (_req, res) => {
  res.json({
    config: state.systemConfig,
    profanityCount: state.profanityWords.size,
    flaggedCount: state.flaggedMessages.length,
    bannedUserIds: [...state.bannedUserIds],
  });
});

router.patch("/system", (req, res) => {
  Object.assign(state.systemConfig, req.body || {});
  audit(req.user, "system_config", "config", req.body || {});
  notifyAdminRoom(getIo(req), { type: "system_config" });
  res.json({ config: state.systemConfig });
});

router.post("/chat/freeze", (req, res) => {
  state.systemConfig.chatFrozen = !!req.body?.frozen;
  audit(req.user, "chat_freeze", String(state.systemConfig.chatFrozen), {});
  notifyAdminRoom(getIo(req), { type: "chat_freeze", frozen: state.systemConfig.chatFrozen });
  res.json({ chatFrozen: state.systemConfig.chatFrozen });
});

router.post("/chat/slowmode", (req, res) => {
  const s = Math.max(0, parseInt(req.body?.seconds || "0", 10) || 0);
  state.systemConfig.slowModeSeconds = s;
  audit(req.user, "slowmode", String(s), {});
  res.json({ slowModeSeconds: s });
});

router.post("/maintenance", (req, res) => {
  state.systemConfig.maintenanceMode = !!req.body?.enabled;
  audit(req.user, "maintenance", String(state.systemConfig.maintenanceMode), {});
  res.json({ maintenanceMode: state.systemConfig.maintenanceMode });
});

router.post("/profanity", (req, res) => {
  const w = String(req.body?.word || "").trim();
  if (!w) return res.status(400).json({ error: "word required." });
  state.profanityWords.add(w);
  audit(req.user, "profanity_add", w, {});
  res.json({ ok: true, count: state.profanityWords.size });
});

router.delete("/profanity/:word", (req, res) => {
  state.profanityWords.delete(req.params.word);
  res.json({ ok: true });
});

router.post("/broadcast", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text required." });
  getIo(req).emit("server:announcement", {
    text,
    at: new Date().toISOString(),
    from: "admin",
  });
  audit(req.user, "broadcast", "all", { len: text.length });
  res.json({ ok: true });
});

router.post("/sockets/kick-all", (req, res) => {
  disconnectAll(getIo(req), req.user.id, req.user.username);
  res.json({ ok: true });
});

router.post("/sockets/kick/:userId", (req, res) => {
  kickUser(getIo(req), {
    actorId: req.user.id,
    actorUsername: req.user.username,
    targetUserId: req.params.userId,
    reason: req.body?.reason || "Kicked by admin",
  });
  res.json({ ok: true });
});

router.get("/sockets", (_req, res) => {
  const list = [];
  for (const [userId, p] of state.presence) {
    list.push({ userId, username: p.username, socketId: p.socketId, status: p.status });
  }
  res.json({ sockets: list });
});

router.get("/audit", (req, res) => {
  const limit = Math.min(500, parseInt(req.query.limit || "200", 10) || 200);
  res.json({ entries: state.auditLog.slice(0, limit) });
});

// POST /errors - Receive frontend error logs
router.post("/errors", (req, res) => {
  try {
    const errorData = req.body;
    
    if (!errorData || typeof errorData !== 'object') {
      return res.status(400).json({ error: "Invalid error data" });
    }
    
    // Create error log entry
    const logEntry = {
      id: `frontend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: errorData.timestamp || new Date().toISOString(),
      message: errorData.message || errorData.name || "Unknown error",
      stack: errorData.stack || "",
      componentStack: errorData.componentStack || "",
      source: errorData.source || "frontend",
      severity: errorData.severity || "error",
      userId: errorData.userId || req.user?.id || null,
      username: errorData.username || req.user?.username || null,
      url: errorData.url || req.headers.referer || null,
      userAgent: errorData.userAgent || req.headers["user-agent"],
      platform: errorData.platform || null,
      category: errorData.category || "UNKNOWN_ERROR",
    };
    
    // Add to server error log
    if (!state.serverErrorLog) state.serverErrorLog = [];
    state.serverErrorLog.unshift(logEntry);
    
    // Keep only last 1000 errors
    if (state.serverErrorLog.length > 1000) {
      state.serverErrorLog = state.serverErrorLog.slice(0, 1000);
    }
    
    console.log("[Admin] Frontend error logged:", logEntry.message);
    res.json({ ok: true, id: logEntry.id });
  } catch (e) {
    console.error("[Admin] Failed to log frontend error:", e);
    res.status(500).json({ error: "Failed to log error" });
  }
});

router.get("/errors", (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit || "200", 10) || 200);
    const userId = req.query.userId;
    const source = req.query.source;
    const search = String(req.query.search || "").trim().toLowerCase();
    
    let errors = [...(state.serverErrorLog || [])];
    
    // Filter by userId if provided
    if (userId) {
      errors = errors.filter((e) => e.userId === userId);
    }
    
    // Filter by source if provided
    if (source) {
      errors = errors.filter((e) => e.source === source);
    }
    
    // Search in message if provided
    if (search) {
      errors = errors.filter((e) => 
        (e.message || "").toLowerCase().includes(search) ||
        (e.source || "").toLowerCase().includes(search) ||
        (e.username || "").toLowerCase().includes(search)
      );
    }
    
    // Get unique sources for filtering
    const sources = [...new Set(state.serverErrorLog.map((e) => e.source).filter(Boolean))];
    
    // Get unique users with errors for filtering
    const usersWithErrors = [...new Set(state.serverErrorLog.map((e) => e.userId).filter(Boolean))];
    
    res.json({ 
      errors: errors.slice(0, limit),
      total: errors.length,
      sources,
      usersWithErrors,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load errors." });
  }
});

router.post("/cleanup", (_req, res) => {
  const before = state.auditLog.length;
  state.auditLog.length = Math.min(state.auditLog.length, 1000);
  res.json({ trimmed: before - state.auditLog.length });
});

router.post("/backup", (_req, res) => {
  const snapshot = {
    at: new Date().toISOString(),
    generalMessages: state.generalMessages,
    dmKeys: [...state.dmHistory.keys()],
    systemConfig: state.systemConfig,
    auditSample: state.auditLog.slice(0, 50),
  };
  res.json(snapshot);
});

router.post("/restart", (req, res) => {
  audit(req.user, "server_restart", "process", {});
  res.json({ ok: true, message: "Restarting." });
  setTimeout(() => process.exit(0), 250);
});

router.get("/permissions", (_req, res) => {
  res.json({
    roles: ["user", "mod", "admin"],
    matrix: {
      user: ["chat", "dm", "friends"],
      mod: ["chat", "dm", "friends", "moderate_messages"],
      admin: ["*"],
    },
  });
});

router.get("/snapshot", (req, res) => {
  const io = req.app.get("io");
  if (!io) return res.status(500).json({ error: "IO not ready." });
  res.json(buildSnapshot(io));
});

// ========== ENHANCED ERROR LOGGING ==========

// Get error logs with advanced filtering
router.get("/errors", (req, res) => {
  try {
    const { severity, source, user, timeRange, q, sort = "timestamp", order = "desc", limit = 500 } = req.query;
    
    let logs = state.errorLogs || [];
    
    // Filter by severity
    if (severity && severity !== "all") {
      logs = logs.filter(l => l.severity === severity);
    }
    
    // Filter by source
    if (source && source !== "all") {
      logs = logs.filter(l => l.source === source);
    }
    
    // Filter by user
    if (user && user !== "all") {
      logs = logs.filter(l => l.user?.id === user);
    }
    
    // Filter by time range
    if (timeRange && timeRange !== "all") {
      const ranges = { "1h": 3600000, "6h": 21600000, "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
      const cutoff = Date.now() - (ranges[timeRange] || 86400000);
      logs = logs.filter(l => new Date(l.timestamp).getTime() > cutoff);
    }
    
    // Search query
    if (q) {
      const qLower = q.toLowerCase();
      logs = logs.filter(l => 
        l.message?.toLowerCase().includes(qLower) ||
        l.source?.toLowerCase().includes(qLower) ||
        l.stack?.toLowerCase().includes(qLower)
      );
    }
    
    // Sort
    logs.sort((a, b) => {
      const aVal = sort === "timestamp" ? new Date(a.timestamp) : a[sort];
      const bVal = sort === "timestamp" ? new Date(b.timestamp) : b[sort];
      return order === "desc" ? (aVal > bVal ? -1 : 1) : (aVal > bVal ? 1 : -1);
    });
    
    // Get unique sources and users for filters
    const sources = [...new Set(logs.map(l => l.source))].filter(Boolean);
    const users = [...new Map(logs.filter(l => l.user).map(l => [l.user.id, l.user])).values()];
    
    // Calculate stats
    const bySeverity = {};
    logs.forEach(l => {
      bySeverity[l.severity] = (bySeverity[l.severity] || 0) + 1;
    });
    
    // Limit results
    const limitedLogs = logs.slice(0, parseInt(limit));
    
    res.json({
      errors: limitedLogs,
      total: logs.length,
      sources,
      users,
      stats: { bySeverity },
      archivedCount: state.archivedErrorLogs?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load error logs." });
  }
});

// Get error statistics
router.get("/errors/stats", (req, res) => {
  try {
    const logs = state.errorLogs || [];
    const bySeverity = {};
    const bySource = {};
    const byHour = {};
    const trends = {};
    
    logs.forEach(l => {
      bySeverity[l.severity] = (bySeverity[l.severity] || 0) + 1;
      bySource[l.source] = (bySource[l.source] || 0) + 1;
      
      const hour = new Date(l.timestamp).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    
    // Calculate trends (compare last hour vs previous hour)
    const now = Date.now();
    const lastHour = logs.filter(l => new Date(l.timestamp).getTime() > now - 3600000);
    const prevHour = logs.filter(l => {
      const t = new Date(l.timestamp).getTime();
      return t > now - 7200000 && t <= now - 3600000;
    });
    
    ["critical", "error", "warning"].forEach(sev => {
      const last = lastHour.filter(l => l.severity === sev).length;
      const prev = prevHour.filter(l => l.severity === sev).length;
      trends[sev] = prev === 0 ? 0 : Math.round(((last - prev) / prev) * 100);
    });
    
    res.json({
      total: logs.length,
      bySeverity,
      bySource,
      byHour,
      trends,
      last24h: logs.filter(l => new Date(l.timestamp).getTime() > now - 86400000).length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load error stats." });
  }
});

// Delete single error
router.delete("/errors/:id", (req, res) => {
  try {
    const { id } = req.params;
    state.errorLogs = (state.errorLogs || []).filter(l => l.id !== id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete error." });
  }
});

// Bulk delete errors
router.post("/errors/bulk-delete", (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid ids." });
    state.errorLogs = (state.errorLogs || []).filter(l => !ids.includes(l.id));
    res.json({ deleted: ids.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete errors." });
  }
});

// Archive old errors
router.post("/errors/archive", (req, res) => {
  try {
    const { days = 7 } = req.body;
    const cutoff = Date.now() - (days * 86400000);
    const toArchive = (state.errorLogs || []).filter(l => new Date(l.timestamp).getTime() < cutoff);
    state.archivedErrorLogs = [...(state.archivedErrorLogs || []), ...toArchive];
    state.errorLogs = (state.errorLogs || []).filter(l => new Date(l.timestamp).getTime() >= cutoff);
    res.json({ archived: toArchive.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to archive errors." });
  }
});

// ========== USER FEEDBACK SYSTEM ==========

// Get all feedback (Admin only - from Supabase)
router.get("/feedback", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { category, priority, status, q, sort = "newest" } = req.query;
    
    // Build query
    let query = supabase.from("user_feedback").select("*");
    
    // Apply filters
    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (q) {
      query = query.or(`message.ilike.%${q}%,username.ilike.%${q}%`);
    }
    
    // Sort
    if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "priority") query = query.order("priority", { ascending: true });
    
    const { data: feedbacks, error } = await query;
    
    if (error) throw error;
    
    // Calculate stats
    const byStatus = {};
    const byCategory = {};
    feedbacks?.forEach(f => {
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    });
    
    // Transform to match frontend format
    const transformed = feedbacks?.map(f => ({
      id: f.id,
      user: { id: f.user_id, username: f.username },
      category: f.category,
      priority: f.priority,
      message: f.message,
      attachments: f.attachments || [],
      status: f.status,
      viewed: f.viewed,
      created_at: f.created_at,
      updated_at: f.updated_at,
      replies: f.admin_replies || [],
    })) || [];
    
    res.json({
      feedbacks: transformed,
      total: transformed.length,
      stats: { byStatus, byCategory },
    });
  } catch (error) {
    console.error("[Admin] Failed to load feedback:", error);
    res.status(500).json({ error: "Failed to load feedback." });
  }
});

// Get feedback statistics (from Supabase)
router.get("/feedback/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: feedbacks, error } = await supabase
      .from("user_feedback")
      .select("status, category, priority, viewed");
    
    if (error) throw error;
    
    const byStatus = {};
    const byCategory = {};
    const byPriority = {};
    
    feedbacks?.forEach(f => {
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      byPriority[f.priority] = (byPriority[f.priority] || 0) + 1;
    });
    
    res.json({
      total: feedbacks?.length || 0,
      byStatus,
      byCategory,
      byPriority,
      new: feedbacks?.filter(f => f.status === "new" && !f.viewed).length || 0,
    });
  } catch (error) {
    console.error("[Admin] Failed to load feedback stats:", error);
    res.status(500).json({ error: "Failed to load feedback stats." });
  }
});

// Update feedback (in Supabase)
router.patch("/feedback/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from("user_feedback")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Feedback not found." });
    
    res.json(data);
  } catch (error) {
    console.error("[Admin] Failed to update feedback:", error);
    res.status(500).json({ error: "Failed to update feedback." });
  }
});

// Mark feedback as viewed (in Supabase)
router.post("/feedback/:id/view", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from("user_feedback")
      .update({ viewed: true, viewed_at: new Date().toISOString() })
      .eq("id", id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to mark feedback as viewed:", error);
    res.status(500).json({ error: "Failed to mark as viewed." });
  }
});

// Reply to feedback (in Supabase)
router.post("/feedback/:id/reply", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, attachments } = req.body;
    
    // Get current feedback
    const { data: feedback, error: getError } = await supabase
      .from("user_feedback")
      .select("admin_replies")
      .eq("id", id)
      .single();
    
    if (getError) throw getError;
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    
    const reply = {
      id: Math.random().toString(36).slice(2),
      text,
      attachments: attachments || [],
      isAdmin: true,
      adminId: req.user.id,
      adminUsername: req.user.username,
      created_at: new Date().toISOString(),
    };
    
    const replies = [...(feedback.admin_replies || []), reply];
    
    const { data, error } = await supabase
      .from("user_feedback")
      .update({ 
        admin_replies: replies,
        status: "in_progress",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json(reply);
  } catch (error) {
    console.error("[Admin] Failed to send reply:", error);
    res.status(500).json({ error: "Failed to send reply." });
  }
});

// Delete feedback (from Supabase)
router.delete("/feedback/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Admin] Failed to delete feedback:", error);
    res.status(500).json({ error: "Failed to delete feedback." });
  }
});

// ========== ADDITIONAL ADMIN ROUTES ==========

// Clear cache
router.post("/cache/clear", (req, res) => {
  try {
    // Clear various caches
    state.dmBlockPairs?.clear?.();
    state.rateLimitDm?.clear?.();
    state.userOnlineAccumMs?.clear?.();
    state.userSessionStartMs?.clear?.();
    
    res.json({ success: true, message: "Cache cleared successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear cache." });
  }
});

// Archive old logs
router.post("/logs/archive", (req, res) => {
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldLogs = (state.errorLogs || []).filter(l => new Date(l.timestamp).getTime() < thirtyDaysAgo);
    
    if (oldLogs.length > 0) {
      state.archivedErrorLogs = [...(state.archivedErrorLogs || []), ...oldLogs];
      state.errorLogs = (state.errorLogs || []).filter(l => new Date(l.timestamp).getTime() >= thirtyDaysAgo);
    }
    
    res.json({ 
      success: true, 
      archived: oldLogs.length,
      message: `${oldLogs.length} logs archived successfully` 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to archive logs." });
  }
});

// Bulk delete error logs
router.post("/errors/bulk-delete", (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided." });
    }
    
    const beforeCount = state.errorLogs?.length || 0;
    state.errorLogs = (state.errorLogs || []).filter(l => !ids.includes(l.id));
    const deleted = beforeCount - state.errorLogs.length;
    
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete logs." });
  }
});

// Bulk archive error logs
router.post("/errors/bulk-archive", (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided." });
    }
    
    const toArchive = (state.errorLogs || []).filter(l => ids.includes(l.id));
    if (toArchive.length > 0) {
      state.archivedErrorLogs = [...(state.archivedErrorLogs || []), ...toArchive];
      state.errorLogs = (state.errorLogs || []).filter(l => !ids.includes(l.id));
    }
    
    res.json({ success: true, archived: toArchive.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to archive logs." });
  }
});

// Export error logs
router.get("/errors/export", (req, res) => {
  try {
    const { format = "json" } = req.query;
    const logs = state.errorLogs || [];
    
    if (format === "csv") {
      const headers = ["id", "timestamp", "severity", "source", "message", "userId", "username"].join(",");
      const rows = logs.map(l => [
        l.id,
        l.timestamp,
        l.severity,
        l.source,
        `"${(l.message || "").replace(/"/g, "\"")}"`,
        l.user?.id || "",
        l.user?.username || ""
      ].join(","));
      
      const csv = [headers, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=error-logs.csv");
      res.send(csv);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=error-logs.json");
      res.json(logs);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to export logs." });
  }
});

// ==========================================
// CASINO / CREDITS MANAGEMENT API
// ==========================================

// Get all user credits with usernames
router.get("/credits", async (req, res) => {
  try {
    const { data: credits, error: creditsError } = await supabase
      .from("user_credits")
      .select("user_id, credits, total_won, total_lost, games_played, updated_at")
      .order("credits", { ascending: false });

    if (creditsError) throw creditsError;

    // Get usernames for all users
    const userIds = credits?.map(c => c.user_id) || [];
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username")
      .in("id", userIds);

    if (usersError) throw usersError;

    const userMap = new Map(users?.map(u => [u.id, u.username]) || []);

    const enrichedCredits = credits?.map(c => ({
      ...c,
      username: userMap.get(c.user_id) || "Unknown"
    })) || [];

    res.json({ users: enrichedCredits });
  } catch (error) {
    console.error("[Admin] Error fetching credits:", error);
    res.status(500).json({ error: "Failed to fetch credits." });
  }
});

// Get credits statistics
router.get("/credits/stats", async (req, res) => {
  try {
    const { data: credits, error } = await supabase
      .from("user_credits")
      .select("credits, games_played");

    if (error) throw error;

    const stats = {
      totalCredits: credits?.reduce((sum, c) => sum + (c.credits || 0), 0) || 0,
      totalPlayers: credits?.length || 0,
      totalGames: credits?.reduce((sum, c) => sum + (c.games_played || 0), 0) || 0,
      avgCredits: credits?.length > 0 
        ? Math.round(credits.reduce((sum, c) => sum + (c.credits || 0), 0) / credits.length) 
        : 0
    };

    res.json(stats);
  } catch (error) {
    console.error("[Admin] Error fetching credit stats:", error);
    res.status(500).json({ error: "Failed to fetch credit stats." });
  }
});

// Get game history
router.get("/credits/history", async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit || "100", 10) || 100);
    
    const { data: games, error } = await supabase
      .from("game_history")
      .select("user_id, bet_amount, result, win_amount, played_at")
      .order("played_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Get usernames
    const userIds = [...new Set(games?.map(g => g.user_id) || [])];
    const { data: users } = await supabase
      .from("users")
      .select("id, username")
      .in("id", userIds);

    const userMap = new Map(users?.map(u => [u.id, u.username]) || []);

    const enrichedGames = games?.map(g => ({
      ...g,
      username: userMap.get(g.user_id) || "Unknown"
    })) || [];

    res.json({ history: enrichedGames, games: enrichedGames });
  } catch (error) {
    console.error("[Admin] Error fetching game history:", error);
    res.status(500).json({ error: "Failed to fetch game history." });
  }
});

// Update user credits (add/remove)
router.post("/credits/update", async (req, res) => {
  try {
    const { userId, amount, operation, reason } = req.body;

    if (!userId || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid userId or amount." });
    }

    if (!["add", "remove"].includes(operation)) {
      return res.status(400).json({ error: "Operation must be 'add' or 'remove'." });
    }

    // Get current credits
    const { data: current, error: fetchError } = await supabase
      .from("user_credits")
      .select("credits, total_won, total_lost")
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw fetchError;
    }

    const currentCredits = current?.credits || 0;
    const newCredits = operation === "add" 
      ? currentCredits + amount 
      : Math.max(0, currentCredits - amount);

    // Update credits
    const { error: updateError } = await supabase
      .from("user_credits")
      .upsert({
        user_id: userId,
        credits: newCredits,
        updated_at: new Date().toISOString()
      });

    if (updateError) throw updateError;

    // Audit log
    audit(req.user, "credits_update", userId, { 
      operation, 
      amount, 
      previousBalance: currentCredits, 
      newBalance: newCredits,
      reason: reason || "Admin adjustment"
    });

    res.json({ 
      success: true, 
      userId, 
      previousBalance: currentCredits, 
      newBalance: newCredits,
      operation,
      amount
    });
  } catch (error) {
    console.error("[Admin] Error updating credits:", error);
    res.status(500).json({ error: "Failed to update credits." });
  }
});

// ============================================================================
// SHOP — catalog management + gifting cosmetics to users
// ============================================================================

const shop = require("../lib/shop");
const descoin = require("../lib/descoin");

// List every item (including inactive) for the admin catalog editor.
router.get("/shop/items", async (_req, res) => {
  try {
    const items = await shop.listAllItems();
    res.json({ items });
  } catch (err) {
    console.error("[Admin] shop items error:", err.message);
    res.status(500).json({ error: "Failed to load shop items." });
  }
});

const SHOP_CATEGORIES = [
  "banner",
  "avatar_frame",
  "profile_background",
  "theme",
  "profile_badge",
  "profile_title",
  "name_effect",
  "avatar_effect",
  "chat_bubble",
  "presence_flare",
  "profile_aura",
  "sound_pack",
  "typing_flare",
  "reaction_burst",
  "call_overlay",
];

// Categories that render from a small piece of metadata rather than an
// image/SVG asset — createItem/updateItem still write a placeholder
// asset_url for these (never rendered) to satisfy the NOT NULL column.
const METADATA_ONLY_CATEGORIES = new Set([
  "profile_badge",
  "profile_title",
  "name_effect",
  "avatar_effect",
  "chat_bubble",
  "presence_flare",
  "profile_aura",
  "sound_pack",
  "typing_flare",
  "reaction_burst",
  "call_overlay",
]);
const EFFECT_KEY_CATEGORIES = new Set([
  "name_effect",
  "avatar_effect",
  "chat_bubble",
  "presence_flare",
  "profile_aura",
  "sound_pack",
  "typing_flare",
  "reaction_burst",
  "call_overlay",
]);

router.post("/shop/items", async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      category,
      assetUrl,
      previewUrl,
      priceDescoin,
      themeKey,
      badgeIcon,
      titleText,
      effectKey,
      rarity,
      sortOrder,
    } = req.body || {};
    if (!sku || !name || !category || priceDescoin == null) {
      return res.status(400).json({ error: "sku, name, category, and priceDescoin are required." });
    }
    if (!SHOP_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Invalid category." });
    }
    if (!METADATA_ONLY_CATEGORIES.has(category) && !assetUrl) {
      return res.status(400).json({ error: "assetUrl is required for this category." });
    }
    if (category === "theme" && !themeKey) {
      return res.status(400).json({ error: "themeKey is required for theme items." });
    }
    if (category === "profile_badge" && !badgeIcon) {
      return res.status(400).json({ error: "badgeIcon is required for profile_badge items." });
    }
    if (category === "profile_title" && !titleText) {
      return res.status(400).json({ error: "titleText is required for profile_title items." });
    }
    if (EFFECT_KEY_CATEGORIES.has(category) && !effectKey) {
      return res.status(400).json({ error: "effectKey is required for this category." });
    }
    const item = await shop.createItem({
      sku,
      name,
      description: description || null,
      category,
      asset_url: assetUrl || "data:,",
      preview_url: previewUrl || assetUrl || null,
      price_descoin: Math.max(0, Math.round(Number(priceDescoin))),
      theme_key: category === "theme" ? themeKey : null,
      badge_icon: category === "profile_badge" ? badgeIcon : null,
      title_text: category === "profile_title" ? titleText : null,
      effect_key: EFFECT_KEY_CATEGORIES.has(category) ? effectKey : null,
      rarity: rarity || "common",
      sort_order: Number(sortOrder) || 0,
    });
    audit(req.user, "shop_item_create", item.id, { sku });
    res.json({ item });
  } catch (err) {
    console.error("[Admin] create shop item error:", err.message);
    res.status(500).json({ error: "Failed to create shop item." });
  }
});

router.patch("/shop/items/:id", async (req, res) => {
  try {
    const {
      name,
      description,
      active,
      priceDescoin,
      previewUrl,
      assetUrl,
      sortOrder,
      rarity,
      themeKey,
      badgeIcon,
      titleText,
      effectKey,
    } = req.body || {};
    const fields = {};
    if (name != null) fields.name = name;
    if (description !== undefined) fields.description = description;
    if (active != null) fields.active = Boolean(active);
    if (priceDescoin != null) fields.price_descoin = Math.max(0, Math.round(Number(priceDescoin)));
    if (previewUrl !== undefined) fields.preview_url = previewUrl;
    if (assetUrl != null) fields.asset_url = assetUrl;
    if (sortOrder != null) fields.sort_order = Number(sortOrder);
    if (rarity != null) fields.rarity = rarity;
    if (themeKey !== undefined) fields.theme_key = themeKey || null;
    if (badgeIcon !== undefined) fields.badge_icon = badgeIcon || null;
    if (titleText !== undefined) fields.title_text = titleText || null;
    if (effectKey !== undefined) fields.effect_key = effectKey || null;
    const item = await shop.updateItem(req.params.id, fields);
    if (!item) return res.status(404).json({ error: "Item not found." });
    audit(req.user, "shop_item_update", item.id, fields);
    res.json({ item });
  } catch (err) {
    console.error("[Admin] update shop item error:", err.message);
    res.status(500).json({ error: "Failed to update shop item." });
  }
});

// Directly credit or debit a user's DesCoin balance (support / compensation).
// A positive grant can carry an optional `message`, in which case it behaves
// just like gifting an item: the recipient gets a real-time celebratory
// popup naming the admin and showing their note (delivered on next connect
// if they're offline right now), not just a silent balance bump.
router.post("/descoin/grant", async (req, res) => {
  try {
    const { userId, amount, reason, message } = req.body || {};
    const parsedAmount = Math.round(Number(amount));
    if (!userId || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({ error: "userId and a non-zero amount are required." });
    }
    const cleanMessage = typeof message === "string" && message.trim() ? message.trim() : null;

    const result =
      parsedAmount > 0
        ? await descoin.credit(userId, parsedAmount, "admin_grant", { by: req.user.id, reason: reason || null }, cleanMessage)
        : await descoin.debit(userId, Math.abs(parsedAmount), "admin_revoke", { by: req.user.id, reason: reason || null });
    audit(req.user, "descoin_grant", userId, { amount: parsedAmount, reason: reason || null, message: cleanMessage });

    const io = getIo(req);
    io?.to(`user:${userId}`)?.emit("descoin:balance", {
      balance: result.balance,
      delta: parsedAmount,
      reason: parsedAmount > 0 ? "admin_grant" : "admin_revoke",
    });

    // Only claim the popup as delivered if the recipient has a live socket
    // right now — same online-check pattern as /shop/gift below — otherwise
    // socket/handlers.js delivers it on their next connect.
    if (cleanMessage && result.ledgerId) {
      const isOnline = Boolean(io?.sockets?.adapter?.rooms?.get(`user:${userId}`)?.size);
      if (io && isOnline) {
        io.to(`user:${userId}`).emit("descoin:gift", {
          amount: parsedAmount,
          message: cleanMessage,
          from: { id: req.user.id, username: req.user.username },
        });
        await descoin.markGrantsNotified([result.ledgerId]).catch(() => {});
      }
    }

    res.json({ success: true, balance: result.balance });
  } catch (err) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "User does not have enough DesCoin to revoke that amount." });
    }
    console.error("[Admin] descoin grant error:", err.message);
    res.status(500).json({ error: "Failed to update DesCoin balance." });
  }
});

// Gift an item to a user with an optional message. Grants it immediately
// (acquired_via = 'gift') and pushes a real-time popup notification.
router.post("/shop/gift", async (req, res) => {
  try {
    const { userId, itemId, message } = req.body || {};
    if (!userId || !itemId) {
      return res.status(400).json({ error: "userId and itemId are required." });
    }

    const item = await shop.getItemById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found." });

    const { data: targetUser } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle();
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    const inventoryRow = await shop.grantItem(userId, itemId, {
      acquiredVia: "gift",
      giftedBy: req.user.id,
      giftMessage: message || null,
    });

    audit(req.user, "shop_gift", userId, { itemId, sku: item.sku, message: message || null });

    const io = getIo(req);
    // Only claim the popup as "delivered" if the recipient actually has a
    // live socket connection right now — otherwise leave notified_at unset
    // so socket/handlers.js delivers it the moment they next connect,
    // instead of losing the popup silently.
    const isOnline = Boolean(io?.sockets?.adapter?.rooms?.get(`user:${userId}`)?.size);
    if (io && isOnline) {
      io.to(`user:${userId}`).emit("shop:gift:received", {
        item,
        message: message || null,
        from: { id: req.user.id, username: req.user.username },
      });
      if (inventoryRow?.id) {
        await shop.markGiftsNotified([inventoryRow.id]).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Admin] shop gift error:", err.message);
    res.status(500).json({ error: "Failed to gift item." });
  }
});

module.exports = router;

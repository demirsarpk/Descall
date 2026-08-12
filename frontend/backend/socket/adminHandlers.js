"use strict";

const state = require("../runtime/sharedState");

function getSocketForUser(io, userId) {
  const p = state.presence.get(userId);
  if (!p?.socketId) return null;
  return io.sockets.sockets.get(p.socketId);
}

function buildSnapshot(io) {
  const sockets = [];
  for (const [userId, p] of state.presence) {
    sockets.push({
      userId,
      username: p.username,
      status: p.status || "online",
      socketId: p.socketId,
    });
  }
  return {
    at: new Date().toISOString(),
    onlineCount: state.presence.size,
    maintenanceMode: state.systemConfig.maintenanceMode,
    sockets,
    bannedCount: state.bannedUserIds.size,
    auditTail: state.auditLog.slice(0, 30),
    errorsTail: state.serverErrorLog.slice(0, 20),
  };
}

function notifyAdminRoom(io, payload) {
  io.to("admin").emit("admin:update", payload);
}

function kickUser(io, { actorId, actorUsername, targetUserId, reason, action, category, message, expiresAt }) {
  const sock = getSocketForUser(io, targetUserId);
  if (sock) {
    sock.emit("system:kick", {
      reason: reason || "Removed by moderator",
      action: action || "kick",
      category: category || null,
      message: message || null,
      expiresAt: expiresAt || null,
    });
    sock.disconnect(true);
  }
  // Also notify via durable room in case of multi-tab
  try {
    io.to(`user:${targetUserId}`).emit("system:kick", {
      reason: reason || "Removed by moderator",
      action: action || "kick",
      category: category || null,
      message: message || null,
      expiresAt: expiresAt || null,
    });
  } catch {
    /* ignore */
  }
  state.appendAudit(actorId, actorUsername, action || "kick", targetUserId, { reason, category, message, expiresAt });
  notifyAdminRoom(io, { type: action || "kick", targetUserId, reason, category, message, expiresAt });
}

function disconnectAll(io, actorId, actorUsername) {
  for (const [, sock] of io.sockets.sockets) {
    try {
      sock.emit("system:maintenance", { message: "Server maintenance disconnect." });
      sock.disconnect(true);
    } catch {
      /* ignore */
    }
  }
  state.appendAudit(actorId, actorUsername, "disconnect_all", "all", {});
  notifyAdminRoom(io, { type: "disconnect_all" });
}

function setupAdminSocket(io, socket) {
  if (socket.user.username !== "admin") return;

  socket.join("admin");
  socket.emit("admin:sync", buildSnapshot(io));

  socket.on("admin:subscribe", () => {
    if (socket.user.username !== "admin") return;
    socket.join("admin");
    socket.emit("admin:sync", buildSnapshot(io));
  });

  socket.on("admin:refresh", () => {
    if (socket.user.username !== "admin") return;
    socket.emit("admin:sync", buildSnapshot(io));
  });

  socket.on("admin:kick_user", ({ userId, reason } = {}) => {
    if (socket.user.username !== "admin") return;
    if (typeof userId !== "string") return;
    kickUser(io, {
      actorId: socket.user.id,
      actorUsername: socket.user.username,
      targetUserId: userId,
      reason,
    });
    socket.emit("admin:sync", buildSnapshot(io));
  });

  socket.on("admin:broadcast", ({ text } = {}) => {
    if (socket.user.username !== "admin") return;
    const t = String(text || "").trim();
    if (!t) return;
    io.emit("server:announcement", {
      text: t,
      at: new Date().toISOString(),
      from: "admin",
    });
    state.appendAudit(socket.user.id, socket.user.username, "broadcast", "all", { length: t.length });
    notifyAdminRoom(io, { type: "broadcast", length: t.length });
  });

  socket.on("admin:ping", () => {
    if (socket.user.username !== "admin") return;
    socket.emit("admin:pong", { at: Date.now() });
  });
}

module.exports = {
  setupAdminSocket,
  notifyAdminRoom,
  buildSnapshot,
  kickUser,
  disconnectAll,
  getSocketForUser,
};

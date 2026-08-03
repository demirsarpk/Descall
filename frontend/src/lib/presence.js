/** Resolve Discord-style presence for a user id from the onlineUsers list. */
export function getPresenceStatus(onlineUsers, userId) {
  if (!userId || !Array.isArray(onlineUsers)) return "offline";
  const hit = onlineUsers.find((u) => u.id === userId);
  if (!hit) return "offline";
  const status = hit.status || "online";
  // Invisible users appear offline to everyone else
  if (status === "invisible") return "offline";
  // Remapped invisible→offline still means not visibly online
  if (status === "offline") return "offline";
  return status;
}

/** True only for statuses others should see as "here" (online / idle / dnd). */
export function isVisiblyOnline(onlineUsers, userId) {
  const status = getPresenceStatus(onlineUsers, userId);
  return status === "online" || status === "idle" || status === "dnd";
}

export const STATUS_META = {
  online: { label: "Online", color: "var(--success)" },
  idle: { label: "Idle", color: "var(--warning)" },
  dnd: { label: "Do Not Disturb", color: "var(--danger)" },
  invisible: { label: "Invisible", color: "var(--text-muted)" },
  offline: { label: "Offline", color: "var(--text-muted)" },
};

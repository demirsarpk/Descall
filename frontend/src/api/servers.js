import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

async function serversRequest(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code || null;
    err.body = data;
    throw err;
  }
  return data;
}

/** List servers the current user belongs to. */
export function getMyServers() {
  return serversRequest("/api/servers/my");
}

/** Create a server (max 10 owned). */
export function createServer({ name, iconUrl, description } = {}) {
  return serversRequest("/api/servers", {
    method: "POST",
    body: { name, iconUrl, description },
  });
}

export function getServer(serverId) {
  return serversRequest(`/api/servers/${serverId}`);
}

/** Owner delete — confirmName must match server name. */
export function deleteServer(serverId, confirmName) {
  return serversRequest(`/api/servers/${serverId}`, {
    method: "DELETE",
    body: { confirmName },
  });
}

/**
 * Leave server. If owner, deletes the server (confirmName required).
 */
export function leaveServer(serverId, confirmName) {
  return serversRequest(`/api/servers/${serverId}/leave`, {
    method: "POST",
    body: confirmName ? { confirmName } : {},
  });
}

export function getServerMembers(serverId) {
  return serversRequest(`/api/servers/${serverId}/members`);
}

/** Create text | voice | category channel (owner only for now). */
export function createChannel(serverId, { name, type = "text", parentId, topic, position } = {}) {
  return serversRequest(`/api/servers/${serverId}/channels`, {
    method: "POST",
    body: { name, type, parentId, topic, position },
  });
}

export function updateChannel(serverId, channelId, patch = {}) {
  return serversRequest(`/api/servers/${serverId}/channels/${channelId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteChannel(serverId, channelId) {
  return serversRequest(`/api/servers/${serverId}/channels/${channelId}`, {
    method: "DELETE",
  });
}

/** Channel permission overrides (role/member allow/deny). */
export function getChannelOverrides(serverId, channelId) {
  return serversRequest(`/api/servers/${serverId}/channels/${channelId}/overrides`);
}

export function putChannelOverride(serverId, channelId, { targetType, targetId, permissions }) {
  return serversRequest(`/api/servers/${serverId}/channels/${channelId}/overrides`, {
    method: "PUT",
    body: { targetType, targetId, permissions },
  });
}

export function deleteChannelOverride(serverId, channelId, targetType, targetId) {
  return serversRequest(
    `/api/servers/${serverId}/channels/${channelId}/overrides/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
    { method: "DELETE" }
  );
}

/** Text channel message history (membership-gated). */
export function getChannelMessages(serverId, channelId, { before, limit = 50 } = {}) {
  const q = new URLSearchParams();
  if (before) q.set("before", before);
  if (limit) q.set("limit", String(limit));
  const qs = q.toString();
  return serversRequest(
    `/api/servers/${serverId}/channels/${channelId}/messages${qs ? `?${qs}` : ""}`
  );
}

export function getServerRoles(serverId) {
  return serversRequest(`/api/servers/${serverId}/roles`);
}

export function createServerRole(serverId, payload = {}) {
  return serversRequest(`/api/servers/${serverId}/roles`, {
    method: "POST",
    body: payload,
  });
}

export function updateServerRole(serverId, roleId, patch = {}) {
  return serversRequest(`/api/servers/${serverId}/roles/${roleId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteServerRole(serverId, roleId) {
  return serversRequest(`/api/servers/${serverId}/roles/${roleId}`, {
    method: "DELETE",
  });
}

export function assignMemberRole(serverId, userId, roleId) {
  return serversRequest(`/api/servers/${serverId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
  });
}

export function removeMemberRole(serverId, userId, roleId) {
  return serversRequest(`/api/servers/${serverId}/members/${userId}/roles/${roleId}`, {
    method: "DELETE",
  });
}

export function updateMemberNickname(serverId, userId, nickname) {
  return serversRequest(`/api/servers/${serverId}/members/${userId}/nickname`, {
    method: "PATCH",
    body: { nickname },
  });
}

export function timeoutServerMember(serverId, userId, { until, durationSeconds, reason } = {}) {
  return serversRequest(`/api/servers/${serverId}/members/${userId}/timeout`, {
    method: "POST",
    body: { until, durationSeconds, reason },
  });
}

export function removeServerMemberTimeout(serverId, userId) {
  return serversRequest(`/api/servers/${serverId}/members/${userId}/timeout`, {
    method: "DELETE",
  });
}

/** Kick a member (KICK_MEMBERS). Cannot kick owner or yourself. */
export function kickServerMember(serverId, userId, reason) {
  return serversRequest(`/api/servers/${serverId}/members/${userId}`, {
    method: "DELETE",
    body: reason ? { reason } : {},
  });
}

/** Ban a member (BAN_MEMBERS). Removes membership and blocks rejoin. */
export function banServerMember(serverId, userId, reason) {
  return serversRequest(`/api/servers/${serverId}/bans/${userId}`, {
    method: "PUT",
    body: reason ? { reason } : {},
  });
}

export function unbanServerMember(serverId, userId) {
  return serversRequest(`/api/servers/${serverId}/bans/${userId}`, {
    method: "DELETE",
  });
}

export function listServerBans(serverId) {
  return serversRequest(`/api/servers/${serverId}/bans`);
}

export function getServerAuditLogs(serverId, { limit = 40 } = {}) {
  const q = new URLSearchParams();
  if (limit) q.set("limit", String(limit));
  const qs = q.toString();
  return serversRequest(`/api/servers/${serverId}/audit-logs${qs ? `?${qs}` : ""}`);
}

/** Create a shareable server invite (CREATE_INSTANT_INVITE). */
export function createServerInvite(serverId, { maxUses, maxAgeSeconds, channelId } = {}) {
  return serversRequest(`/api/servers/${serverId}/invites`, {
    method: "POST",
    body: { maxUses, maxAgeSeconds, channelId },
  });
}

export function listServerInvites(serverId) {
  return serversRequest(`/api/servers/${serverId}/invites`);
}

export function revokeServerInvite(serverId, code) {
  return serversRequest(`/api/servers/${serverId}/invites/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
}

export function previewServerInvite(code) {
  return serversRequest(`/api/servers/invites/${encodeURIComponent(code)}`);
}

export function joinServerByInvite(code) {
  return serversRequest(`/api/servers/invites/${encodeURIComponent(code)}/join`, {
    method: "POST",
    body: {},
  });
}

export function discoverPublicServers({ q, limit } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return serversRequest(`/api/servers/discover${qs ? `?${qs}` : ""}`);
}

export function joinPublicServer(serverId) {
  return serversRequest(`/api/servers/discover/${serverId}/join`, {
    method: "POST",
    body: {},
  });
}

export function updateServer(serverId, patch = {}) {
  return serversRequest(`/api/servers/${serverId}`, {
    method: "PATCH",
    body: patch,
  });
}

/** Per-server notification level: all | mentions | muted (Nothing). */
export function updateServerNotificationLevel(serverId, notificationLevel) {
  return serversRequest(`/api/servers/${serverId}/me/settings`, {
    method: "PATCH",
    body: { notificationLevel },
  });
}

/** Accept community rules / onboarding screen. */
export function acceptServerRules(serverId) {
  return serversRequest(`/api/servers/${serverId}/accept-rules`, {
    method: "POST",
    body: {},
  });
}

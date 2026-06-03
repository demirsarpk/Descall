import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

const BASE = `${API_BASE_URL}/guilds`;

function getHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getMyGuilds() {
  const res = await fetch(`${BASE}/my`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch guilds");
  return res.json();
}

export async function createGuild({ name, iconUrl }) {
  const res = await fetch(`${BASE}/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, iconUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to create guild");
  }
  return res.json();
}

export async function getGuild(guildId) {
  const res = await fetch(`${BASE}/${guildId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch guild");
  return res.json();
}

export async function deleteGuild(guildId) {
  const res = await fetch(`${BASE}/${guildId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete guild");
  return res.json();
}

export async function leaveGuild(guildId) {
  const res = await fetch(`${BASE}/${guildId}/leave`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to leave guild");
  return res.json();
}

export async function joinGuildByInvite(code) {
  const res = await fetch(`${API_BASE_URL}/guilds/invites/${code}/join`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to join guild");
  }
  return res.json();
}

export async function getGuildMembers(guildId) {
  const res = await fetch(`${BASE}/${guildId}/members`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch members");
  return res.json();
}

export async function getGuildInvites(guildId) {
  const res = await fetch(`${BASE}/${guildId}/invites`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch invites");
  return res.json();
}

export async function createGuildInvite(guildId, { maxUses, expiresInHours } = {}) {
  const res = await fetch(`${BASE}/${guildId}/invites`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ maxUses, expiresInHours }),
  });
  if (!res.ok) throw new Error("Failed to create invite");
  return res.json();
}

export async function revokeGuildInvite(guildId, code) {
  const res = await fetch(`${BASE}/${guildId}/invites/${code}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to revoke invite");
  return res.json();
}

export async function createGuildChannel(guildId, { name, type, parentId }) {
  const res = await fetch(`${BASE}/${guildId}/channels`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, type, parentId }),
  });
  if (!res.ok) throw new Error("Failed to create channel");
  return res.json();
}

export async function deleteGuildChannel(guildId, channelId) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete channel");
  return res.json();
}

export async function updateGuildChannel(guildId, channelId, updates) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update channel");
  return res.json();
}

// ─── Guild Messages ───

export async function getGuildMessages(guildId, channelId, { before, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  params.set("limit", String(limit));
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}/messages?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function sendGuildMessage(guildId, channelId, { content, mediaUrl, mediaType, replyTo }) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content, mediaUrl, mediaType, replyTo }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function editGuildMessage(guildId, channelId, messageId, content) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to edit message");
  return res.json();
}

export async function deleteGuildMessage(guildId, channelId, messageId) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete message");
  return res.json();
}

export async function addGuildReaction(guildId, channelId, messageId, emoji) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}/messages/${messageId}/reactions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error("Failed to add reaction");
  return res.json();
}

export async function removeGuildReaction(guildId, channelId, messageId, emoji) {
  const res = await fetch(
    `${BASE}/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    { method: "DELETE", headers: getHeaders() }
  );
  if (!res.ok) throw new Error("Failed to remove reaction");
  return res.json();
}

export async function markGuildChannelRead(guildId, channelId, lastMessageId) {
  const res = await fetch(`${BASE}/${guildId}/channels/${channelId}/read`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ lastMessageId }),
  });
  if (!res.ok) throw new Error("Failed to mark as read");
  return res.json();
}

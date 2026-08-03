import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

const BASE = `${API_BASE_URL}/groups`;

function getHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getMyGroups() {
  const res = await fetch(`${BASE}/my`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch groups");
  return res.json();
}

export async function createGroup({ name, memberIds }) {
  const res = await fetch(`${BASE}/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, memberIds }),
  });
  if (!res.ok) throw new Error("Failed to create group");
  return res.json();
}

export async function getGroupMessages(groupId, { before, limit = 50 } = {}) {
  const url = new URL(`${BASE}/${groupId}/messages`, window.location.origin);
  if (before) url.searchParams.set("before", before);
  url.searchParams.set("limit", limit);
  const res = await fetch(url.toString(), { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function sendGroupMessage(groupId, { content, mediaUrl, mediaType }) {
  const res = await fetch(`${BASE}/${groupId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content, mediaUrl, mediaType }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function getGroupMembers(groupId) {
  const res = await fetch(`${BASE}/${groupId}/members`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch members");
  return res.json();
}

export async function inviteToGroup(groupId, invitedUserId) {
  const value = typeof invitedUserId === "string" ? invitedUserId.trim() : invitedUserId;
  const res = await fetch(`${BASE}/${groupId}/invite`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      invitedUserId: value,
      invitedUsername: value,
      username: value,
    }),
  });
  if (!res.ok) throw new Error("Failed to invite");
  return res.json();
}

export async function respondToInvite(inviteId, accept) {
  const res = await fetch(`${BASE}/invites/${inviteId}/respond`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ accept }),
  });
  if (!res.ok) throw new Error("Failed to respond");
  return res.json();
}

export async function leaveGroup(groupId) {
  const res = await fetch(`${BASE}/${groupId}/leave`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to leave");
  return res.json();
}

export async function addMemberToGroup(groupId, userId) {
  const res = await fetch(`${BASE}/${groupId}/members`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ userId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Failed to add member");
  return body;
}

export async function renameGroup(groupId, newName) {
  const res = await fetch(`${BASE}/${groupId}/rename`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) throw new Error("Failed to rename");
  return res.json();
}

export async function createGroupInviteLink(groupId, { maxUses = null, expiresInHours = 24 * 7 } = {}) {
  const res = await fetch(`${BASE}/${groupId}/invite-links`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ maxUses, expiresInHours }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Failed to create invite link");
  return body;
}

export async function previewGroupInvite(code) {
  const res = await fetch(`${BASE}/invite-links/${encodeURIComponent(code)}`, {
    headers: getHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Invalid invite");
  return body;
}

export async function joinGroupByInvite(code) {
  const res = await fetch(`${BASE}/invite-links/${encodeURIComponent(code)}/join`, {
    method: "POST",
    headers: getHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Failed to join group");
  return body;
}

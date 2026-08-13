/**
 * Per-channel mute prefs for server text channels.
 * localStorage is the optimistic cache; API is source of truth on login/toggle.
 */

import { API_BASE_URL } from "../config/api";
import { getToken } from "./storage";

const KEY = "descall_muted_server_channels";

function readMap() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

async function apiRequest(path, { method = "GET", body } = {}) {
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
    throw err;
  }
  return data;
}

export function isChannelMuted(channelId) {
  if (!channelId) return false;
  return Boolean(readMap()[String(channelId)]);
}

export function setChannelMuted(channelId, muted) {
  if (!channelId) return false;
  const map = readMap();
  const id = String(channelId);
  if (muted) map[id] = true;
  else delete map[id];
  writeMap(map);
  return Boolean(muted);
}

export function toggleChannelMute(channelId) {
  const next = !isChannelMuted(channelId);
  setChannelMuted(channelId, next);
  return next;
}

export function getMutedChannelIds() {
  return Object.keys(readMap());
}

/** Pull muted channel ids from API and merge into localStorage cache. */
export async function syncChannelMutesFromServer() {
  const data = await apiRequest("/api/servers/me/channel-mutes");
  const ids = Array.isArray(data?.channelIds) ? data.channelIds : [];
  const map = {};
  for (const id of ids) {
    if (id) map[String(id)] = true;
  }
  writeMap(map);
  return ids.map(String);
}

/** Optimistic local update + API sync. */
export async function setChannelMutedAsync(channelId, serverId, muted) {
  if (!channelId || !serverId) {
    setChannelMuted(channelId, muted);
    return Boolean(muted);
  }
  const prev = isChannelMuted(channelId);
  setChannelMuted(channelId, muted);
  try {
    await apiRequest(`/api/servers/${serverId}/channels/${channelId}/mute`, {
      method: "PUT",
      body: { muted: Boolean(muted) },
    });
    return Boolean(muted);
  } catch (err) {
    setChannelMuted(channelId, prev);
    throw err;
  }
}

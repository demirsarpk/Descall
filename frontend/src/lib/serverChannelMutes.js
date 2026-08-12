/**
 * Local per-channel mute prefs for server text channels (Step 12 v1).
 * Stored in localStorage — no cross-device sync yet.
 */

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

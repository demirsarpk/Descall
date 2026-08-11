/**
 * Personal friend-invite attribution (viral loop).
 * URL: /register?ref=USERNAME  or  /?ref=USERNAME&auth=register
 */

const STORAGE_KEY = "descall:inviteRef";
const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,24}$/;

export function normalizeInviteRef(raw) {
  if (raw == null) return "";
  const value = String(raw).trim().replace(/^@/, "");
  if (!USERNAME_RE.test(value)) return "";
  return value;
}

export function readInviteRefFromLocation(search = typeof window !== "undefined" ? window.location.search : "") {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    return normalizeInviteRef(params.get("ref") || params.get("inviteBy") || "");
  } catch {
    return "";
  }
}

export function persistInviteRef(username) {
  const clean = normalizeInviteRef(username);
  if (!clean || typeof sessionStorage === "undefined") return "";
  try {
    sessionStorage.setItem(STORAGE_KEY, clean);
  } catch {
    /* ignore quota / private mode */
  }
  return clean;
}

export function consumeInviteRef() {
  if (typeof sessionStorage === "undefined") return "";
  try {
    const value = normalizeInviteRef(sessionStorage.getItem(STORAGE_KEY) || "");
    if (value) sessionStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    return "";
  }
}

export function peekInviteRef() {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return normalizeInviteRef(sessionStorage.getItem(STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

/** Public share URL for a user's personal invite. */
export function buildFriendInviteUrl(username, origin = typeof window !== "undefined" ? window.location.origin : "https://descall.com") {
  const clean = normalizeInviteRef(username);
  if (!clean) return `${origin.replace(/\/$/, "")}/register`;
  const base = String(origin || "https://descall.com").replace(/\/$/, "");
  return `${base}/register?ref=${encodeURIComponent(clean)}`;
}

/**
 * WebRTC ICE server configuration (STUN + optional TURN).
 * Preload on app start; hooks read synchronously via getIceServers().
 */

const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let cachedServers = null;
let preloadPromise = null;

function parseEnvIceServers() {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    console.warn("[iceConfig] Invalid VITE_ICE_SERVERS JSON");
    return null;
  }
}

function normalizeIceServers(list) {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_ICE_SERVERS;
  return list.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const urls = entry.urls;
    if (!urls) return entry;
    const out = { urls };
    if (entry.username) out.username = entry.username;
    if (entry.credential) out.credential = entry.credential;
    return out;
  });
}

export function getIceServers() {
  return cachedServers || DEFAULT_ICE_SERVERS;
}

export async function preloadIceServers() {
  if (cachedServers) return cachedServers;
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const fromEnv = parseEnvIceServers();
    if (fromEnv) {
      cachedServers = normalizeIceServers(fromEnv);
      return cachedServers;
    }

    const base =
      (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");

    try {
      const res = await fetch(`${base}/api/webrtc/ice-config`, {
        credentials: "omit",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
          cachedServers = normalizeIceServers(data.iceServers);
          return cachedServers;
        }
      }
    } catch {
      /* use defaults */
    }

    cachedServers = DEFAULT_ICE_SERVERS;
    return cachedServers;
  })();

  return preloadPromise;
}

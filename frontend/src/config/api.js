// API URL configuration
// Priority: env variable > window override > production fallback
const PRODUCTION_URL = "https://des-call.onrender.com";
// Retired hosts that must never be used (old Render service names)
const DEAD_API_HOSTS = ["descall-qzkg.onrender.com"];

function isDeadApiUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DEAD_API_HOSTS.some((dead) => host === dead || host.endsWith(`.${dead}`));
  } catch {
    return false;
  }
}

function resolveApiUrl() {
  // 1. Vite environment variable (build-time) - must be non-empty and alive
  const envUrl = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/$/, "");
    if (!isDeadApiUrl(trimmed)) return trimmed;
  }
  // 2. Runtime override (useful for Electron or dynamic config)
  if (typeof window !== "undefined" && window.__DESCALL_API_URL__) {
    const override = String(window.__DESCALL_API_URL__).trim().replace(/\/$/, "");
    if (override && !isDeadApiUrl(override)) return override;
  }
  // 3. Production fallback
  return PRODUCTION_URL;
}

export const API_BASE_URL = resolveApiUrl();

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  google: "/auth/google",
  googleConfig: "/auth/google/config",
  me: "/auth/me",
};

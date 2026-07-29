// API URL configuration
// Priority: env variable > window override > production fallback
const PRODUCTION_URL = "https://descall.onrender.com";

function resolveApiUrl() {
  // 1. Vite environment variable (build-time) - must be non-empty
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  // 2. Runtime override (useful for Electron or dynamic config)
  if (typeof window !== 'undefined' && window.__DESCALL_API_URL__) {
    return window.__DESCALL_API_URL__;
  }
  // 3. Production fallback
  return PRODUCTION_URL;
}

export const API_BASE_URL = resolveApiUrl();

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};

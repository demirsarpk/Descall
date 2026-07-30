import { API_BASE_URL } from "../config/api";

/**
 * Fetches latest desktop release via backend (avoids GitHub API CORS in browser).
 */
export async function fetchLatestDesktopRelease() {
  const base = (API_BASE_URL || "").replace(/\/$/, "") || window.location.origin;
  const res = await fetch(`${base}/api/app/latest-release`, {
    credentials: "omit",
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Release check failed (${res.status})`);
  }

  return data;
}

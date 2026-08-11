const STORAGE_KEY = "descall_call_history_v2";
const MAX = 80;

export function loadCachedCalls(userId) {
  if (!userId || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedCalls(userId, calls) {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify((calls || []).slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
}

export function upsertCachedCall(userId, call) {
  if (!userId || !call?.id) return loadCachedCalls(userId);
  const prev = loadCachedCalls(userId).filter((c) => c.id !== call.id);
  const next = [call, ...prev].slice(0, MAX);
  saveCachedCalls(userId, next);
  return next;
}

export function formatCallDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s <= 0) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function formatCallWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

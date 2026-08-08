// Temporary runtime telemetry for the active screen-share investigation.
export function logScreenShareDebug(hypothesisId, location, message, data = {}) {
  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
  fetch(`${apiBase}/debug/screen-share-runtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now() }),
  }).catch(() => {});
}

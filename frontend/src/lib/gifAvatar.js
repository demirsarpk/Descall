/**
 * Discord-like animated avatar helpers.
 * GIFs stay static by default; play on hover / speaking / always.
 */

const staticFrameCache = new Map();
const inflight = new Map();

export function stripUrlQuery(url) {
  if (!url || typeof url !== "string") return "";
  return url.split("?")[0].split("#")[0];
}

export function isAnimatedAvatarUrl(url) {
  if (!url || typeof url !== "string") return false;
  const path = stripUrlQuery(url).toLowerCase();
  return path.endsWith(".gif") || path.includes(".gif.");
}

function loadImage(url, { crossOrigin } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("avatar image load failed"));
    img.referrerPolicy = "no-referrer";
    img.src = url;
  });
}

/**
 * Capture the first frame of a GIF (or any image) as a PNG data URL.
 * Cached by bare URL. Returns null if CORS / decode fails.
 */
export async function getStaticAvatarFrame(url) {
  if (!url || typeof url !== "string") return null;
  const key = stripUrlQuery(url) || url;
  if (staticFrameCache.has(key)) return staticFrameCache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    try {
      let img;
      try {
        img = await loadImage(url, { crossOrigin: "anonymous" });
      } catch {
        // Retry without CORS so we at least know the image exists;
        // canvas export will fail if tainted — handled below.
        img = await loadImage(url);
      }

      const w = img.naturalWidth || img.width || 1;
      const h = img.naturalHeight || img.height || 1;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const dataUrl = canvas.toDataURL("image/png");
        staticFrameCache.set(key, dataUrl);
        return dataUrl;
      } catch {
        // Tainted canvas — cannot freeze GIF client-side.
        staticFrameCache.set(key, null);
        return null;
      }
    } catch {
      staticFrameCache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

export function clearStaticAvatarFrameCache() {
  staticFrameCache.clear();
  inflight.clear();
}

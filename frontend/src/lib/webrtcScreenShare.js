/**
 * Screen-share capture + RTP sender tuning for WebRTC mesh calls.
 * Group calls encode once per peer — keep resolution/bitrate/FPS conservative
 * so remote viewers stay smooth instead of stuttering at 1080p+.
 */

export const GROUP_SCREEN_DEFAULT_QUALITY = {
  resolution: "720p",
  fps: 20,
};

const RESOLUTION_MAP = {
  "480p": { width: 854, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  // Cap ultra modes — mesh P2P cannot sustain these smoothly
  "1440p": { width: 1280, height: 720 },
  "2160p": { width: 1280, height: 720 },
  custom: { width: 1280, height: 720 },
};

export function resolveScreenCaptureSize(quality = {}) {
  const key = quality.resolution || "720p";
  const size = RESOLUTION_MAP[key] || RESOLUTION_MAP["720p"];
  // Hard-cap FPS for group mesh; 60/120/240 destroys encode budget
  const fps = Math.min(Math.max(Number(quality.fps) || 20, 10), 24);
  return { ...size, fps };
}

export function screenBitrateForPeerCount(peerCount, resolution = "720p") {
  const n = Math.max(1, peerCount || 1);
  const base =
    resolution === "480p" ? 700_000 : resolution === "1080p" ? 1_800_000 : 1_200_000;
  if (n >= 5) return Math.min(base, 700_000);
  if (n >= 3) return Math.min(base, 1_000_000);
  return base;
}

/** Prefer readable UI at stable FPS over chasing resolution. */
export async function optimizeScreenShareTrack(track, { width, height, fps } = {}) {
  if (!track || track.kind !== "video") return;
  try {
    // detail = prioritize text/UI sharpness; pair with capped FPS/bitrate
    if ("contentHint" in track) track.contentHint = "detail";
  } catch {
    /* ignore */
  }
  try {
    await track.applyConstraints({
      width: { ideal: width, max: width },
      height: { ideal: height, max: height },
      frameRate: { ideal: fps, max: fps },
    });
  } catch {
    /* browser may reject some constraints after getDisplayMedia */
  }
}

export async function optimizeScreenShareSender(
  sender,
  { maxBitrate = 1_200_000, maxFramerate = 20 } = {}
) {
  if (!sender) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    const enc = params.encodings[0];
    enc.maxBitrate = maxBitrate;
    enc.maxFramerate = maxFramerate;
    // Keep FPS when congested — stuttery low FPS feels worse than softer pixels
    params.degradationPreference = "maintain-framerate";
    await sender.setParameters(params);
  } catch (err) {
    console.warn("[ScreenShare] setParameters failed:", err?.message || err);
  }
}

export function buildDisplayMediaConstraints({ width, height, fps }) {
  return {
    video: {
      cursor: "motion",
      width: { ideal: width, max: width },
      height: { ideal: height, max: height },
      frameRate: { ideal: fps, max: fps },
    },
    audio: false,
  };
}

export function buildElectronDesktopConstraints(sourceId, { width, height, fps }) {
  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: width,
        maxHeight: height,
        maxFrameRate: fps,
      },
    },
  };
}

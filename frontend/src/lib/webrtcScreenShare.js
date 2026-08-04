/**
 * Screen-share capture + RTP sender tuning for WebRTC mesh calls.
 * Group calls encode once per peer — keep resolution/bitrate/FPS conservative
 * so remote viewers stay smooth instead of stuttering at 1080p+.
 *
 * DRM / Netflix note: protected playback often yields a black capture surface
 * and may end the display-media track. Prefer sharing the *browser tab*
 * (not the whole window/screen). Avoid aggressive post-capture applyConstraints
 * — they can kill DRM tracks.
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

/**
 * Soft post-capture tuning. Never use hard `max` constraints after
 * getDisplayMedia — browsers (and DRM surfaces) often end the track.
 */
export async function optimizeScreenShareTrack(track, { width, height, fps } = {}) {
  if (!track || track.kind !== "video") return;
  try {
    // detail = prioritize text/UI sharpness; pair with capped FPS/bitrate
    if ("contentHint" in track) track.contentHint = "detail";
  } catch {
    /* ignore */
  }

  // Skip applyConstraints when the surface looks like a protected/DRM capture
  // (Netflix etc.) — constraining those tracks commonly black-screens or ends them.
  const label = (track.label || "").toLowerCase();
  const looksProtected =
    label.includes("netflix") ||
    label.includes("prime video") ||
    label.includes("disney") ||
    label.includes("widevine") ||
    label.includes("protected");

  if (looksProtected) return;
  if (track.readyState !== "live") return;

  try {
    await track.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: fps },
    });
  } catch {
    /* browser may reject some constraints after getDisplayMedia — leave track as-is */
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

/**
 * Prefer a browser *tab* surface so DRM sites can (sometimes) share readable
 * content; whole-window/monitor capture of Netflix is almost always black.
 */
export function buildDisplayMediaConstraints({ width, height, fps }) {
  return {
    video: {
      cursor: "motion",
      displaySurface: "browser",
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: fps },
    },
    audio: false,
    // Chromium extensions to the getDisplayMedia options dictionary
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "include",
    systemAudio: "exclude",
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

/** True when a screen track ended almost immediately — typical DRM kill. */
export function isLikelyDrmScreenEnd(startedAtMs, endedAtMs = Date.now()) {
  if (!startedAtMs) return false;
  return endedAtMs - startedAtMs < 4000;
}

/**
 * Decide whether an incoming remote video track is screen share vs camera.
 *
 * IMPORTANT: Do not treat a synthetic MediaStream([videoTrack]) fallback
 * (when e.streams[0] is missing during renegotiation) as screen — that
 * mis-wires camera frames into screenStream and leaves the real second
 * share black / stuck.
 */
export function isRemoteScreenVideoTrack(
  track,
  {
    rawStream = null,
    peerExpectsScreen = false,
    mainRemoteStream = null,
    participantHasCameraVideo = false,
  } = {}
) {
  if (!track || track.kind !== "video") return false;

  const label = (track.label || "").toLowerCase();
  if (
    peerExpectsScreen ||
    label.includes("screen") ||
    label.includes("display") ||
    label.includes("window") ||
    label.includes("tab") ||
    label.includes("web contents") ||
    label.includes("desktop") ||
    label.includes("monitor") ||
    label.includes("primary")
  ) {
    return true;
  }

  // Distinct MediaStream from the mic/camera bundle → screen share stream
  if (rawStream && mainRemoteStream && rawStream.id !== mainRemoteStream.id) {
    return true;
  }

  // Already showing camera; another video-only stream is screen
  if (
    participantHasCameraVideo &&
    rawStream &&
    rawStream.getAudioTracks().length === 0
  ) {
    return true;
  }

  return false;
}

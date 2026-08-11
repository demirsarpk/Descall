/**
 * Screen-share capture + RTP sender tuning for WebRTC mesh calls.
 * DM (1:1) uses a higher-quality profile; group mesh stays conservative.
 */

export const GROUP_SCREEN_DEFAULT_QUALITY = {
  resolution: "720p",
  fps: 20,
  contentHint: "motion",
};

export const DM_SCREEN_DEFAULT_QUALITY = {
  resolution: "1080p",
  fps: 30,
  contentHint: "motion",
};

const RESOLUTION_MAP = {
  "480p": { width: 854, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 1920, height: 1080 },
  "2160p": { width: 1920, height: 1080 },
  custom: { width: 1280, height: 720 },
};

function isMobileCapture() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

/**
 * @param {object} quality
 * @param {{ maxFps?: number, peerCount?: number }} [opts]
 */
export function resolveScreenCaptureSize(quality = {}, opts = {}) {
  const key = quality.resolution || "720p";
  const size = RESOLUTION_MAP[key] || RESOLUTION_MAP["720p"];
  const peerCount = Math.max(1, opts.peerCount || 1);
  // DM can sustain 30 FPS; group mesh caps lower to protect encode budget
  const hardCap = opts.maxFps ?? (peerCount <= 2 ? 30 : 24);
  const fps = Math.min(Math.max(Number(quality.fps) || (peerCount <= 2 ? 30 : 20), 10), hardCap);
  return { ...size, fps };
}

export function screenBitrateForPeerCount(peerCount, resolution = "720p") {
  const n = Math.max(1, peerCount || 1);
  const base =
    resolution === "480p"
      ? 900_000
      : resolution === "1080p"
        ? n <= 2
          ? 3_500_000
          : 2_200_000
        : n <= 2
          ? 2_200_000
          : 1_400_000;
  if (n >= 5) return Math.min(base, 900_000);
  if (n >= 3) return Math.min(base, 1_400_000);
  return base;
}

/**
 * Soft post-capture tuning. Never force hard W×H after getDisplayMedia —
 * that freezes orientation when a phone rotates into landscape video.
 */
export async function optimizeScreenShareTrack(track, { fps, contentHint = "motion" } = {}) {
  if (!track || track.kind !== "video") return;
  try {
    if ("contentHint" in track) {
      track.contentHint = contentHint === "detail" ? "detail" : "motion";
    }
  } catch {
    /* ignore */
  }

  if (track.readyState !== "live") return;

  try {
    await track.applyConstraints({ frameRate: { ideal: fps, max: fps } });
  } catch {
    try {
      await track.applyConstraints({ frameRate: { ideal: fps } });
    } catch {
      /* leave track as-is */
    }
  }
}

export async function optimizeScreenShareSender(
  sender,
  { maxBitrate = 2_200_000, maxFramerate = 30 } = {}
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
    // Prefer resolution under congestion for screen text; motion content still OK
    params.degradationPreference = "maintain-resolution";
    await sender.setParameters(params);
  } catch (err) {
    console.warn("[ScreenShare] setParameters failed:", err?.message || err);
  }

  // Prefer modern codecs when the transceiver API allows it
  try {
    const transceiver = sender.track
      ? sender // may not expose transceiver directly
      : null;
    void transceiver;
    if (typeof RTCRtpSender !== "undefined" && sender.track) {
      // Find transceiver via peer connection is caller responsibility — see preferScreenCodecs
    }
  } catch {
    /* ignore */
  }
}

/** Prefer VP9/AV1 for screen share on a transceiver (best-effort). */
export function preferScreenCodecs(pc, sender) {
  if (!pc || !sender || typeof RTCRtpSender === "undefined") return;
  try {
    const transceiver = pc.getTransceivers?.().find((t) => t.sender === sender);
    if (!transceiver?.setCodecPreferences || !RTCRtpSender.getCapabilities) return;
    const caps = RTCRtpSender.getCapabilities("video");
    if (!caps?.codecs?.length) return;
    const preferred = [];
    const rest = [];
    for (const c of caps.codecs) {
      const mime = (c.mimeType || "").toLowerCase();
      if (mime.includes("vp9") || mime.includes("av1")) preferred.push(c);
      else if (!mime.includes("rtx") && !mime.includes("red") && !mime.includes("ulpfec")) rest.push(c);
    }
    if (preferred.length) transceiver.setCodecPreferences([...preferred, ...rest]);
  } catch (err) {
    console.warn("[ScreenShare] setCodecPreferences failed:", err?.message || err);
  }
}

/**
 * Build getDisplayMedia constraints.
 * On mobile, omit width/height ideals so portrait→landscape rotation updates freely.
 * Do not preferCurrentTab — that dies when the app backgrounds / leaves the tab.
 */
export function buildDisplayMediaConstraints({ width, height, fps, preferTab = false } = {}) {
  const mobile = isMobileCapture();
  const video = {
    cursor: "motion",
    frameRate: { ideal: fps, max: Math.max(fps, 30) },
  };
  if (!mobile && width && height) {
    video.width = { ideal: width };
    video.height = { ideal: height };
  }
  // Prefer monitor/window on mobile so YouTube fullscreen rotation is captured
  if (!preferTab) {
    video.displaySurface = mobile ? "monitor" : "monitor";
  } else {
    video.displaySurface = "browser";
  }

  return {
    video,
    audio: {
      // Chromium: tab/system audio only if user checks "Share audio"
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    preferCurrentTab: Boolean(preferTab),
    selfBrowserSurface: "include",
    surfaceSwitching: "include",
    systemAudio: "include",
  };
}

export function buildElectronDesktopConstraints(sourceId, { width, height, fps }) {
  return {
    audio: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
      },
    },
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

/**
 * Watch a display track for orientation / size changes (portrait → landscape).
 * Calls `onResize({ width, height })` when settings change.
 * Returns a cleanup function.
 */
export function watchScreenTrackResize(track, onResize) {
  if (!track || track.kind !== "video" || typeof onResize !== "function") {
    return () => {};
  }

  let lastW = 0;
  let lastH = 0;
  const emit = () => {
    try {
      const settings = track.getSettings?.() || {};
      const w = Number(settings.width) || 0;
      const h = Number(settings.height) || 0;
      if (!w || !h) return;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      onResize({ width: w, height: h, settings });
    } catch {
      /* ignore */
    }
  };

  emit();

  const onEnded = () => cleanup();
  try {
    track.addEventListener?.("ended", onEnded);
  } catch {
    /* ignore */
  }

  // Some browsers fire `resize` on MediaStreamTrack
  const onTrackResize = () => emit();
  try {
    track.addEventListener?.("resize", onTrackResize);
  } catch {
    /* ignore */
  }

  const poll = setInterval(emit, 500);

  function cleanup() {
    clearInterval(poll);
    try {
      track.removeEventListener?.("ended", onEnded);
      track.removeEventListener?.("resize", onTrackResize);
    } catch {
      /* ignore */
    }
  }

  return cleanup;
}

/**
 * Decide whether an incoming remote video track is screen share vs camera.
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

  if (rawStream && mainRemoteStream && rawStream.id !== mainRemoteStream.id) {
    return true;
  }

  if (
    participantHasCameraVideo &&
    rawStream &&
    rawStream.getAudioTracks().length === 0
  ) {
    return true;
  }

  return false;
}

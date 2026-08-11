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

/** Named presets for the quality panel (resolution + fps + contentHint). */
export const SCREEN_QUALITY_PRESETS = {
  smooth: {
    id: "smooth",
    resolution: "480p",
    fps: 20,
    contentHint: "motion",
  },
  balanced: {
    id: "balanced",
    resolution: "720p",
    fps: 24,
    contentHint: "motion",
  },
  high: {
    id: "high",
    resolution: "1080p",
    fps: 30,
    contentHint: "motion",
  },
  ultra: {
    id: "ultra",
    resolution: "1440p",
    fps: 30,
    contentHint: "motion",
  },
  text: {
    id: "text",
    resolution: "1080p",
    fps: 20,
    contentHint: "detail",
  },
};

const RESOLUTION_MAP = {
  "480p": { width: 854, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "2160p": { width: 3840, height: 2160 },
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
  // DM can sustain 60 FPS; group mesh caps lower to protect encode budget
  const hardCap = opts.maxFps ?? (peerCount <= 2 ? 60 : 24);
  const fps = Math.min(Math.max(Number(quality.fps) || (peerCount <= 2 ? 30 : 20), 10), hardCap);
  return { ...size, fps };
}

export function screenBitrateForPeerCount(peerCount, resolution = "720p") {
  const n = Math.max(1, peerCount || 1);
  let base = 2_200_000;
  if (resolution === "480p") base = 900_000;
  else if (resolution === "720p") base = n <= 2 ? 2_200_000 : 1_400_000;
  else if (resolution === "1080p") base = n <= 2 ? 3_500_000 : 2_200_000;
  else if (resolution === "1440p") base = n <= 2 ? 6_000_000 : 3_000_000;
  else if (resolution === "2160p") base = n <= 2 ? 10_000_000 : 4_000_000;

  if (n >= 5) return Math.min(base, 900_000);
  if (n >= 3) return Math.min(base, 1_600_000);
  return base;
}

/** Human-readable Mbps estimate for the quality panel. */
export function estimateScreenShareMbps(quality = {}, peerCount = 2) {
  const bps = screenBitrateForPeerCount(peerCount, quality.resolution || "720p");
  const fpsBoost = Math.min(1.35, Math.max(0.75, (Number(quality.fps) || 24) / 24));
  const detailBoost = quality.contentHint === "detail" || quality.contentHint === "text" ? 1.1 : 1;
  return Math.round((bps * fpsBoost * detailBoost) / 100_000) / 10;
}

export function matchScreenQualityPreset(quality = {}) {
  const res = quality.resolution || "720p";
  const fps = Number(quality.fps) || 24;
  const hint = quality.contentHint === "detail" || quality.contentHint === "text" ? "detail" : "motion";
  for (const preset of Object.values(SCREEN_QUALITY_PRESETS)) {
    if (
      preset.resolution === res &&
      Number(preset.fps) === fps &&
      (preset.contentHint === "detail" ? "detail" : "motion") === hint
    ) {
      return preset.id;
    }
  }
  return "custom";
}

/**
 * Soft post-capture tuning. Never force hard W×H after getDisplayMedia —
 * that freezes orientation when a phone rotates into landscape video.
 */
export async function optimizeScreenShareTrack(track, { fps, contentHint = "motion" } = {}) {
  if (!track || track.kind !== "video") return;
  try {
    if ("contentHint" in track) {
      // Prefer "text" when requested (sharp UI/code); fall back to detail/motion
      if (contentHint === "text") {
        try {
          track.contentHint = "text";
        } catch {
          track.contentHint = "detail";
        }
      } else if (contentHint === "detail") {
        track.contentHint = "detail";
      } else {
        track.contentHint = "motion";
      }
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
    // Request audio aggressively — Chromium still requires the user to tick
    // “Share audio” / “Share tab audio”. Mobile Chrome can deliver tab audio
    // when sharing a browser tab; iOS Safari typically cannot.
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      // Keep original tab loudness (don't duck for mic)
      suppressLocalAudioPlayback: false,
    },
    preferCurrentTab: Boolean(preferTab),
    selfBrowserSurface: "include",
    surfaceSwitching: "include",
    systemAudio: "include",
    // Hint Chromium to surface the audio checkbox in the picker
    monitorTypeSurfaces: "include",
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

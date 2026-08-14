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

export function isMobileScreenCapture() {
  return isMobileCapture();
}

/**
 * Build getDisplayMedia constraints.
 *
 * Mobile: prefer the entire screen (`monitor`). Sharing only the Descall tab
 * (or preferCurrentTab) ends the moment the user switches to YouTube/Safari
 * home — the common “arka plana alınca ekran yansıması koptu” failure.
 *
 * Desktop: omit `displaySurface` by default so Chromium/Edge show the full
 * OS picker (window / entire screen / tab). DES-10: locking `browser` made
 * many users only see the Descall tab. Pass `preferTab: true` only when you
 * explicitly want tab-first (e.g. tab audio UX experiments).
 * Never lock preferCurrentTab — that also dies on background/tab switch.
 */
export function buildDisplayMediaConstraints({ width, height, fps, preferTab } = {}) {
  const mobile = isMobileCapture();
  const video = {
    cursor: "motion",
    frameRate: { ideal: fps, max: Math.max(fps, 30) },
  };
  if (!mobile && width && height) {
    video.width = { ideal: width };
    video.height = { ideal: height };
  }
  if (mobile) {
    video.displaySurface = "monitor";
  } else if (preferTab === true) {
    video.displaySurface = "browser";
  }
  // Desktop default: no displaySurface → full source picker (window/screen/tab).

  return {
    video,
    // Chromium still requires the user to tick “Share audio”. Detailed
    // constraints preserve tab loudness; some engines only accept `true`.
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      suppressLocalAudioPlayback: false,
    },
    preferCurrentTab: false,
    selfBrowserSurface: "include",
    surfaceSwitching: "include",
    systemAudio: "include",
    monitorTypeSurfaces: "include",
  };
}

export function isElectronRuntime() {
  return typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);
}

/** True when we have at least one viable capture path (Electron desktopCapturer or getDisplayMedia). */
export function canCaptureScreen() {
  if (typeof window === "undefined") return false;
  if (isElectronRuntime() && typeof window.electronAPI?.getScreenSources === "function") return true;
  if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function") {
    return true;
  }
  return false;
}

function screenShareUnsupportedError() {
  const secure = typeof window === "undefined" ? true : Boolean(window.isSecureContext);
  const err = new Error(
    secure
      ? "Screen sharing is not available in this browser."
      : "Screen sharing requires a secure connection (HTTPS)."
  );
  err.name = "NotSupportedError";
  err.code = "SCREEN_SHARE_UNSUPPORTED";
  return err;
}

/**
 * getDisplayMedia with progressive constraint fallbacks.
 * Firefox/Safari reject Chromium-only fields (displaySurface, systemAudio, …);
 * some mobile/WebViews reject audio constraints entirely.
 */
export async function getDisplayMediaStream(opts = {}) {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    throw screenShareUnsupportedError();
  }

  const primary = buildDisplayMediaConstraints(opts);
  const attempts = [
    primary,
    { ...primary, audio: true },
    { ...primary, audio: false },
    {
      video: {
        cursor: "motion",
        frameRate: primary.video?.frameRate,
      },
      audio: true,
    },
    {
      video: true,
      audio: true,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastErr = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
      lastErr = err;
      if (err?.name === "NotAllowedError" || err?.name === "AbortError") throw err;
    }
  }
  throw lastErr || screenShareUnsupportedError();
}

/**
 * Electron source picker (inline overlay — no CSS dependency).
 * @returns {Promise<string|null>} source id or null if cancelled
 */
export function showElectronScreenPicker(sources = []) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (id) => {
      if (resolved) return;
      resolved = true;
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      resolve(id);
    };

    const STYLE_ID = "__esp_anim__";
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        @keyframes _esp_overlay { from { opacity:0 } to { opacity:1 } }
        @keyframes _esp_modal { from { opacity:0; transform:scale(0.9) translateY(16px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `;
      document.head.appendChild(style);
    }

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      animation: "_esp_overlay 0.2s ease",
    });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
      background: "#1a1a1f",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px",
      width: "720px",
      maxWidth: "90vw",
      maxHeight: "82vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      animation: "_esp_modal 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "18px 24px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      flexShrink: "0",
    });

    const title = document.createElement("h3");
    title.textContent = "Share your screen";
    Object.assign(title.style, {
      margin: "0",
      fontSize: "16px",
      fontWeight: "600",
      color: "#f0f0f5",
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      width: "32px",
      height: "32px",
      border: "none",
      borderRadius: "8px",
      background: "transparent",
      color: "#8a8a93",
      fontSize: "24px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: "1",
    });
    closeBtn.addEventListener("click", () => done(null));

    header.appendChild(title);
    header.appendChild(closeBtn);

    const tip = document.createElement("div");
    tip.textContent = "Choose the screen, window, or browser tab you want to share.";
    Object.assign(tip.style, {
      padding: "10px 24px",
      fontSize: "12px",
      color: "#949ba4",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      lineHeight: "1.4",
    });

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      gap: "12px",
      padding: "20px 24px 24px",
      overflowY: "auto",
    });

    (sources || []).forEach((source) => {
      const item = document.createElement("div");
      Object.assign(item.style, {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: "rgba(255,255,255,0.04)",
        border: "1.5px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
        padding: "10px",
        cursor: "pointer",
        transition: "all 0.15s",
      });
      const thumb = document.createElement("img");
      thumb.src = source.thumbnailDataURL || "";
      thumb.alt = source.name || "Screen";
      thumb.draggable = false;
      Object.assign(thumb.style, {
        width: "100%",
        aspectRatio: "16/9",
        objectFit: "cover",
        borderRadius: "8px",
        background: "#111",
      });
      const label = document.createElement("span");
      label.textContent = source.name || "Screen";
      Object.assign(label.style, {
        fontSize: "12px",
        fontWeight: "500",
        color: "#c0c0c8",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textAlign: "center",
      });
      item.appendChild(thumb);
      item.appendChild(label);
      item.addEventListener("click", () => done(source.id));
      grid.appendChild(item);
    });

    modal.appendChild(header);
    modal.appendChild(tip);
    modal.appendChild(grid);
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) done(null);
    });
    document.body.appendChild(overlay);
  });
}

/**
 * Unified screen capture for DM / group / server voice.
 * Electron → desktopCapturer picker; web → getDisplayMedia with soft fallbacks.
 * Multiple participants may call this concurrently — there is no single-sharer lock.
 */
export async function captureScreenShareStream(opts = {}) {
  const { width, height, fps, preferTab, pickSource = showElectronScreenPicker } = opts;

  if (isElectronRuntime() && typeof window.electronAPI?.getScreenSources === "function") {
    try {
      const sources = await window.electronAPI.getScreenSources();
      if (Array.isArray(sources) && sources.length > 0) {
        const sourceId = await pickSource(sources);
        if (!sourceId) {
          const err = new Error("Screen share cancelled");
          err.name = "AbortError";
          throw err;
        }
        return await navigator.mediaDevices.getUserMedia(
          buildElectronDesktopConstraints(sourceId, { width, height, fps })
        );
      }
      // Empty sources (macOS Screen Recording denied) — try getDisplayMedia next.
    } catch (err) {
      if (err?.name === "AbortError" || err?.name === "NotAllowedError") throw err;
      console.warn("[ScreenShare] Electron desktopCapturer path failed, trying getDisplayMedia:", err);
    }
  }

  if (typeof navigator?.mediaDevices?.getDisplayMedia === "function") {
    return getDisplayMediaStream({ width, height, fps, preferTab });
  }

  throw screenShareUnsupportedError();
}

/**
 * Electron desktopCapture constraints.
 * Windows loopback audio must NOT reuse the video sourceId.
 */
export function buildElectronDesktopConstraints(sourceId, { width, height, fps }) {
  const isWin =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent || "");
  const audio = isWin
    ? {
        mandatory: {
          chromeMediaSource: "desktop",
        },
      }
    : {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId,
        },
      };
  return {
    audio,
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
 * Prefer real display/tab/system audio on the screen stream.
 * Do NOT mix the call microphone in as a fallback — that doubles voice and
 * still fails to carry “yayın sesi” (YouTube/game audio), especially on mobile
 * Safari/Chrome where system audio simply isn’t capturable.
 *
 * @returns {{ track: MediaStreamTrack|null, source: 'display'|null }}
 */
export async function ensureScreenShareAudioTrack(screenStream, _localMicStream) {
  if (!screenStream) return { track: null, source: null };
  const existing = screenStream.getAudioTracks().find((t) => t && t.readyState !== "ended");
  if (existing) {
    try {
      if ("contentHint" in existing) existing.contentHint = "music";
    } catch {
      /* ignore */
    }
    return { track: existing, source: "display" };
  }
  return { track: null, source: null };
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

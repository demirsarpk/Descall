import { useCallback, useEffect, useRef, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import { attachSpeakerWatcher, pickCallPipSource } from "../../lib/callPipStream";
import { useT } from "../../context/LocaleContext";
import { t as tRuntime } from "../../i18n/runtime";

/**
 * Always-mounted PiP source for active calls.
 * - Keeps a playing <video> with real dimensions (browsers reject tiny/hidden PiP sources)
 * - autoPictureInPicture + Media Session for Chrome Automatic PiP
 * - Primes on first user gesture so background enter works on mobile
 * - Auto-enters OS PiP on visibility hidden / pagehide / blur (with retries)
 */

function drawAvatarCard(canvas, { username, avatarUrl, subtitle }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0f1117";
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 8, w * 0.5, h * 0.4, w * 0.5);
  g.addColorStop(0, "#2b3348");
  g.addColorStop(1, "#0f1117");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.4;
  const r = Math.min(w, h) * 0.2;

  const finish = () => {
    ctx.fillStyle = "#f2f3f5";
    ctx.font = `650 ${Math.round(w * 0.06)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(username || tRuntime("Descall"), cx, cy + r + 42);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = `500 ${Math.round(w * 0.042)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(subtitle || tRuntime("On a call"), cx, cy + r + 72);
    ctx.fillStyle = "#5865f2";
    ctx.font = `700 ${Math.round(w * 0.038)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText("DESCALL", cx, h - 36);
  };

  if (avatarUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      // ring
      ctx.strokeStyle = "rgba(88,101,242,0.85)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      finish();
    };
    img.onerror = () => {
      ctx.fillStyle = "#5865f2";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(r)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((username || "?").slice(0, 1).toUpperCase(), cx, cy + 2);
      ctx.textBaseline = "alphabetic";
      finish();
    };
    img.src = avatarUrl;
  } else {
    ctx.fillStyle = "#5865f2";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.round(r)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((username || "?").slice(0, 1).toUpperCase(), cx, cy + 2);
    ctx.textBaseline = "alphabetic";
    finish();
  }
}

async function enterNativePip(video) {
  if (!video) return false;
  try {
    if (document.pictureInPictureElement === video) return true;
    if (
      typeof video.webkitPresentationMode === "string" &&
      video.webkitPresentationMode === "picture-in-picture"
    ) {
      return true;
    }

    // Ensure playing before request (required by most engines)
    if (video.paused) {
      try {
        await video.play();
      } catch {
        /* ignore */
      }
    }

    if (typeof video.webkitSetPresentationMode === "function") {
      const supports =
        typeof video.webkitSupportsPresentationMode !== "function" ||
        video.webkitSupportsPresentationMode("picture-in-picture");
      if (supports) {
        video.webkitSetPresentationMode("picture-in-picture");
        return (
          video.webkitPresentationMode === "picture-in-picture" ||
          true
        );
      }
    }

    if (document.pictureInPictureEnabled !== false && video.requestPictureInPicture) {
      await video.requestPictureInPicture();
      return document.pictureInPictureElement === video;
    }
  } catch (err) {
    console.warn("[PiP] enter failed:", err?.message || err);
    return false;
  }
  return false;
}

async function exitNativePip(video) {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture?.();
    }
    if (
      video &&
      typeof video.webkitSetPresentationMode === "function" &&
      video.webkitPresentationMode === "picture-in-picture"
    ) {
      video.webkitSetPresentationMode("inline");
    }
  } catch {
    /* ignore */
  }
}

function isNarrow() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

export default function CallPipSource({
  isDm,
  call,
  groupCall,
  active,
  onApi,
}) {
  const t = useT();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const primedRef = useRef(false);
  const enterLockRef = useRef(false);
  const retryTimerRef = useRef(null);
  const [lastSpeakerId, setLastSpeakerId] = useState(null);
  const [pipActive, setPipActive] = useState(false);
  const [narrow, setNarrow] = useState(() => isNarrow());
  const source = pickCallPipSource({ isDm, call, groupCall, lastSpeakerId });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Speaker watch (group)
  useEffect(() => {
    if (!active || isDm) return undefined;
    const map = new Map();
    for (const p of groupCall?.participants || []) {
      if (p.stream) map.set(p.id, p.stream);
    }
    return attachSpeakerWatcher(map, (id) => setLastSpeakerId(id));
  }, [active, isDm, groupCall?.participants]);

  // Attach stream / avatar canvas to sticky video
  useEffect(() => {
    if (!active) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    video.disablePictureInPicture = false;
    try {
      video.autoPictureInPicture = true;
    } catch {
      /* older browsers */
    }
    video.setAttribute("autoPictureInPicture", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    // Prefer landscape for camera, portrait for avatar cards
    video.width = source.kind === "avatar" ? 720 : 960;
    video.height = source.kind === "avatar" ? 1280 : 540;

    let cancelled = false;

    const attach = async (stream) => {
      if (cancelled || !video) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.muted = true;
      try {
        await video.play();
      } catch {
        /* autoplay race — will retry on gesture */
      }
    };

    if (source.stream) {
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach((t) => t.stop());
        canvasStreamRef.current = null;
      }
      attach(source.stream);
      return () => {
        cancelled = true;
      };
    }

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.width = 720;
    canvas.height = 1280;
    const paint = () =>
      drawAvatarCard(canvas, {
        username: source.username || source.label,
        avatarUrl: source.avatarUrl,
        subtitle: t("On a call"),
      });
    paint();
    const timer = setInterval(paint, 1000);

    let stream = canvasStreamRef.current;
    if (!stream || stream.getVideoTracks().every((t) => t.readyState === "ended")) {
      // 30fps for smoother OS PiP
      stream = canvas.captureStream?.(30) || null;
      canvasStreamRef.current = stream;
    }
    if (stream) {
      // Hint higher quality on the synthetic track
      const vt = stream.getVideoTracks?.()[0];
      try {
        vt?.contentHint && (vt.contentHint = "motion");
      } catch {
        /* ignore */
      }
      attach(stream);
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    active,
    source.stream,
    source.kind,
    source.label,
    source.avatarUrl,
    source.username,
    source.userId,
  ]);

  const enterPip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || enterLockRef.current) return false;
    enterLockRef.current = true;
    try {
      try {
        await video.play();
      } catch {
        /* ignore */
      }
      const ok = await enterNativePip(video);
      const activeNow =
        ok ||
        document.pictureInPictureElement === video ||
        video.webkitPresentationMode === "picture-in-picture";
      setPipActive(Boolean(activeNow));
      if (activeNow) primedRef.current = true;
      return Boolean(activeNow);
    } finally {
      enterLockRef.current = false;
    }
  }, []);

  const leavePip = useCallback(async () => {
    await exitNativePip(videoRef.current);
    setPipActive(false);
  }, []);

  const primeFromGesture = useCallback(() => {
    primedRef.current = true;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
    // Keep autoPictureInPicture armed; do not force-enter on every tap
    try {
      video.autoPictureInPicture = true;
    } catch {
      /* ignore */
    }
  }, []);

  // Expose API to parent (PiP button + gesture priming)
  useEffect(() => {
    onApi?.({ enterPip, leavePip, primeFromGesture, pipActive });
    return () => onApi?.(null);
  }, [onApi, enterPip, leavePip, primeFromGesture, pipActive]);

  // Prime on first pointer/keyboard interaction while call is active
  useEffect(() => {
    if (!active) return undefined;
    const arm = () => primeFromGesture();
    window.addEventListener("pointerdown", arm, { capture: true, passive: true });
    window.addEventListener("keydown", arm, { capture: true });
    window.addEventListener("touchstart", arm, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
      window.removeEventListener("touchstart", arm, true);
    };
  }, [active, primeFromGesture]);

  // Auto-enter on background — retries because engines can reject the first attempt
  useEffect(() => {
    if (!active) return undefined;

    const clearRetries = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const tryEnter = (attempt = 0) => {
      const video = videoRef.current;
      if (!video) return;
      if (
        document.pictureInPictureElement === video ||
        video.webkitPresentationMode === "picture-in-picture"
      ) {
        setPipActive(true);
        return;
      }

      video.play().catch(() => {});
      enterNativePip(video).then((ok) => {
        if (ok) {
          setPipActive(true);
          return;
        }
        // Retry a few times — mobile often needs a beat after hide
        if (attempt < 4) {
          retryTimerRef.current = setTimeout(() => tryEnter(attempt + 1), 120 + attempt * 80);
        }
      });
    };

    const onBackground = () => {
      tryEnter(0);
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        onBackground();
      } else if (document.visibilityState === "visible") {
        clearRetries();
        // Small delay so quick app-switcher peeks don't thrash
        retryTimerRef.current = setTimeout(() => {
          if (document.visibilityState === "visible") {
            exitNativePip(videoRef.current).finally(() => setPipActive(false));
          }
        }, 180);
      }
    };

    const onBlur = () => {
      // iOS/Android often blur before visibilitychange
      if (document.visibilityState === "hidden" || document.hidden) {
        onBackground();
      } else if (narrow) {
        // On mobile, leaving the tab/app via home often fires blur first
        onBackground();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onBackground);
    window.addEventListener("blur", onBlur);
    document.addEventListener("freeze", onBackground);

    return () => {
      clearRetries();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onBackground);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("freeze", onBackground);
    };
  }, [active, narrow]);

  // Track PiP lifecycle events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    const onWebkit = () => {
      setPipActive(video.webkitPresentationMode === "picture-in-picture");
    };
    video.addEventListener("webkitpresentationmodechanged", onWebkit);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
      video.removeEventListener("webkitpresentationmodechanged", onWebkit);
    };
  }, [active]);

  // Media Session — helps Chrome Automatic PiP + OS call UI
  useEffect(() => {
    if (!active || !("mediaSession" in navigator)) return undefined;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: source.label || t("Descall Call"),
        artist: t("Descall"),
        album: t("On a call"),
        artwork: source.avatarUrl
          ? [{ src: source.avatarUrl, sizes: "512x512", type: "image/png" }]
          : [],
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler?.("hangup", () => {
        if (isDm) call?.endCall?.(call?.peer?.id);
        else groupCall?.leaveCall?.();
      });
      navigator.mediaSession.setActionHandler?.("togglecamera", () => {
        if (isDm) call?.toggleCamera?.();
        else groupCall?.toggleCamera?.();
      });
      navigator.mediaSession.setActionHandler?.("togglemicrophone", () => {
        if (isDm) call?.toggleMute?.();
        else groupCall?.toggleMute?.();
      });
      // Some Chromium builds use this as the Automatic PiP hook
      navigator.mediaSession.setActionHandler?.("enterpictureinpicture", () => {
        enterPip();
      });
    } catch {
      /* unsupported handlers */
    }
    return () => {
      try {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.setActionHandler?.("hangup", null);
        navigator.mediaSession.setActionHandler?.("togglecamera", null);
        navigator.mediaSession.setActionHandler?.("togglemicrophone", null);
        navigator.mediaSession.setActionHandler?.("enterpictureinpicture", null);
      } catch {
        /* ignore */
      }
    };
  }, [active, source.label, source.avatarUrl, isDm, call, groupCall, enterPip]);

  // Cleanup canvas stream on unmount
  useEffect(() => {
    return () => {
      canvasStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      canvasStreamRef.current = null;
      exitNativePip(videoRef.current);
    };
  }, []);

  if (!active) return null;

  // Visible compact preview on mobile (engines reject invisible/tiny PiP sources).
  // On desktop keep it off-canvas but with real dimensions.
  const previewStyle = narrow
    ? {
        position: "fixed",
        right: 12,
        bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
        width: 112,
        height: 168,
        borderRadius: 14,
        objectFit: "cover",
        zIndex: 70,
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
        background: "#12141a",
        pointerEvents: pipActive ? "none" : "auto",
        opacity: pipActive ? 0 : 1,
      }
    : {
        position: "fixed",
        width: 320,
        height: 180,
        opacity: 0.02,
        pointerEvents: "none",
        left: -10000,
        top: 0,
        zIndex: -1,
      };

  return (
    <>
      <video
        ref={videoRef}
        className="call-pip-source-video"
        autoPlay
        playsInline
        muted
        disableRemotePlayback
        autoPictureInPicture
        onClick={() => {
          primeFromGesture();
          enterPip();
        }}
        style={previewStyle}
        aria-label={t("Call picture-in-picture preview")}
      />
      <canvas
        ref={canvasRef}
        className="call-pip-source-canvas"
        width={720}
        height={1280}
        style={{ display: "none" }}
        aria-hidden
      />
    </>
  );
}

/** Compact control used in the call bar */
export function CallPipButton({ pipApi, narrow = false }) {
  const t = useT();
  if (!pipApi?.enterPip) return null;
  return (
    <button
      type="button"
      title={pipApi.pipActive ? t("PiP active") : t("Picture in Picture")}
      onClick={() => {
        pipApi.primeFromGesture?.();
        if (pipApi.pipActive) pipApi.leavePip?.();
        else pipApi.enterPip?.();
      }}
      style={{
        width: narrow ? 46 : 52,
        height: narrow ? 46 : 52,
        borderRadius: "50%",
        border: "none",
        background: pipApi.pipActive ? "rgba(88,101,242,0.45)" : "#3c4043",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <PictureInPicture2 size={narrow ? 19 : 22} />
    </button>
  );
}

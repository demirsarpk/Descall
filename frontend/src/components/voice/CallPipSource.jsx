import { useCallback, useEffect, useRef, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import { attachSpeakerWatcher, pickCallPipSource } from "../../lib/callPipStream";

/**
 * Always-mounted PiP source for active calls.
 * - Keeps a playing <video> (or canvas→captureStream avatar fallback)
 * - Enables autoPictureInPicture where supported
 * - Enters OS PiP on background / pagehide (best-effort)
 * - Exposes enterPip() via onReady for a user-gesture button (Safari)
 */

function drawAvatarCard(canvas, { username, avatarUrl, subtitle }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#12141a";
  ctx.fillRect(0, 0, w, h);

  // soft radial
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, w * 0.45);
  g.addColorStop(0, "#2a3142");
  g.addColorStop(1, "#12141a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.42;
  const r = Math.min(w, h) * 0.18;

  const finish = () => {
    ctx.fillStyle = "#f2f3f5";
    ctx.font = `600 ${Math.round(w * 0.055)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(username || "Descall", cx, cy + r + 36);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = `500 ${Math.round(w * 0.04)}px system-ui, sans-serif`;
    ctx.fillText(subtitle || "On a call", cx, cy + r + 62);
    ctx.fillStyle = "#5865f2";
    ctx.font = `700 ${Math.round(w * 0.035)}px system-ui, sans-serif`;
    ctx.fillText("DESCALL", cx, h - 28);
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
    if (typeof video.webkitSetPresentationMode === "function") {
      const supports =
        typeof video.webkitSupportsPresentationMode !== "function" ||
        video.webkitSupportsPresentationMode("picture-in-picture");
      if (supports) {
        video.webkitSetPresentationMode("picture-in-picture");
        return true;
      }
    }
    if (document.pictureInPictureEnabled !== false && video.requestPictureInPicture) {
      await video.requestPictureInPicture();
      return true;
    }
  } catch {
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
      typeof video.webkitPresentationMode === "string" &&
      video.webkitPresentationMode === "picture-in-picture"
    ) {
      video.webkitSetPresentationMode("inline");
    }
  } catch {
    /* ignore */
  }
}

export default function CallPipSource({
  isDm,
  call,
  groupCall,
  active,
  onApi,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const [lastSpeakerId, setLastSpeakerId] = useState(null);
  const [pipActive, setPipActive] = useState(false);
  const source = pickCallPipSource({ isDm, call, groupCall, lastSpeakerId });

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

    let cancelled = false;

    const attach = async (stream) => {
      if (cancelled || !video) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.muted = true; // avoid echo; call audio already plays via audio elements
      try {
        await video.play();
      } catch {
        /* autoplay race */
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

    // Avatar fallback → captureStream for PiP content
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.width = 720;
    canvas.height = 1280;
    drawAvatarCard(canvas, {
      username: source.username || source.label,
      avatarUrl: source.avatarUrl,
      subtitle: "On a call",
    });
    // redraw periodically so late-loading avatars / clock feel alive
    const timer = setInterval(() => {
      drawAvatarCard(canvas, {
        username: source.username || source.label,
        avatarUrl: source.avatarUrl,
        subtitle: "On a call",
      });
    }, 2000);

    let stream = canvasStreamRef.current;
    if (!stream || stream.getVideoTracks().every((t) => t.readyState === "ended")) {
      stream = canvas.captureStream?.(15) || null;
      canvasStreamRef.current = stream;
    }
    if (stream) attach(stream);

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
    if (!video) return false;
    try {
      await video.play();
    } catch {
      /* ignore */
    }
    const ok = await enterNativePip(video);
    setPipActive(ok || Boolean(document.pictureInPictureElement));
    return ok;
  }, []);

  const leavePip = useCallback(async () => {
    await exitNativePip(videoRef.current);
    setPipActive(false);
  }, []);

  // Expose API to parent (PiP button)
  useEffect(() => {
    onApi?.({ enterPip, leavePip, pipActive });
    return () => onApi?.(null);
  }, [onApi, enterPip, leavePip, pipActive]);

  // Auto-enter on background (best-effort; Safari may require prior gesture)
  useEffect(() => {
    if (!active) return undefined;

    const tryEnter = () => {
      const video = videoRef.current;
      if (!video) return;
      video.play().catch(() => {});
      enterNativePip(video).then((ok) => {
        if (ok) setPipActive(true);
      });
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        tryEnter();
      } else if (document.visibilityState === "visible") {
        // Return to in-page UI when user comes back
        exitNativePip(videoRef.current).finally(() => setPipActive(false));
      }
    };

    const onPageHide = () => tryEnter();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    // iOS sometimes fires freeze when backgrounding Safari
    document.addEventListener("freeze", tryEnter);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("freeze", tryEnter);
    };
  }, [active]);

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

  // Media Session — OS call UI where available
  useEffect(() => {
    if (!active || !("mediaSession" in navigator)) return undefined;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: source.label || "Descall Call",
        artist: "Descall",
        album: "Voice chat",
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
    } catch {
      /* unsupported handlers */
    }
    return () => {
      try {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.setActionHandler?.("hangup", null);
        navigator.mediaSession.setActionHandler?.("togglecamera", null);
        navigator.mediaSession.setActionHandler?.("togglemicrophone", null);
      } catch {
        /* ignore */
      }
    };
  }, [active, source.label, isDm, call, groupCall]);

  // Cleanup canvas stream on unmount
  useEffect(() => {
    return () => {
      canvasStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      canvasStreamRef.current = null;
      exitNativePip(videoRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <>
      {/* Sticky PiP source — must stay mounted while minimized */}
      <video
        ref={videoRef}
        className="call-pip-source-video"
        autoPlay
        playsInline
        muted
        disableRemotePlayback
        style={{
          position: "fixed",
          width: 2,
          height: 2,
          opacity: 0.01,
          pointerEvents: "none",
          left: 0,
          bottom: 0,
          zIndex: -1,
        }}
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
  if (!pipApi?.enterPip) return null;
  return (
    <button
      type="button"
      title={pipApi.pipActive ? "PiP active" : "Picture in Picture"}
      onClick={() => {
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

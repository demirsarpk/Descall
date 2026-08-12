/**
 * Best-effort mitigation for calls dropping after the phone/tablet screen
 * locks or the device aggressively suspends a backgrounded tab/WebView.
 *
 * Layers:
 *  - Screen Wake Lock (while visible)
 *  - Media Session "playing" (Chrome background exemption)
 *  - Silent AudioContext keepalive (keeps media pipeline warm)
 *  - Native Android CallKeepAlive foreground service (Capacitor APK)
 *
 * The native FGS is what actually keeps DM WebRTC alive when the Android
 * shell is backgrounded; the web mechanisms help browser/PWA and soften
 * short suspensions.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

const CallKeepAlive = registerPlugin("CallKeepAlive");

let wakeLockSentinel = null;
let reacquireOnVisible = null;
let silentCtx = null;
let silentGain = null;
let silentOsc = null;
let silentHtmlAudio = null;
let nativeKeepAliveActive = false;

/** Tiny WAV (near-silent) — HTMLAudioElement survives iOS Safari background better than AudioContext alone. */
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==";

async function acquireScreenWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
  } catch {
    wakeLockSentinel = null;
  }
}

function setMediaSessionActive(title, artist) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: title || "Descall call",
      artist: artist || "In call",
    });
    navigator.mediaSession.playbackState = "playing";
  } catch {
    /* not supported / not allowed — ignore */
  }
}

function clearMediaSessionActive() {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.metadata = null;
  } catch {
    /* ignore */
  }
}

function startSilentHtmlAudioKeepalive() {
  if (silentHtmlAudio) {
    try {
      silentHtmlAudio.play().catch(() => {});
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const audio = new Audio(SILENT_WAV_DATA_URI);
    audio.loop = true;
    audio.volume = 0.01;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    // Keep element in DOM — some mobile browsers pause detached media.
    audio.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;";
    document.body?.appendChild(audio);
    silentHtmlAudio = audio;
    audio.play().catch(() => {});
  } catch {
    silentHtmlAudio = null;
  }
}

function stopSilentHtmlAudioKeepalive() {
  if (!silentHtmlAudio) return;
  try {
    silentHtmlAudio.pause();
    silentHtmlAudio.removeAttribute("src");
    silentHtmlAudio.load?.();
    silentHtmlAudio.remove();
  } catch {
    /* ignore */
  }
  silentHtmlAudio = null;
}

function startSilentAudioKeepalive() {
  startSilentHtmlAudioKeepalive();
  if (silentCtx) {
    if (silentCtx.state === "suspended") {
      silentCtx.resume().catch(() => {});
    }
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    silentCtx = new AC();
    silentOsc = silentCtx.createOscillator();
    silentGain = silentCtx.createGain();
    // Near-silent — enough for the media pipeline, inaudible in practice.
    silentGain.gain.value = 0.0001;
    silentOsc.frequency.value = 20;
    silentOsc.connect(silentGain);
    silentGain.connect(silentCtx.destination);
    silentOsc.start();
    if (silentCtx.state === "suspended") {
      silentCtx.resume().catch(() => {});
    }
  } catch {
    silentCtx = null;
    silentOsc = null;
    silentGain = null;
  }
}

function stopSilentAudioKeepalive() {
  stopSilentHtmlAudioKeepalive();
  try {
    if (silentOsc) silentOsc.stop();
  } catch {
    /* ignore */
  }
  try {
    if (silentCtx) silentCtx.close();
  } catch {
    /* ignore */
  }
  silentOsc = null;
  silentGain = null;
  silentCtx = null;
}

/** Re-pulse media pipeline after backgrounding (screen share / call resume). */
export function pulseCallWakeLock() {
  setMediaSessionActive(
    navigator.mediaSession?.metadata?.title || "Descall call",
    navigator.mediaSession?.metadata?.artist || "In call"
  );
  if (silentCtx?.state === "suspended") {
    silentCtx.resume().catch(() => {});
  }
  if (silentHtmlAudio) {
    try {
      silentHtmlAudio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  } else {
    startSilentHtmlAudioKeepalive();
  }
  if (!wakeLockSentinel && document.visibilityState === "visible") {
    void acquireScreenWakeLock();
  }
}

async function startNativeCallKeepAlive({ title, artist } = {}) {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await CallKeepAlive.start({
      title: title || "Descall",
      body: artist ? `In call with ${artist}` : "Call in progress",
    });
    nativeKeepAliveActive = true;
  } catch (err) {
    console.warn("[CallKeepAlive] native start failed:", err?.message || err);
    nativeKeepAliveActive = false;
  }
}

async function stopNativeCallKeepAlive() {
  if (!nativeKeepAliveActive && !Capacitor.isNativePlatform()) return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      await CallKeepAlive.stop();
    }
  } catch (err) {
    console.warn("[CallKeepAlive] native stop failed:", err?.message || err);
  } finally {
    nativeKeepAliveActive = false;
  }
}

/** Call once when a call starts/is accepted/is joined. */
export function acquireCallWakeLock({ title, artist } = {}) {
  setMediaSessionActive(title, artist);
  void acquireScreenWakeLock();
  startSilentAudioKeepalive();
  void startNativeCallKeepAlive({ title, artist });

  if (!reacquireOnVisible) {
    reacquireOnVisible = () => {
      if (document.visibilityState === "visible") {
        if (!wakeLockSentinel) void acquireScreenWakeLock();
        if (silentCtx?.state === "suspended") {
          silentCtx.resume().catch(() => {});
        }
        if (silentHtmlAudio) {
          silentHtmlAudio.play().catch(() => {});
        }
      } else {
        // Stay marked "playing" while hidden so Safari/Chrome are less eager
        // to suspend WebRTC during screen share app-switching.
        try {
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        } catch {
          /* ignore */
        }
        if (silentHtmlAudio) {
          silentHtmlAudio.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", reacquireOnVisible);
  }
}

/** Call once when the call fully ends (not on every temporary state change). */
export function releaseCallWakeLock() {
  clearMediaSessionActive();
  stopSilentAudioKeepalive();
  void stopNativeCallKeepAlive();
  if (reacquireOnVisible) {
    document.removeEventListener("visibilitychange", reacquireOnVisible);
    reacquireOnVisible = null;
  }
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch {
      /* ignore */
    }
    wakeLockSentinel = null;
  }
}

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
let nativeKeepAliveActive = false;

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

function startSilentAudioKeepalive() {
  if (silentCtx) return;
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

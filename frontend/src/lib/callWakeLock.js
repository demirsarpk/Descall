/**
 * Best-effort mitigation for calls dropping after the phone/tablet screen
 * locks or the device aggressively suspends a backgrounded tab.
 *
 * Two independent browser mechanisms help here:
 *  - Screen Wake Lock: keeps the display (and the JS timers / WebRTC stack
 *    tied to it) from being suspended the moment the screen would otherwise
 *    dim/lock during an active call.
 *  - Media Session: declaring an active "playing" session is how Chrome on
 *    Android decides a backgrounded tab is still doing real work and should
 *    be exempt from its normal background-tab throttling/freezing.
 *
 * Neither is a full replacement for a native foreground service (which is
 * what would be needed to keep a call fully alive while the OS aggressively
 * kills a backgrounded Android/iOS app shell), but both meaningfully extend
 * how long a call survives when the phone screen turns off or the browser
 * tab is backgrounded, and are already supported by real browsers/webviews.
 */

let wakeLockSentinel = null;
let reacquireOnVisible = null;

async function acquireScreenWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
  } catch {
    // Not available (e.g. tab not visible yet, permissions policy) — the
    // visibilitychange listener below will retry once it can.
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

/** Call once when a call starts/is accepted/is joined. */
export function acquireCallWakeLock({ title, artist } = {}) {
  setMediaSessionActive(title, artist);
  void acquireScreenWakeLock();

  if (!reacquireOnVisible) {
    reacquireOnVisible = () => {
      if (document.visibilityState === "visible" && !wakeLockSentinel) {
        void acquireScreenWakeLock();
      }
    };
    document.addEventListener("visibilitychange", reacquireOnVisible);
  }
}

/** Call once when the call fully ends (not on every temporary state change). */
export function releaseCallWakeLock() {
  clearMediaSessionActive();
  if (reacquireOnVisible) {
    document.removeEventListener("visibilitychange", reacquireOnVisible);
    reacquireOnVisible = null;
  }
  if (wakeLockSentinel) {
    try { wakeLockSentinel.release(); } catch { /* ignore */ }
    wakeLockSentinel = null;
  }
}

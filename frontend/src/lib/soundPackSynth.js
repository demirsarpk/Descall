/**
 * Catalog sound packs — premium MP3 ringtone / notification families.
 * Assets live in /public/sounds/packs/{effect_key}/
 *   incoming-call.mp3 | outgoing-call.mp3 | notification.mp3 | message.mp3
 *
 * Replaces the old Web Audio beep synths with real ringtone-quality audio.
 */

const PACK_KEYS = [
  "soft-chime",
  "crystal-ping",
  "cyber-blip",
  "deep-thud",
  "glass-lift",
  "neon-zap",
  "lofi-tap",
  "arcade-coin",
  "void-whisper",
  "ocean-drop",
  "ember-crackle",
  "frost-ting",
  "royal-bell",
  "matrix-tick",
  "pixel-beep",
  "pulse-kick",
  "silk-swipe",
  "thunder-tap",
  "star-chime",
  "copper-clang",
  "holo-ping",
  "mint-pop",
  "laser-chirp",
  "quiet-knock",
];

const ROLE_FILE = {
  preview: "notification.mp3",
  notification: "notification.mp3",
  message: "message.mp3",
  incomingCall: "incoming-call.mp3",
  outgoingCall: "outgoing-call.mp3",
  callStart: "outgoing-call.mp3",
};

function isElectron() {
  return typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);
}

function packUrl(effectKey, filename) {
  const rel = `packs/${effectKey}/${filename}`;
  if (isElectron()) return `sounds/${rel}`;
  return `/sounds/${rel}`;
}

const audioCache = new Map(); // key -> HTMLAudioElement

function cacheKey(effectKey, role) {
  return `${effectKey}::${role}`;
}

function getOrCreateAudio(effectKey, role) {
  const file = ROLE_FILE[role] || ROLE_FILE.notification;
  const key = cacheKey(effectKey, role);
  let audio = audioCache.get(key);
  if (audio) return audio;

  audio = new Audio();
  audio.preload = "auto";
  audio.src = packUrl(effectKey, file);
  audioCache.set(key, audio);
  return audio;
}

/** Warm the AudioContext / HTML5 autoplay policy (no-op friendly). */
export async function unlockSoundPackAudio() {
  if (typeof window === "undefined") return false;
  try {
    // Touch a silent buffer context if available so subsequent plays are allowed.
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!unlockSoundPackAudio._ctx) unlockSoundPackAudio._ctx = new AC();
      if (unlockSoundPackAudio._ctx.state === "suspended") {
        await unlockSoundPackAudio._ctx.resume();
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function isKnownSoundPack(key) {
  return Boolean(key && PACK_KEYS.includes(key));
}

export function listSoundPackKeys() {
  return [...PACK_KEYS];
}

/**
 * Prefetch a pack's clips (shop hover / equip).
 */
export function preloadSoundPack(effectKey) {
  if (!isKnownSoundPack(effectKey)) return;
  ["notification", "message", "incomingCall", "outgoingCall"].forEach((role) => {
    try {
      getOrCreateAudio(effectKey, role);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Play a one-shot cue for a pack.
 * @returns {boolean}
 */
export function playSoundPackCue(effectKey, role = "preview", volume = 1) {
  if (!isKnownSoundPack(effectKey) || typeof Audio === "undefined") return false;
  const mapped = role === "preview" ? "notification" : role;
  try {
    const base = getOrCreateAudio(effectKey, mapped);
    // Clone so overlapping notifications don't cut each other off
    const audio = base.cloneNode(true);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    audio.addEventListener(
      "ended",
      () => {
        try {
          audio.remove();
        } catch {
          /* ignore */
        }
      },
      { once: true }
    );
    return true;
  } catch (err) {
    console.warn("[soundPack] cue failed", effectKey, err);
    return false;
  }
}

/**
 * Start a looping ringtone for a pack.
 * @returns {() => void} stop function
 */
export function startSoundPackLoop(effectKey, role = "incomingCall", volume = 1) {
  if (!isKnownSoundPack(effectKey) || typeof Audio === "undefined") return () => {};

  const mapped = role === "callStart" ? "outgoingCall" : role;
  let stopped = false;
  let audio = null;

  try {
    const base = getOrCreateAudio(effectKey, mapped);
    audio = base.cloneNode(true);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (err) {
    console.warn("[soundPack] loop failed", effectKey, err);
    return () => {};
  }

  return () => {
    if (stopped) return;
    stopped = true;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      audio.remove();
    } catch {
      /* ignore */
    }
  };
}

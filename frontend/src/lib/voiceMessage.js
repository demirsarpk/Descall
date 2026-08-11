/** Encode / decode voice duration in message content (no DB migration needed). */

const VOICE_META_RE = /^__voice__:(\d+(?:\.\d+)?)$/;

export function encodeVoiceContent(durationSec) {
  const n = Math.max(0, Math.round(Number(durationSec) || 0));
  return `__voice__:${n}`;
}

export function parseVoiceMeta(content, mediaType) {
  const isAudio = mediaType === "audio" || mediaType === "voice";
  const raw = String(content || "").trim();
  const m = raw.match(VOICE_META_RE);
  if (m) {
    return { isVoice: true, duration: Number(m[1]) || 0, text: "" };
  }
  if (isAudio) {
    return { isVoice: true, duration: null, text: "" };
  }
  return { isVoice: false, duration: null, text: content || "" };
}

export function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/mp4",
    "audio/aac",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function extensionForMime(mime) {
  if (!mime) return "webm";
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

/** Stable pseudo-random waveform from a seed string */
export function waveformFromSeed(seed, count = 28) {
  let h = 2166136261;
  const s = String(seed || "voice");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const n = (h >>> 0) / 4294967295;
    bars.push(0.22 + n * 0.7);
  }
  return bars;
}

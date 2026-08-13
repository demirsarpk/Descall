/**
 * Advanced mic noise suppression for Descall voice (group DM + server voice).
 *
 * Pipeline (best → fallback):
 *   1) GTCRN neural suppressor
 *   2) RNNoise (SIMD WASM when available)
 *   3) Speex preprocess
 *   4) DSP high-pass + soft gate + compressor
 *
 * Browser echoCancellation + autoGainControl stay on; browser noiseSuppression
 * is disabled when a neural/Speex stage is active to avoid muddy double-NS.
 */

import {
  GtcrnWorkletNode,
  NoiseGateWorkletNode,
  RnnoiseWorkletNode,
  SpeexWorkletNode,
  loadGtcrn,
  loadRnnoise,
  loadSpeex,
} from "@sapphi-red/web-noise-suppressor";
import gtcrnWasmPath from "@sapphi-red/web-noise-suppressor/gtcrn.wasm?url";
import gtcrnWorkletPath from "@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import speexWasmPath from "@sapphi-red/web-noise-suppressor/speex.wasm?url";
import speexWorkletPath from "@sapphi-red/web-noise-suppressor/speexWorklet.js?url";
import noiseGateWorkletPath from "@sapphi-red/web-noise-suppressor/noiseGateWorklet.js?url";

const STORAGE_KEY = "descall:noiseSuppressionEnabled";
const ENGINE_KEY = "descall:noiseSuppressionEngine";

/** @type {AudioContext | null} */
let sharedCtx = null;
let assetsPromise = null;
/** @type {null | { rawStream: MediaStream, processedStream: MediaStream, nodes: any[], engine: string }} */
let activeSession = null;

function readEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true; // default ON
    return raw === "1" || raw === "true";
  } catch {
    return true;
  }
}

function writeEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isNoiseSuppressionEnabled() {
  return readEnabled();
}

export function setNoiseSuppressionEnabled(enabled) {
  const next = Boolean(enabled);
  writeEnabled(next);
  window.dispatchEvent(
    new CustomEvent("descall:noise-suppression-changed", { detail: { enabled: next } })
  );
  return next;
}

export function getNoiseSuppressionEngine() {
  return activeSession?.engine || localStorage.getItem(ENGINE_KEY) || "off";
}

export function getVoiceAudioConstraints({ deviceId } = {}) {
  const neuralPreferred = isNoiseSuppressionEnabled();
  const audio = {
    echoCancellation: { ideal: true },
    // When neural NS is on, leave browser NS off to avoid double-processing.
    noiseSuppression: neuralPreferred ? { ideal: false } : { ideal: true },
    autoGainControl: { ideal: true },
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
    latency: { ideal: 0.01 },
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  // Chromium extras (ignored by other browsers)
  audio.googEchoCancellation = true;
  audio.googAutoGainControl = true;
  audio.googNoiseSuppression = !neuralPreferred;
  audio.googHighpassFilter = true;
  return { audio, video: false };
}

async function ensureAssets(ctx) {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const [gtcrnWasm, rnnoiseWasm, speexWasm] = await Promise.all([
        loadGtcrn({ url: gtcrnWasmPath }).catch(() => null),
        loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseSimdWasmPath }).catch(() => null),
        loadSpeex({ url: speexWasmPath }).catch(() => null),
      ]);
      await Promise.allSettled([
        ctx.audioWorklet.addModule(gtcrnWorkletPath),
        ctx.audioWorklet.addModule(rnnoiseWorkletPath),
        ctx.audioWorklet.addModule(speexWorkletPath),
        ctx.audioWorklet.addModule(noiseGateWorkletPath),
      ]);
      return { gtcrnWasm, rnnoiseWasm, speexWasm };
    })().catch((err) => {
      assetsPromise = null;
      throw err;
    });
  }
  return assetsPromise;
}

async function ensureContext() {
  if (sharedCtx && sharedCtx.state !== "closed") {
    if (sharedCtx.state === "suspended") {
      try {
        await sharedCtx.resume();
      } catch {
        /* ignore */
      }
    }
    return sharedCtx;
  }
  sharedCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 48000,
    latencyHint: "interactive",
  });
  if (sharedCtx.state === "suspended") {
    try {
      await sharedCtx.resume();
    } catch {
      /* ignore */
    }
  }
  return sharedCtx;
}

function buildDspFallback(ctx) {
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 80;
  highpass.Q.value = 0.7;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  return { highpass, compressor, engine: "dsp" };
}

/**
 * Wrap a raw mic MediaStream with the best available suppressor.
 * Returns a new MediaStream whose audio track is processed. Keeps raw tracks alive.
 */
export async function wrapStreamWithNoiseSuppression(rawStream) {
  if (!rawStream?.getAudioTracks?.().length) return rawStream;
  if (!isNoiseSuppressionEnabled()) return rawStream;
  if (typeof AudioWorkletNode === "undefined") return rawStream;

  disposeNoiseSuppressionSession({ stopRaw: false });

  const ctx = await ensureContext();
  const assets = await ensureAssets(ctx).catch((err) => {
    console.warn("[NoiseSuppression] Asset load failed, using DSP fallback:", err?.message || err);
    return { gtcrnWasm: null, rnnoiseWasm: null, speexWasm: null };
  });

  const source = ctx.createMediaStreamSource(rawStream);
  const destination = ctx.createMediaStreamDestination();
  const { highpass, compressor } = buildDspFallback(ctx);

  /** @type {AudioNode | null} */
  let suppressor = null;
  let engine = "dsp";

  // Prefer GTCRN (newer neural model) → RNNoise → Speex
  if (assets.gtcrnWasm) {
    try {
      suppressor = new GtcrnWorkletNode(ctx, { wasmBinary: assets.gtcrnWasm, maxChannels: 1 });
      engine = "gtcrn";
    } catch (err) {
      console.warn("[NoiseSuppression] GTCRN init failed:", err?.message || err);
    }
  }
  if (!suppressor && assets.rnnoiseWasm) {
    try {
      suppressor = new RnnoiseWorkletNode(ctx, { wasmBinary: assets.rnnoiseWasm, maxChannels: 1 });
      engine = "rnnoise";
    } catch (err) {
      console.warn("[NoiseSuppression] RNNoise init failed:", err?.message || err);
    }
  }
  if (!suppressor && assets.speexWasm) {
    try {
      suppressor = new SpeexWorkletNode(ctx, { wasmBinary: assets.speexWasm, maxChannels: 1 });
      engine = "speex";
    } catch (err) {
      console.warn("[NoiseSuppression] Speex init failed:", err?.message || err);
    }
  }

  let gate = null;
  try {
    gate = new NoiseGateWorkletNode(ctx, {
      openThreshold: -52,
      closeThreshold: -62,
      holdMs: 110,
      maxChannels: 1,
    });
  } catch {
    gate = null;
  }

  // mic → highpass → neural/speex → mild gate → compressor → destination
  source.connect(highpass);
  let node = highpass;
  if (suppressor) {
    node.connect(suppressor);
    node = suppressor;
  }
  if (gate) {
    node.connect(gate);
    node = gate;
  }
  node.connect(compressor);
  compressor.connect(destination);

  const processedStream = destination.stream;
  // Preserve mute/enable state from raw track
  const rawTrack = rawStream.getAudioTracks()[0];
  const outTrack = processedStream.getAudioTracks()[0];
  if (rawTrack && outTrack) {
    outTrack.enabled = rawTrack.enabled;
    try {
      outTrack.contentHint = "speech";
    } catch {
      /* ignore */
    }
  }

  // Keep video tracks (if any) on the outgoing stream for video calls
  const out = new MediaStream([
    ...processedStream.getAudioTracks(),
    ...rawStream.getVideoTracks(),
  ]);

  activeSession = {
    rawStream,
    processedStream: out,
    nodes: [source, highpass, suppressor, gate, compressor, destination].filter(Boolean),
    engine,
  };

  try {
    localStorage.setItem(ENGINE_KEY, engine);
  } catch {
    /* ignore */
  }

  console.info(`[NoiseSuppression] Active engine: ${engine}`);
  return out;
}

/**
 * Capture mic with optimized constraints and apply suppression when enabled.
 */
export async function acquireVoiceMicStream(extraConstraints = {}) {
  const base = getVoiceAudioConstraints({
    deviceId: extraConstraints?.audio?.deviceId?.exact || extraConstraints?.deviceId,
  });
  const constraints = {
    ...base,
    ...extraConstraints,
    audio:
      typeof extraConstraints.audio === "object"
        ? { ...base.audio, ...extraConstraints.audio }
        : base.audio,
    video: extraConstraints.video ?? false,
  };

  const raw = await navigator.mediaDevices.getUserMedia(constraints);
  try {
    raw.getAudioTracks().forEach((t) => {
      try {
        t.contentHint = "speech";
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }

  if (!isNoiseSuppressionEnabled()) return raw;

  try {
    return await wrapStreamWithNoiseSuppression(raw);
  } catch (err) {
    console.warn("[NoiseSuppression] Wrap failed, using raw mic:", err?.message || err);
    return raw;
  }
}

export function disposeNoiseSuppressionSession({ stopRaw = true } = {}) {
  if (!activeSession) return;
  const { rawStream, nodes } = activeSession;
  for (const node of nodes) {
    try {
      node.disconnect?.();
    } catch {
      /* ignore */
    }
    try {
      node.destroy?.();
    } catch {
      /* ignore */
    }
  }
  if (stopRaw && rawStream) {
    try {
      rawStream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
  }
  activeSession = null;
}

/** Sync mute flag onto both processed + raw tracks. */
export function setNoiseSuppressedTrackEnabled(enabled) {
  const on = Boolean(enabled);
  if (activeSession?.processedStream) {
    activeSession.processedStream.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }
  if (activeSession?.rawStream) {
    activeSession.rawStream.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }
}

export function preloadNoiseSuppression() {
  if (!isNoiseSuppressionEnabled()) return;
  ensureContext()
    .then((ctx) => ensureAssets(ctx))
    .catch(() => {});
}

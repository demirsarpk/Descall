/**
 * Unique Web Audio synthesizers for each catalog sound_pack effect_key.
 * Each pack has its own timbre + motif for message / notification / call / preview.
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

let sharedCtx = null;
let unlocked = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

export async function unlockSoundPackAudio() {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    unlocked = ctx.state === "running";
  } catch {
    unlocked = false;
  }
  return unlocked;
}

function ensureRunning(ctx) {
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return true;
}

function envGain(ctx, t0, peak, attack, decay, sustain = 0.0001) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + attack + decay);
  return g;
}

function tone(ctx, dest, { type = "sine", freq = 440, t0, dur = 0.2, peak = 0.2, attack = 0.01, decay = 0.18 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  const g = envGain(ctx, t0, peak, attack, decay);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + dur);
  return o;
}

function noiseBurst(ctx, dest, { t0, dur = 0.12, peak = 0.15, band = 1200, q = 2 }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = band;
  filter.Q.value = q;
  const g = envGain(ctx, t0, peak, 0.005, dur * 0.9);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + dur);
}

/** Per-pack one-shot voice builders. Role: preview|message|notification|incomingCall|outgoingCall */
const PACK_VOICES = {
  "soft-chime": (ctx, dest, role, t0) => {
    const base = role === "notification" ? 523.25 : role === "incomingCall" ? 392 : 440;
    [0, 4, 7].forEach((semi, i) => {
      tone(ctx, dest, {
        type: "sine",
        freq: base * 2 ** (semi / 12),
        t0: t0 + i * 0.07,
        dur: 0.45,
        peak: 0.16 - i * 0.02,
        attack: 0.02,
        decay: 0.4,
      });
    });
  },
  "crystal-ping": (ctx, dest, role, t0) => {
    const f = role === "message" ? 1760 : role === "notification" ? 2093 : 1480;
    tone(ctx, dest, { type: "triangle", freq: f, t0, dur: 0.35, peak: 0.14, attack: 0.002, decay: 0.32 });
    tone(ctx, dest, { type: "sine", freq: f * 2.01, t0, dur: 0.22, peak: 0.05, attack: 0.001, decay: 0.2 });
  },
  "cyber-blip": (ctx, dest, role, t0) => {
    const f = role === "outgoingCall" ? 220 : 660;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 1.8, t0 + 0.08);
    const g = envGain(ctx, t0, 0.09, 0.005, 0.12);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.16);
  },
  "deep-thud": (ctx, dest, role, t0) => {
    const f = role === "notification" ? 90 : 70;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 2.2, t0);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.12);
    const g = envGain(ctx, t0, 0.35, 0.005, 0.28);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.35);
  },
  "glass-lift": (ctx, dest, role, t0) => {
    const start = role === "message" ? 880 : 660;
    [0, 0.05, 0.1].forEach((dt, i) => {
      tone(ctx, dest, {
        type: "sine",
        freq: start * (1 + i * 0.5),
        t0: t0 + dt,
        dur: 0.4,
        peak: 0.1,
        attack: 0.01,
        decay: 0.35,
      });
    });
  },
  "neon-zap": (ctx, dest, role, t0) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f0 = role === "incomingCall" ? 420 : 880;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4000, t0);
    filter.frequency.exponentialRampToValueAtTime(400, t0 + 0.18);
    const g = envGain(ctx, t0, 0.12, 0.005, 0.2);
    o.connect(filter);
    filter.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.22);
  },
  "lofi-tap": (ctx, dest, role, t0) => {
    noiseBurst(ctx, dest, { t0, dur: 0.08, peak: 0.08, band: 900, q: 0.8 });
    tone(ctx, dest, {
      type: "triangle",
      freq: role === "notification" ? 196 : 165,
      t0,
      dur: 0.2,
      peak: 0.12,
      attack: 0.01,
      decay: 0.18,
    });
  },
  "arcade-coin": (ctx, dest, _role, t0) => {
    tone(ctx, dest, { type: "square", freq: 988, t0, dur: 0.08, peak: 0.08, attack: 0.001, decay: 0.07 });
    tone(ctx, dest, { type: "square", freq: 1319, t0: t0 + 0.07, dur: 0.18, peak: 0.08, attack: 0.001, decay: 0.16 });
  },
  "void-whisper": (ctx, dest, role, t0) => {
    noiseBurst(ctx, dest, { t0, dur: 0.35, peak: 0.06, band: 400, q: 0.5 });
    tone(ctx, dest, {
      type: "sine",
      freq: role === "incomingCall" ? 110 : 146,
      t0,
      dur: 0.5,
      peak: 0.1,
      attack: 0.08,
      decay: 0.45,
    });
  },
  "ocean-drop": (ctx, dest, role, t0) => {
    const f = role === "message" ? 520 : 440;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + 0.25);
    const g = envGain(ctx, t0, 0.14, 0.01, 0.3);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.32);
    noiseBurst(ctx, dest, { t0: t0 + 0.02, dur: 0.1, peak: 0.04, band: 600, q: 1.2 });
  },
  "ember-crackle": (ctx, dest, _role, t0) => {
    [0, 0.04, 0.09, 0.13].forEach((dt) => {
      noiseBurst(ctx, dest, {
        t0: t0 + dt,
        dur: 0.05,
        peak: 0.1,
        band: 1800 + Math.random() * 800,
        q: 3,
      });
    });
    tone(ctx, dest, { type: "triangle", freq: 120, t0, dur: 0.25, peak: 0.08, attack: 0.01, decay: 0.22 });
  },
  "frost-ting": (ctx, dest, role, t0) => {
    const f = role === "notification" ? 2349 : 1976;
    tone(ctx, dest, { type: "sine", freq: f, t0, dur: 0.5, peak: 0.1, attack: 0.001, decay: 0.48 });
    tone(ctx, dest, { type: "sine", freq: f * 1.5, t0, dur: 0.3, peak: 0.04, attack: 0.001, decay: 0.28 });
  },
  "royal-bell": (ctx, dest, role, t0) => {
    const f = role === "incomingCall" ? 311 : 349;
    [1, 2.0, 3.01, 4.2].forEach((mult, i) => {
      tone(ctx, dest, {
        type: "sine",
        freq: f * mult,
        t0,
        dur: 0.7 - i * 0.08,
        peak: 0.12 / (i + 1),
        attack: 0.01,
        decay: 0.65,
      });
    });
  },
  "matrix-tick": (ctx, dest, role, t0) => {
    const steps = role === "incomingCall" ? 4 : 3;
    for (let i = 0; i < steps; i++) {
      tone(ctx, dest, {
        type: "square",
        freq: 880 + i * 40,
        t0: t0 + i * 0.06,
        dur: 0.04,
        peak: 0.06,
        attack: 0.001,
        decay: 0.035,
      });
    }
  },
  "pixel-beep": (ctx, dest, role, t0) => {
    tone(ctx, dest, {
      type: "square",
      freq: role === "message" ? 784 : 659,
      t0,
      dur: 0.1,
      peak: 0.08,
      attack: 0.001,
      decay: 0.09,
    });
  },
  "pulse-kick": (ctx, dest, _role, t0) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t0);
    o.frequency.exponentialRampToValueAtTime(48, t0 + 0.15);
    const g = envGain(ctx, t0, 0.4, 0.004, 0.2);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.22);
  },
  "silk-swipe": (ctx, dest, _role, t0) => {
    noiseBurst(ctx, dest, { t0, dur: 0.28, peak: 0.1, band: 2200, q: 0.7 });
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(600, t0);
    o.frequency.exponentialRampToValueAtTime(240, t0 + 0.25);
    const g = envGain(ctx, t0, 0.08, 0.02, 0.25);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.28);
  },
  "thunder-tap": (ctx, dest, _role, t0) => {
    noiseBurst(ctx, dest, { t0, dur: 0.2, peak: 0.16, band: 180, q: 0.6 });
    tone(ctx, dest, { type: "sine", freq: 55, t0, dur: 0.35, peak: 0.28, attack: 0.005, decay: 0.32 });
  },
  "star-chime": (ctx, dest, role, t0) => {
    const notes = role === "notification" ? [1046, 1318, 1568] : [784, 988, 1174, 1480];
    notes.forEach((f, i) => {
      tone(ctx, dest, {
        type: "sine",
        freq: f,
        t0: t0 + i * 0.05,
        dur: 0.4,
        peak: 0.08,
        attack: 0.005,
        decay: 0.35,
      });
    });
  },
  "copper-clang": (ctx, dest, _role, t0) => {
    [440, 553, 687, 910].forEach((f, i) => {
      tone(ctx, dest, {
        type: "triangle",
        freq: f,
        t0,
        dur: 0.35,
        peak: 0.07 / (i + 1),
        attack: 0.002,
        decay: 0.3,
      });
    });
  },
  "holo-ping": (ctx, dest, role, t0) => {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    carrier.type = "sine";
    mod.type = "sine";
    const f = role === "message" ? 740 : 920;
    carrier.frequency.setValueAtTime(f, t0);
    mod.frequency.setValueAtTime(f * 2.2, t0);
    modGain.gain.setValueAtTime(f * 0.6, t0);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    const g = envGain(ctx, t0, 0.12, 0.005, 0.28);
    carrier.connect(g);
    g.connect(dest);
    carrier.start(t0);
    mod.start(t0);
    carrier.stop(t0 + 0.32);
    mod.stop(t0 + 0.32);
  },
  "mint-pop": (ctx, dest, _role, t0) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(720, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.08);
    const g = envGain(ctx, t0, 0.18, 0.002, 0.1);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.12);
  },
  "laser-chirp": (ctx, dest, role, t0) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const hi = role === "outgoingCall" ? 1400 : 1800;
    o.frequency.setValueAtTime(hi, t0);
    o.frequency.exponentialRampToValueAtTime(280, t0 + 0.16);
    const g = envGain(ctx, t0, 0.1, 0.005, 0.15);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + 0.18);
  },
  "quiet-knock": (ctx, dest, _role, t0) => {
    [0, 0.09].forEach((dt) => {
      noiseBurst(ctx, dest, { t0: t0 + dt, dur: 0.05, peak: 0.12, band: 350, q: 1.5 });
      tone(ctx, dest, {
        type: "sine",
        freq: 140,
        t0: t0 + dt,
        dur: 0.08,
        peak: 0.15,
        attack: 0.002,
        decay: 0.07,
      });
    });
  },
};

export function isKnownSoundPack(key) {
  return Boolean(key && PACK_VOICES[key]);
}

export function listSoundPackKeys() {
  return [...PACK_KEYS];
}

/**
 * Play a one-shot cue for a pack.
 * @returns {boolean}
 */
export function playSoundPackCue(effectKey, role = "preview", volume = 1) {
  const voice = PACK_VOICES[effectKey];
  const ctx = getCtx();
  if (!voice || !ctx || !ensureRunning(ctx)) return false;

  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume)) * 0.9;
  master.connect(ctx.destination);

  const t0 = ctx.currentTime + 0.01;
  try {
    voice(ctx, master, role, t0);
  } catch (err) {
    console.warn("[soundPackSynth] cue failed", effectKey, err);
    return false;
  }
  return true;
}

/**
 * Start a looping ringtone-style pattern for a pack.
 * @returns {() => void} stop function
 */
export function startSoundPackLoop(effectKey, role = "incomingCall", volume = 1) {
  const voice = PACK_VOICES[effectKey];
  const ctx = getCtx();
  if (!voice || !ctx || !ensureRunning(ctx)) return () => {};

  let stopped = false;
  let timer = null;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume)) * 0.85;
  master.connect(ctx.destination);

  const interval = role === "outgoingCall" ? 1400 : 1600;

  const tick = () => {
    if (stopped) return;
    try {
      voice(ctx, master, role, ctx.currentTime + 0.01);
    } catch {
      /* ignore */
    }
    timer = setTimeout(tick, interval);
  };
  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    try {
      master.disconnect();
    } catch {
      /* ignore */
    }
  };
}

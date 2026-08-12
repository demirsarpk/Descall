#!/usr/bin/env python3
"""
Generate premium Descall sound-pack assets (ringtone + notification + message).

Each pack is designed as a real phone ringtone / OS notification family —
additive harmonics, soft envelopes, dual-tone rings — not 8-bit beeps.
"""

from __future__ import annotations

import math
import os
import struct
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT_ROOT = Path(__file__).resolve().parents[1] / "public" / "sounds" / "packs"


def clamp(x, lo=-1.0, hi=1.0):
    return np.clip(x, lo, hi).astype(np.float64)


def fade(n, attack=0.01, release=0.05, sr=SR):
    env = np.ones(n, dtype=np.float64)
    a = max(1, int(attack * sr))
    r = max(1, int(release * sr))
    if a < n:
        env[:a] *= np.linspace(0, 1, a, endpoint=False)
    else:
        env *= np.linspace(0, 1, n, endpoint=False)
        return env
    if r < n:
        env[-r:] *= np.linspace(1, 0, r)
    return env


def adsr(n, a=0.01, d=0.08, s=0.55, r=0.18, sr=SR):
    env = np.zeros(n, dtype=np.float64)
    ia, idc, ir = int(a * sr), int(d * sr), int(r * sr)
    isus = max(0, n - ia - idc - ir)
    i = 0
    if ia:
        env[i : i + ia] = np.linspace(0, 1, ia, endpoint=False)
        i += ia
    if idc:
        env[i : i + idc] = np.linspace(1, s, idc, endpoint=False)
        i += idc
    if isus:
        env[i : i + isus] = s
        i += isus
    if ir and i < n:
        rem = n - i
        env[i:] = np.linspace(s if rem == ir else env[i - 1] if i else s, 0, rem)
    return env


def sine(freq, dur, sr=SR, phase=0.0):
    t = np.arange(int(dur * sr), dtype=np.float64) / sr
    return np.sin(2 * math.pi * freq * t + phase)


def tone(freq, dur, amp=0.25, harmonics=((1.0, 1.0),), a=0.01, d=0.06, s=0.5, r=0.2, detune=0.0):
    n = int(dur * SR)
    out = np.zeros(n, dtype=np.float64)
    for mult, weight in harmonics:
        f = freq * mult * (1.0 + detune)
        out += weight * sine(f, dur)
    out *= adsr(n, a, d, s, r) * amp
    return out


def mix(*parts, gap=0.0):
    if not parts:
        return np.zeros(1, dtype=np.float64)
    if gap <= 0:
        n = max(len(p) for p in parts)
        out = np.zeros(n, dtype=np.float64)
        for p in parts:
            out[: len(p)] += p
        return out
    silence = np.zeros(int(gap * SR), dtype=np.float64)
    chunks = []
    for i, p in enumerate(parts):
        chunks.append(p)
        if i < len(parts) - 1:
            chunks.append(silence)
    return np.concatenate(chunks)


def place(base, clip, at_sec):
    i = int(at_sec * SR)
    n = len(clip)
    if i + n > len(base):
        base = np.pad(base, (0, i + n - len(base)))
    base[i : i + n] += clip
    return base


def soft_noise(dur, amp=0.02, color=0.92):
    n = int(dur * SR)
    x = np.random.randn(n).astype(np.float64)
    # one-pole lowpass for soft "air"
    y = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        y[i] = color * y[i - 1] + (1 - color) * x[i]
    y *= fade(n, 0.01, 0.05) * amp
    return y


def normalize(x, peak=0.88):
    m = np.max(np.abs(x)) if len(x) else 0
    if m < 1e-9:
        return x
    return x * (peak / m)


def write_wav(path: Path, audio: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    audio = normalize(clamp(audio))
    pcm = (audio * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def wav_to_mp3(wav_path: Path, mp3_path: Path):
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(wav_path),
        "-codec:a",
        "libmp3lame",
        "-qscale:a",
        "4",
        str(mp3_path),
    ]
    subprocess.check_call(cmd)


# ── harmonic presets (bell / phone / soft UI) ──────────────────────────
BELL = ((1, 1.0), (2, 0.45), (2.76, 0.18), (3.9, 0.08), (5.4, 0.04))
SOFT_BELL = ((1, 1.0), (2.01, 0.35), (3.02, 0.12), (4.1, 0.05))
WARM = ((1, 1.0), (2, 0.28), (3, 0.1), (4, 0.04))
BRIGHT = ((1, 1.0), (2, 0.55), (3, 0.22), (4.5, 0.08))
DEEP = ((1, 1.0), (1.5, 0.2), (2, 0.35), (3, 0.08))
GLASS = ((1, 1.0), (2.4, 0.3), (3.6, 0.14), (5.2, 0.06))
METAL = ((1, 1.0), (1.41, 0.35), (2.12, 0.22), (2.83, 0.12), (4.0, 0.06))


def dual_tone_ring(f1, f2, on=0.4, off=0.2, cycles=3, amp=0.22, harm=WARM):
    """Classic phone-style cadence: tone pair on/off."""
    parts = []
    for _ in range(cycles):
        a = tone(f1, on, amp=amp * 0.7, harmonics=harm, a=0.02, d=0.05, s=0.7, r=0.08)
        b = tone(f2, on, amp=amp * 0.55, harmonics=harm, a=0.02, d=0.05, s=0.7, r=0.08, detune=0.0015)
        parts.append(mix(a, b))
        parts.append(np.zeros(int(off * SR)))
    return np.concatenate(parts)


def melody_ring(freqs, note_dur=0.28, gap=0.04, cycles=2, amp=0.2, harm=SOFT_BELL):
    phrase = []
    for f in freqs:
        phrase.append(tone(f, note_dur, amp=amp, harmonics=harm, a=0.012, d=0.05, s=0.55, r=0.16))
        phrase.append(np.zeros(int(gap * SR)))
    one = np.concatenate(phrase)
    pause = np.zeros(int(0.35 * SR))
    return np.concatenate([one, pause] * cycles)


def notif_ping(freqs, note=0.12, gap=0.05, amp=0.2, harm=SOFT_BELL):
    parts = []
    for i, f in enumerate(freqs):
        parts.append(
            tone(
                f,
                note + i * 0.02,
                amp=amp * (1 - i * 0.12),
                harmonics=harm,
                a=0.004,
                d=0.04,
                s=0.35,
                r=0.18,
            )
        )
        if i < len(freqs) - 1:
            parts.append(np.zeros(int(gap * SR)))
    return np.concatenate(parts)


def msg_tap(freq, amp=0.16, harm=SOFT_BELL):
    return tone(freq, 0.18, amp=amp, harmonics=harm, a=0.004, d=0.03, s=0.3, r=0.14)


def ringback(f1=440, f2=480, amp=0.16):
    """Outgoing: soft ringback cadence."""
    return dual_tone_ring(f1, f2, on=0.85, off=0.85, cycles=2, amp=amp, harm=WARM)


# ── per-pack designers ─────────────────────────────────────────────────
# Each returns dict: incoming, outgoing, notification, message

def pack_soft_chime():
    return {
        "incoming": melody_ring([523.25, 659.25, 783.99, 659.25], 0.26, 0.05, 2, 0.2, SOFT_BELL),
        "outgoing": ringback(392, 494),
        "notification": notif_ping([659.25, 880], 0.14, 0.06, 0.2, SOFT_BELL),
        "message": msg_tap(698.46, 0.15, SOFT_BELL),
    }


def pack_crystal_ping():
    return {
        "incoming": melody_ring([1046.5, 1318.5, 1568, 2093], 0.22, 0.03, 2, 0.17, BRIGHT),
        "outgoing": ringback(523, 659),
        "notification": notif_ping([1568, 2093], 0.12, 0.04, 0.18, BRIGHT),
        "message": msg_tap(1760, 0.14, BRIGHT),
    }


def pack_cyber_blip():
    # Modern digital ring — filtered dual tones, not square beeps
    inc = dual_tone_ring(740, 932, on=0.32, off=0.18, cycles=5, amp=0.18, harm=BRIGHT)
    return {
        "incoming": inc,
        "outgoing": dual_tone_ring(554, 698, on=0.7, off=0.7, cycles=2, amp=0.15, harm=WARM),
        "notification": notif_ping([880, 1174.7], 0.1, 0.04, 0.17, BRIGHT),
        "message": msg_tap(987.77, 0.14, BRIGHT),
    }


def pack_deep_thud():
    body = dual_tone_ring(196, 246.94, on=0.45, off=0.25, cycles=3, amp=0.28, harm=DEEP)
    return {
        "incoming": body + soft_noise(len(body) / SR, 0.01, 0.96)[: len(body)],
        "outgoing": ringback(220, 277),
        "notification": notif_ping([246.94, 329.63], 0.16, 0.07, 0.22, DEEP),
        "message": msg_tap(196, 0.2, DEEP),
    }


def pack_glass_lift():
    return {
        "incoming": melody_ring([659.25, 880, 1174.7, 1318.5], 0.24, 0.04, 2, 0.18, GLASS),
        "outgoing": ringback(440, 554),
        "notification": notif_ping([1174.7, 1568], 0.13, 0.05, 0.17, GLASS),
        "message": msg_tap(987.77, 0.14, GLASS),
    }


def pack_neon_zap():
    # Smooth modern electronic melody (sine layers), not harsh saw
    return {
        "incoming": melody_ring([440, 554.37, 659.25, 830.61, 659.25], 0.2, 0.03, 2, 0.19, BRIGHT),
        "outgoing": dual_tone_ring(415, 523, on=0.6, off=0.6, cycles=2, amp=0.15, harm=WARM),
        "notification": notif_ping([830.61, 1108.7], 0.11, 0.04, 0.17, BRIGHT),
        "message": msg_tap(740, 0.14, BRIGHT),
    }


def pack_lofi_tap():
    inc = melody_ring([349.23, 415.3, 466.16, 415.3], 0.3, 0.06, 2, 0.17, WARM)
    noise = soft_noise(len(inc) / SR, 0.025, 0.97)
    return {
        "incoming": normalize(inc + noise[: len(inc)], 0.85),
        "outgoing": ringback(311, 392),
        "notification": notif_ping([392, 493.88], 0.15, 0.07, 0.16, WARM),
        "message": mix(msg_tap(349.23, 0.14, WARM), soft_noise(0.12, 0.02, 0.96)[: int(0.12 * SR)]),
    }


def pack_arcade_coin():
    # Polished bright motif — not chiptune squares
    return {
        "incoming": melody_ring([784, 988, 1175, 1319, 1568], 0.16, 0.03, 2, 0.16, BRIGHT),
        "outgoing": ringback(523, 659),
        "notification": notif_ping([988, 1319], 0.1, 0.04, 0.16, BRIGHT),
        "message": notif_ping([1047], 0.12, 0.0, 0.15, BRIGHT),
    }


def pack_void_whisper():
    base = dual_tone_ring(146.83, 174.61, on=0.55, off=0.35, cycles=3, amp=0.2, harm=DEEP)
    air = soft_noise(len(base) / SR, 0.035, 0.985)
    shimmer = tone(587.33, len(base) / SR, amp=0.04, harmonics=SOFT_BELL, a=0.2, d=0.3, s=0.3, r=0.4)
    return {
        "incoming": normalize(base + air[: len(base)] + shimmer[: len(base)], 0.86),
        "outgoing": ringback(164.81, 196),
        "notification": notif_ping([220, 277.18], 0.18, 0.08, 0.15, DEEP),
        "message": msg_tap(174.61, 0.14, DEEP),
    }


def pack_ocean_drop():
    drop = tone(523.25, 0.45, amp=0.18, harmonics=SOFT_BELL, a=0.01, d=0.08, s=0.4, r=0.35)
    # gentle downward glide via overlapping lower tone
    drop2 = tone(392, 0.5, amp=0.1, harmonics=WARM, a=0.05, d=0.1, s=0.35, r=0.35)
    phrase = mix(drop, place(np.zeros(len(drop2)), drop2, 0.08))
    pause = np.zeros(int(0.4 * SR))
    inc = np.concatenate([phrase, pause, phrase, pause])
    return {
        "incoming": normalize(inc + soft_noise(len(inc) / SR, 0.015, 0.98)[: len(inc)], 0.86),
        "outgoing": ringback(349, 440),
        "notification": notif_ping([440, 554.37], 0.14, 0.06, 0.16, SOFT_BELL),
        "message": msg_tap(493.88, 0.14, SOFT_BELL),
    }


def pack_ember_crackle():
    return {
        "incoming": melody_ring([293.66, 349.23, 440, 523.25, 440], 0.24, 0.04, 2, 0.19, WARM),
        "outgoing": ringback(277, 349),
        "notification": notif_ping([440, 554.37], 0.13, 0.05, 0.17, WARM),
        "message": msg_tap(392, 0.15, WARM),
    }


def pack_frost_ting():
    return {
        "incoming": melody_ring([1174.7, 1396.9, 1760, 2093], 0.22, 0.03, 2, 0.15, BRIGHT),
        "outgoing": ringback(587, 740),
        "notification": notif_ping([1760, 2349], 0.11, 0.04, 0.15, BRIGHT),
        "message": msg_tap(1975.5, 0.12, BRIGHT),
    }


def pack_royal_bell():
    strike = tone(311.13, 1.1, amp=0.22, harmonics=BELL, a=0.008, d=0.15, s=0.45, r=0.7)
    strike2 = tone(415.3, 1.0, amp=0.16, harmonics=BELL, a=0.01, d=0.15, s=0.4, r=0.65)
    gap = np.zeros(int(0.55 * SR))
    inc = np.concatenate([strike, gap, strike2, gap])
    return {
        "incoming": inc,
        "outgoing": ringback(311, 392),
        "notification": notif_ping([415.3, 523.25], 0.2, 0.08, 0.18, BELL),
        "message": msg_tap(349.23, 0.16, BELL),
    }


def pack_matrix_tick():
    ticks = []
    for i in range(6):
        ticks.append(tone(880 + i * 30, 0.07, amp=0.12, harmonics=BRIGHT, a=0.002, d=0.02, s=0.25, r=0.05))
        ticks.append(np.zeros(int(0.09 * SR)))
    phrase = np.concatenate(ticks)
    pause = np.zeros(int(0.45 * SR))
    return {
        "incoming": np.concatenate([phrase, pause, phrase, pause]),
        "outgoing": dual_tone_ring(698, 880, on=0.55, off=0.55, cycles=2, amp=0.14, harm=BRIGHT),
        "notification": notif_ping([988, 1175], 0.08, 0.03, 0.15, BRIGHT),
        "message": msg_tap(1047, 0.1, BRIGHT),
    }


def pack_pixel_beep():
    # Retro-inspired but softened (triangle-like via odd harmonics, not square)
    soft_sq = ((1, 1.0), (3, 0.22), (5, 0.08))
    return {
        "incoming": melody_ring([659.25, 783.99, 880, 783.99], 0.18, 0.04, 3, 0.14, soft_sq),
        "outgoing": ringback(523, 659),
        "notification": notif_ping([784, 988], 0.1, 0.04, 0.14, soft_sq),
        "message": msg_tap(698.46, 0.12, soft_sq),
    }


def pack_pulse_kick():
    kick = dual_tone_ring(180, 240, on=0.22, off=0.18, cycles=5, amp=0.26, harm=DEEP)
    return {
        "incoming": kick,
        "outgoing": ringback(200, 250),
        "notification": notif_ping([220, 330], 0.12, 0.05, 0.2, DEEP),
        "message": msg_tap(196, 0.18, DEEP),
    }


def pack_silk_swipe():
    whoosh = soft_noise(0.42, 0.06, 0.9) * fade(int(0.42 * SR), 0.05, 0.14)
    glide = tone(640, 0.42, amp=0.1, harmonics=SOFT_BELL, a=0.04, d=0.08, s=0.4, r=0.22)
    glide2 = tone(420, 0.42, amp=0.07, harmonics=WARM, a=0.06, d=0.1, s=0.35, r=0.2)
    chime = tone(880, 0.35, amp=0.08, harmonics=SOFT_BELL, a=0.02, d=0.06, s=0.35, r=0.25)
    swipe = mix(whoosh, glide, glide2, place(np.zeros(int(0.42 * SR)), chime, 0.08))
    pause = np.zeros(int(0.45 * SR))
    return {
        "incoming": np.concatenate([swipe, pause, swipe, pause, swipe, pause]),
        "outgoing": ringback(392, 494),
        "notification": mix(soft_noise(0.2, 0.03, 0.92), notif_ping([659.25], 0.16, 0.0, 0.14, SOFT_BELL)),
        "message": mix(soft_noise(0.12, 0.02, 0.93), msg_tap(587.33, 0.12, SOFT_BELL)),
    }


def pack_thunder_tap():
    boom = tone(70, 0.55, amp=0.32, harmonics=DEEP, a=0.005, d=0.1, s=0.4, r=0.4)
    rumble = soft_noise(0.55, 0.08, 0.98)
    hit = normalize(boom + rumble[: len(boom)], 0.9)
    gap = np.zeros(int(0.55 * SR))
    return {
        "incoming": np.concatenate([hit, gap, hit, gap]),
        "outgoing": ringback(185, 233),
        "notification": mix(tone(98, 0.25, amp=0.22, harmonics=DEEP, a=0.005, d=0.06, s=0.3, r=0.18), soft_noise(0.2, 0.04, 0.97)[: int(0.2 * SR)]),
        "message": msg_tap(130.81, 0.18, DEEP),
    }


def pack_star_chime():
    return {
        "incoming": melody_ring([784, 988, 1175, 1480, 1760], 0.2, 0.03, 2, 0.16, BRIGHT),
        "outgoing": ringback(523, 659),
        "notification": notif_ping([1047, 1319, 1568], 0.1, 0.04, 0.15, BRIGHT),
        "message": msg_tap(1175, 0.13, BRIGHT),
    }


def pack_copper_clang():
    clang = tone(440, 0.7, amp=0.2, harmonics=METAL, a=0.003, d=0.08, s=0.4, r=0.5)
    clang2 = tone(554.37, 0.65, amp=0.14, harmonics=METAL, a=0.004, d=0.08, s=0.35, r=0.45)
    gap = np.zeros(int(0.4 * SR))
    return {
        "incoming": np.concatenate([clang, gap, clang2, gap]),
        "outgoing": ringback(349, 440),
        "notification": notif_ping([493.88, 622.25], 0.14, 0.05, 0.16, METAL),
        "message": msg_tap(440, 0.14, METAL),
    }


def pack_holo_ping():
    # Soft shimmer via close detuned layers
    def holo(f, dur, amp=0.14):
        return mix(
            tone(f, dur, amp=amp, harmonics=SOFT_BELL, a=0.01, d=0.06, s=0.45, r=0.25),
            tone(f * 1.004, dur, amp=amp * 0.7, harmonics=SOFT_BELL, a=0.01, d=0.06, s=0.4, r=0.25),
            tone(f * 2.01, dur, amp=amp * 0.25, harmonics=((1, 1),), a=0.01, d=0.05, s=0.3, r=0.2),
        )

    phrase = mix(
        place(np.zeros(int(1.2 * SR)), holo(740, 0.4), 0.0),
        place(np.zeros(int(1.2 * SR)), holo(920, 0.35, 0.12), 0.22),
        place(np.zeros(int(1.2 * SR)), holo(1100, 0.3, 0.1), 0.42),
    )
    pause = np.zeros(int(0.4 * SR))
    return {
        "incoming": np.concatenate([phrase, pause, phrase, pause]),
        "outgoing": ringback(466, 587),
        "notification": notif_ping([920, 1108], 0.12, 0.05, 0.15, SOFT_BELL),
        "message": msg_tap(830.61, 0.13, SOFT_BELL),
    }


def pack_mint_pop():
    # Fresh ringtone motif — bright ascending pops with cadence
    return {
        "incoming": melody_ring([587.33, 698.46, 880, 1046.5, 880], 0.2, 0.05, 3, 0.16, SOFT_BELL),
        "outgoing": ringback(440, 554),
        "notification": notif_ping([698.46, 880], 0.1, 0.04, 0.16, SOFT_BELL),
        "message": msg_tap(659.25, 0.12, SOFT_BELL),
    }


def pack_laser_chirp():
    # Smooth exponential sine chirp (not saw) — ringtone cadence
    def chirp(f0, f1, dur, amp=0.16):
        n = int(dur * SR)
        t = np.arange(n) / SR
        freqs = f0 * (f1 / f0) ** (t / max(dur, 1e-6))
        phase = 2 * math.pi * np.cumsum(freqs) / SR
        wave = np.sin(phase) * adsr(n, 0.01, 0.05, 0.5, 0.12) * amp
        wave += 0.25 * np.sin(2 * phase) * adsr(n, 0.01, 0.04, 0.35, 0.1) * amp
        return wave

    double = np.concatenate([chirp(1600, 420, 0.26, 0.15), np.zeros(int(0.08 * SR)), chirp(1400, 380, 0.24, 0.13)])
    gap = np.zeros(int(0.4 * SR))
    return {
        "incoming": np.concatenate([double, gap, double, gap]),
        "outgoing": ringback(494, 622),
        "notification": chirp(1400, 700, 0.16, 0.14),
        "message": chirp(1200, 600, 0.12, 0.12),
    }


def pack_quiet_knock():
    def knock():
        body = tone(140, 0.09, amp=0.2, harmonics=DEEP, a=0.002, d=0.02, s=0.25, r=0.06)
        tip = soft_noise(0.07, 0.05, 0.88) * fade(int(0.07 * SR), 0.002, 0.04)
        return mix(body, tip[: len(body)])

    # Soft door-knock ringtone + warm dual-tone bed so it still reads as a call
    double = np.concatenate([knock(), np.zeros(int(0.1 * SR)), knock()])
    bed = dual_tone_ring(196, 246.94, on=0.35, off=0.55, cycles=3, amp=0.1, harm=WARM)
    gap = np.zeros(int(0.35 * SR))
    phrase = mix(place(np.zeros(max(len(bed), len(double) + int(0.2 * SR))), bed, 0.0), place(np.zeros(len(bed)), double, 0.05))
    return {
        "incoming": np.concatenate([phrase, gap, phrase]),
        "outgoing": ringback(220, 277),
        "notification": double,
        "message": knock(),
    }


PACKS = {
    "soft-chime": pack_soft_chime,
    "crystal-ping": pack_crystal_ping,
    "cyber-blip": pack_cyber_blip,
    "deep-thud": pack_deep_thud,
    "glass-lift": pack_glass_lift,
    "neon-zap": pack_neon_zap,
    "lofi-tap": pack_lofi_tap,
    "arcade-coin": pack_arcade_coin,
    "void-whisper": pack_void_whisper,
    "ocean-drop": pack_ocean_drop,
    "ember-crackle": pack_ember_crackle,
    "frost-ting": pack_frost_ting,
    "royal-bell": pack_royal_bell,
    "matrix-tick": pack_matrix_tick,
    "pixel-beep": pack_pixel_beep,
    "pulse-kick": pack_pulse_kick,
    "silk-swipe": pack_silk_swipe,
    "thunder-tap": pack_thunder_tap,
    "star-chime": pack_star_chime,
    "copper-clang": pack_copper_clang,
    "holo-ping": pack_holo_ping,
    "mint-pop": pack_mint_pop,
    "laser-chirp": pack_laser_chirp,
    "quiet-knock": pack_quiet_knock,
}

ROLE_FILES = {
    "incoming": "incoming-call.mp3",
    "outgoing": "outgoing-call.mp3",
    "notification": "notification.mp3",
    "message": "message.mp3",
}


def build_pack(key: str):
    designer = PACKS[key]
    clips = designer()
    pack_dir = OUT_ROOT / key
    pack_dir.mkdir(parents=True, exist_ok=True)
    tmp = pack_dir / "_tmp"
    tmp.mkdir(exist_ok=True)
    for role, filename in ROLE_FILES.items():
        audio = clips[role]
        wav_path = tmp / f"{role}.wav"
        mp3_path = pack_dir / filename
        write_wav(wav_path, audio)
        wav_to_mp3(wav_path, mp3_path)
        print(f"  {key}/{filename}  ({len(audio)/SR:.2f}s)")
    # cleanup wavs
    for p in tmp.glob("*.wav"):
        p.unlink()
    tmp.rmdir()


def main():
    np.random.seed(42)
    only = sys.argv[1:] if len(sys.argv) > 1 else list(PACKS.keys())
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    for key in only:
        if key not in PACKS:
            print(f"unknown pack: {key}", file=sys.stderr)
            continue
        print(f"Generating {key}…")
        build_pack(key)
    print(f"Done. Wrote packs to {OUT_ROOT}")


if __name__ == "__main__":
    main()

import { useEffect, useState } from "react";

/**
 * Voice-activity detector with hysteresis + hold times to avoid green flicker.
 *
 * - Needs ~attackMs above onThreshold to turn ON
 * - Needs ~releaseMs below offThreshold to turn OFF
 */
export default function useSpeaking(
  stream,
  {
    muted = false,
    threshold = 0.02,
    onThreshold,
    offThreshold,
    attackMs = 90,
    releaseMs = 220,
  } = {}
) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (muted || !stream) {
      setSpeaking(false);
      return undefined;
    }

    const track = stream.getAudioTracks?.()?.find((t) => t.enabled && t.readyState === "live");
    if (!track) {
      setSpeaking(false);
      return undefined;
    }

    const onT = typeof onThreshold === "number" ? onThreshold : threshold;
    const offT = typeof offThreshold === "number" ? offThreshold : Math.max(0.008, threshold * 0.55);

    let ctx;
    let raf;
    let alive = true;
    let isOn = false;
    let aboveSince = 0;
    let belowSince = 0;
    let smoothed = 0;

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // A context created after the call UI mounts can remain suspended even
      // though the user has already accepted the call. Resume it explicitly
      // so incoming remote audio produces analyser samples.
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = (now) => {
        if (!alive) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Light EMA so single-frame spikes don't flip state
        smoothed = smoothed * 0.72 + rms * 0.28;

        if (!isOn) {
          if (smoothed > onT) {
            if (!aboveSince) aboveSince = now;
            if (now - aboveSince >= attackMs) {
              isOn = true;
              belowSince = 0;
              setSpeaking(true);
            }
          } else {
            aboveSince = 0;
          }
        } else if (smoothed < offT) {
          if (!belowSince) belowSince = now;
          if (now - belowSince >= releaseMs) {
            isOn = false;
            aboveSince = 0;
            setSpeaking(false);
          }
        } else {
          belowSince = 0;
        }

        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      setSpeaking(false);
    }

    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      try {
        ctx?.close();
      } catch {
        /* ignore */
      }
    };
  }, [stream, muted, threshold, onThreshold, offThreshold, attackMs, releaseMs]);

  return speaking;
}

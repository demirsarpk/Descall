import { useEffect, useState } from "react";

/**
 * Lightweight voice-activity detector for a MediaStream.
 * Returns true while audio energy is above threshold.
 */
export default function useSpeaking(stream, { muted = false, threshold = 0.02 } = {}) {
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

    let ctx;
    let raf;
    let alive = true;

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!alive) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setSpeaking(rms > threshold);
        raf = requestAnimationFrame(tick);
      };
      tick();
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
  }, [stream, muted, threshold]);

  return speaking;
}

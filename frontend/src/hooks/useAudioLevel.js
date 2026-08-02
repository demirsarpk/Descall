import { useEffect, useState } from "react";

/**
 * Returns 0–1 audio RMS level for a MediaStream (for reactive speaking rings).
 */
export default function useAudioLevel(stream, { muted = false } = {}) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (muted || !stream) {
      setLevel(0);
      return undefined;
    }

    const track = stream.getAudioTracks?.()?.find((t) => t.enabled && t.readyState === "live");
    if (!track) {
      setLevel(0);
      return undefined;
    }

    let ctx;
    let raf;
    let alive = true;

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
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
        setLevel(Math.min(1, rms * 4));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setLevel(0);
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
  }, [stream, muted]);

  return level;
}

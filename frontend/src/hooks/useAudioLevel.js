import { useEffect, useState } from "react";

/**
 * Returns 0–1 smoothed audio RMS for reactive speaking rings.
 * Updates are throttled / EMA'd so rings don't jitter every frame.
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
    let smoothed = 0;
    let lastPublish = 0;

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
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
        smoothed = smoothed * 0.82 + Math.min(1, rms * 4) * 0.18;

        // Publish at ~30fps max to cut React re-render flicker
        if (now - lastPublish > 33) {
          lastPublish = now;
          setLevel(smoothed);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
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

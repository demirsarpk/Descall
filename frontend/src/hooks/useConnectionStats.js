import { useEffect, useRef, useState } from "react";
import { sampleConnectionStats } from "../lib/connectionStats";

const POLL_MS = 2500;

const EMPTY_STATS = {
  quality: null,
  rttMs: null,
  packetLossPct: null,
  jitterMs: null,
  bitrateKbps: null,
};

/**
 * Polls a single RTCPeerConnection's real stats (RTT, packet loss, jitter,
 * bitrate) while `active` is true, so the UI can show actionable network
 * diagnostics instead of only a coarse "connecting/good/poor/failed" label.
 */
export default function useConnectionStats(pcRef, { active = false, intervalMs = POLL_MS } = {}) {
  const [stats, setStats] = useState(EMPTY_STATS);
  const prevSampleRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setStats(EMPTY_STATS);
      prevSampleRef.current = null;
      return undefined;
    }

    let alive = true;
    const poll = async () => {
      const pc = pcRef?.current;
      if (!pc || pc.connectionState === "closed") return;
      const result = await sampleConnectionStats(pc, prevSampleRef.current);
      if (!result || !alive) return;
      prevSampleRef.current = result.sample;
      setStats({
        quality: result.quality,
        rttMs: result.rttMs,
        packetLossPct: result.packetLossPct,
        jitterMs: result.jitterMs,
        bitrateKbps: result.bitrateKbps,
      });
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active, pcRef, intervalMs]);

  return stats;
}

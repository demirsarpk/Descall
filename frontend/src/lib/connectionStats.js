/**
 * Real WebRTC connection diagnostics derived from RTCPeerConnection.getStats(),
 * instead of relying only on the coarse connectionState/iceConnectionState.
 * Shared by DM calls (single peer) and group calls (one sample per participant).
 */

/** Classify a network sample into a stable, user-facing quality bucket. */
export function classifyConnectionQuality({ rttMs, packetLossPct, jitterMs }) {
  if (rttMs == null && packetLossPct == null && jitterMs == null) return null;
  const rtt = rttMs ?? 0;
  const loss = packetLossPct ?? 0;
  const jitter = jitterMs ?? 0;
  if (loss > 8 || rtt > 400 || jitter > 60) return "poor";
  if (loss > 3 || rtt > 220 || jitter > 30) return "fair";
  if (loss > 1 || rtt > 120 || jitter > 15) return "good";
  return "excellent";
}

/**
 * Pull one diagnostic sample from a live RTCPeerConnection. `prevSample`
 * should be the `sample` field returned by the previous call so per-interval
 * deltas (bitrate, packet loss) can be computed instead of lifetime totals.
 */
export async function sampleConnectionStats(pc, prevSample = null) {
  if (!pc || typeof pc.getStats !== "function") return null;
  let report;
  try {
    report = await pc.getStats();
  } catch {
    return null;
  }

  let rttMs = null;
  let bytesReceived = null;
  let packetsLost = null;
  let packetsReceived = null;
  let jitterMs = null;
  let timestamp = null;

  report.forEach((entry) => {
    if (entry.type === "candidate-pair" && entry.state === "succeeded" && entry.currentRoundTripTime != null) {
      rttMs = entry.currentRoundTripTime * 1000;
    }
    if (entry.type === "inbound-rtp" && !entry.isRemote && (entry.kind === "audio" || entry.kind === "video")) {
      // Prefer video's numbers when both audio and video are inbound, since
      // video is the more bandwidth-sensitive signal for camera/screen calls.
      if (bytesReceived == null || entry.kind === "video") {
        bytesReceived = entry.bytesReceived ?? bytesReceived;
        packetsLost = entry.packetsLost ?? packetsLost;
        packetsReceived = entry.packetsReceived ?? packetsReceived;
        jitterMs = entry.jitter != null ? entry.jitter * 1000 : jitterMs;
        timestamp = entry.timestamp ?? timestamp;
      }
    }
  });

  let bitrateKbps = null;
  if (bytesReceived != null && prevSample?.bytesReceived != null && timestamp && prevSample?.timestamp) {
    const deltaBytes = bytesReceived - prevSample.bytesReceived;
    const deltaMs = timestamp - prevSample.timestamp;
    if (deltaMs > 0 && deltaBytes >= 0) {
      bitrateKbps = Math.round((deltaBytes * 8) / deltaMs);
    }
  }

  let packetLossPct = null;
  if (packetsLost != null && packetsReceived != null) {
    if (prevSample?.packetsLost != null && prevSample?.packetsReceived != null) {
      const deltaLost = packetsLost - prevSample.packetsLost;
      const deltaReceived = packetsReceived - prevSample.packetsReceived;
      const totalDelta = deltaLost + deltaReceived;
      if (totalDelta > 0) packetLossPct = Math.max(0, (deltaLost / totalDelta) * 100);
    } else if (packetsLost + packetsReceived > 0) {
      packetLossPct = Math.max(0, (packetsLost / (packetsLost + packetsReceived)) * 100);
    }
  }

  const sample = { bytesReceived, timestamp, packetsLost, packetsReceived };
  return {
    quality: classifyConnectionQuality({ rttMs, packetLossPct, jitterMs }),
    rttMs: rttMs != null ? Math.round(rttMs) : null,
    packetLossPct: packetLossPct != null ? Math.round(packetLossPct * 10) / 10 : null,
    jitterMs: jitterMs != null ? Math.round(jitterMs) : null,
    bitrateKbps,
    sample,
  };
}

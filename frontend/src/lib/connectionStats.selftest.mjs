/**
 * Regression checks for real WebRTC connection-diagnostics parsing/classification.
 * Run: node frontend/src/lib/connectionStats.selftest.mjs
 */
import { classifyConnectionQuality, sampleConnectionStats } from "./connectionStats.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(classifyConnectionQuality({}) === null, "no data -> unknown");
assert(classifyConnectionQuality({ rttMs: 40, packetLossPct: 0, jitterMs: 5 }) === "excellent", "clean link is excellent");
assert(classifyConnectionQuality({ rttMs: 150, packetLossPct: 1.5, jitterMs: 20 }) === "good", "moderate link is good");
assert(classifyConnectionQuality({ rttMs: 260, packetLossPct: 4, jitterMs: 35 }) === "fair", "degraded link is fair");
assert(classifyConnectionQuality({ rttMs: 500, packetLossPct: 10, jitterMs: 80 }) === "poor", "bad link is poor");

function makeStatsReport(entries) {
  return { forEach: (cb) => entries.forEach(cb) };
}

function makePc(entries) {
  return { getStats: async () => makeStatsReport(entries) };
}

const pc1 = makePc([
  { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.08 },
  { type: "inbound-rtp", isRemote: false, kind: "video", bytesReceived: 100000, packetsLost: 2, packetsReceived: 998, jitter: 0.01, timestamp: 1000 },
]);

const first = await sampleConnectionStats(pc1, null);
assert(first.rttMs === 80, "first sample RTT rounds to 80ms");
assert(first.jitterMs === 10, "first sample jitter rounds to 10ms");
assert(first.packetLossPct !== null, "first sample computes lifetime loss when no previous sample");
assert(first.bitrateKbps === null, "no bitrate without a previous timestamp");

const pc2 = makePc([
  { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.08 },
  { type: "inbound-rtp", isRemote: false, kind: "video", bytesReceived: 100000 + 25000, packetsLost: 2, packetsReceived: 998 + 200, jitter: 0.01, timestamp: 2000 },
]);
const second = await sampleConnectionStats(pc2, first.sample);
assert(second.bitrateKbps === 200, "delta bytes/time yields 200kbps over a 1000ms/25000B window");
assert(second.packetLossPct === 0, "no new losses in the delta window");

assert((await sampleConnectionStats(null, null)) === null, "missing pc returns null");
assert((await sampleConnectionStats({}, null)) === null, "pc without getStats returns null");

console.log("connectionStats.selftest.mjs: ok");

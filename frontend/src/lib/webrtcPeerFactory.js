/**
 * Shared WebRTC peer-connection helpers (mesh calls: DM, group, server voice).
 *
 * Every mesh call site was independently constructing `new RTCPeerConnection(...)`,
 * wiring up local tracks, and closing peers with slightly different (and
 * sometimes missing) guards. This module centralizes those primitives so the
 * three mesh hooks (`useCall`, `useGroupCall`, `useServerVoice`) share one
 * implementation. It intentionally stays low-level — callers keep owning
 * `ontrack` / negotiation logic, which differs enough per call type that
 * folding it in here would just move complexity, not remove it.
 *
 * Exports:
 * - createPeerConnection({ iceServers, onIceCandidate, onTrack, onConnectionStateChange })
 *     Builds an RTCPeerConnection, defaulting `iceServers` to getIceServers().
 *     Any of the handler callbacks are optional — pass none and wire the
 *     usual `pc.onicecandidate` / `pc.ontrack` / etc. yourself afterward.
 * - attachLocalTracks(pc, stream)
 *     Adds every track of `stream` to `pc` via addTrack(track, stream).
 * - safeClosePeer(pc)
 *     Closes a peer connection, swallowing errors from an already-closed pc.
 * - replaceSenderTrack(pc, kind, track)
 *     Finds the first sender whose current track matches `kind` and calls
 *     replaceTrack(track) on it. Returns the sender, or null if none found.
 */

import { getIceServers } from "./iceConfig";

export function createPeerConnection({
  iceServers,
  onIceCandidate,
  onTrack,
  onConnectionStateChange,
} = {}) {
  const pc = new RTCPeerConnection({ iceServers: iceServers || getIceServers() });

  if (onIceCandidate) {
    pc.onicecandidate = (e) => onIceCandidate(e.candidate, e);
  }
  if (onTrack) {
    pc.ontrack = onTrack;
  }
  if (onConnectionStateChange) {
    pc.onconnectionstatechange = () => onConnectionStateChange(pc.connectionState, pc);
  }

  return pc;
}

export function attachLocalTracks(pc, stream) {
  if (!pc || !stream) return [];
  return stream.getTracks().map((track) => pc.addTrack(track, stream));
}

export function safeClosePeer(pc) {
  if (!pc) return;
  try {
    pc.close();
  } catch {
    /* already closed / never fully opened — nothing to do */
  }
}

export function replaceSenderTrack(pc, kind, track) {
  if (!pc || !kind) return null;
  const sender = pc.getSenders().find((s) => s.track?.kind === kind);
  if (!sender) return null;
  sender.replaceTrack(track).catch(() => {});
  return sender;
}

/**
 * Dev-only smoke test — exercises the factory against a real RTCPeerConnection
 * when available (browser/jsdom), otherwise no-ops. Not wired into any test
 * runner; call manually from a console if you want a quick sanity check:
 *   import { __selfTest } from "./webrtcPeerFactory"; __selfTest();
 */
export function __selfTest() {
  if (typeof RTCPeerConnection === "undefined") return "skipped: no RTCPeerConnection in this env";
  const pc = createPeerConnection({});
  const ok =
    pc instanceof RTCPeerConnection &&
    typeof attachLocalTracks === "function" &&
    typeof replaceSenderTrack === "function";
  safeClosePeer(pc);
  return ok ? "ok" : "failed";
}

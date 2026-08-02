/**
 * Lightweight regression checks for group screen-share classification / glare helpers.
 * Run: node frontend/src/lib/webrtcScreenShare.selftest.mjs
 */
import {
  isRemoteScreenVideoTrack,
} from "./webrtcScreenShare.js";
import { applyRemoteOffer, isPolitePeer } from "./webrtcNegotiation.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const videoScreen = { kind: "video", label: "screen:0:0" };
const videoCam = { kind: "video", label: "Integrated Camera" };

assert(isRemoteScreenVideoTrack(videoScreen, {}), "screen label");
assert(!isRemoteScreenVideoTrack(videoCam, {}), "camera not screen by default");
assert(
  isRemoteScreenVideoTrack(videoCam, { peerExpectsScreen: true }),
  "expectScreenShare"
);
assert(
  !isRemoteScreenVideoTrack(videoCam, { rawStream: null }),
  "missing rawStream must not imply screen"
);

const main = {
  id: "main",
  getVideoTracks: () => [videoCam],
  getAudioTracks: () => [{ kind: "audio" }],
};
const screenMs = {
  id: "screen",
  getVideoTracks: () => [videoScreen],
  getAudioTracks: () => [],
};
assert(
  isRemoteScreenVideoTrack(videoScreen, {
    rawStream: screenMs,
    mainRemoteStream: main,
  }),
  "distinct stream id"
);

assert(isPolitePeer("a", "b") === true, "polite lower id");
assert(isPolitePeer("b", "a") === false, "impolite higher id");

console.log("webrtcScreenShare.selftest.mjs: ok");

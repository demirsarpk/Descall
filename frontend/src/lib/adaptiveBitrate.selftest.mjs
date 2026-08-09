import assert from "node:assert/strict";
import {
  getAdaptiveVideoEncodingParams,
  getAdaptiveAudioEncodingParams,
  applyAdaptiveVideoEncoding,
  applyAdaptiveAudioEncoding,
} from "./adaptiveBitrate.js";

// Quality buckets should scale down bitrate/resolution/framerate monotonically
// as the connection degrades.
const excellent = getAdaptiveVideoEncodingParams("excellent");
const good = getAdaptiveVideoEncodingParams("good");
const fair = getAdaptiveVideoEncodingParams("fair");
const poor = getAdaptiveVideoEncodingParams("poor");

assert.ok(excellent.maxBitrate >= good.maxBitrate);
assert.ok(good.maxBitrate > fair.maxBitrate);
assert.ok(fair.maxBitrate > poor.maxBitrate);
assert.ok(excellent.scaleResolutionDownBy <= good.scaleResolutionDownBy);
assert.ok(good.scaleResolutionDownBy < fair.scaleResolutionDownBy);
assert.ok(fair.scaleResolutionDownBy < poor.scaleResolutionDownBy);
assert.ok(excellent.maxFramerate >= poor.maxFramerate);

// Unknown quality bucket falls back to "good" rather than throwing.
assert.deepEqual(getAdaptiveVideoEncodingParams("bogus"), good);
assert.deepEqual(getAdaptiveVideoEncodingParams(null), good);

const audioExcellent = getAdaptiveAudioEncodingParams("excellent");
const audioPoor = getAdaptiveAudioEncodingParams("poor");
assert.ok(audioExcellent.maxBitrate > audioPoor.maxBitrate);

// applyAdaptiveVideoEncoding: fake sender records the params it was given.
function makeFakeSender(kind = "video") {
  const state = { encodings: [{}] };
  return {
    track: { kind },
    getParameters: () => state,
    setParameters: async (p) => {
      Object.assign(state, p);
    },
    _state: state,
  };
}

const videoSender = makeFakeSender("video");
const lastApplied = { current: null };
await applyAdaptiveVideoEncoding(videoSender, "poor", lastApplied);
assert.equal(videoSender._state.encodings[0].maxBitrate, poor.maxBitrate);
assert.equal(lastApplied.current, "poor");

// Calling again with the same quality is a no-op (guarded by lastAppliedRef).
const before = JSON.stringify(videoSender._state.encodings[0]);
await applyAdaptiveVideoEncoding(videoSender, "poor", lastApplied);
assert.equal(JSON.stringify(videoSender._state.encodings[0]), before);

// A quality change re-applies with new params.
await applyAdaptiveVideoEncoding(videoSender, "excellent", lastApplied);
assert.equal(videoSender._state.encodings[0].maxBitrate, excellent.maxBitrate);
assert.equal(lastApplied.current, "excellent");

// Audio-kind sender is ignored by the video helper, and vice versa.
const audioSender = makeFakeSender("audio");
const audioLastApplied = { current: null };
await applyAdaptiveVideoEncoding(audioSender, "poor", audioLastApplied);
assert.equal(audioLastApplied.current, null);
await applyAdaptiveAudioEncoding(audioSender, "poor", audioLastApplied);
assert.equal(audioSender._state.encodings[0].maxBitrate, audioPoor.maxBitrate);
assert.equal(audioLastApplied.current, "poor");

// Null/undefined senders are ignored without throwing.
await applyAdaptiveVideoEncoding(null, "poor");
await applyAdaptiveAudioEncoding(undefined, "poor");

console.log("adaptiveBitrate.selftest.mjs: ok");

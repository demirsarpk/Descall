import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./useCall.js", import.meta.url)), "utf8");
const startCall = source.slice(source.indexOf("const startCall = useCallback"), source.indexOf("const acceptIncoming"));

assert.match(startCall, /if \(!socketRef\.current\?\.connected\) \{/);
assert.doesNotMatch(startCall, /if \(!peerId \|\| !socket\) return;/);
assert.ok(
  startCall.indexOf("!socketRef.current?.connected") < startCall.indexOf("navigator.mediaDevices.getUserMedia"),
  "startCall must reject a disconnected socket before acquiring media",
);

const startScreenShare = source.slice(
  source.indexOf("const startScreenShare = useCallback"),
  source.indexOf("const restartScreenShareWithQuality"),
);
const dmRemoteVideo = readFileSync(
  fileURLToPath(new URL("../components/CallOverlay.jsx", import.meta.url)),
  "utf8",
);
const remoteScreenEvents = source.slice(
  source.indexOf("const handleRemoteScreenShareStart"),
  source.indexOf("// Change active microphone mid-call"),
);

assert.match(startScreenShare, /navigator\.mediaDevices\?\.getDisplayMedia/);
assert.doesNotMatch(
  startScreenShare,
  /setTimeout\(async \(\) =>[\s\S]*?call:offer/,
  "screen sharing must rely on serialized negotiationneeded instead of a duplicate delayed offer",
);
assert.match(source, /receivedVideoTracksRef/);
assert.match(source, /hasAudio/);
assert.match(remoteScreenEvents, /socket\.on\("screen:share-start", onScreenShareStart\)/);
assert.match(remoteScreenEvents, /socket\.on\("screen:share-stop", onScreenShareStop\)/);
assert.match(remoteScreenEvents, /socket\.off\("screen:share-start", onScreenShareStart\)/);
assert.match(remoteScreenEvents, /socket\.off\("screen:share-stop", onScreenShareStop\)/);
assert.match(dmRemoteVideo, /const dmRemoteHasVideo = streamHasLiveVideo\(call\?\.remoteStream\);/);
assert.doesNotMatch(dmRemoteVideo, /dmRemoteHasVideo = .*callType === "video"/);
assert.match(dmRemoteVideo, /const remoteAudio = isDm \?/);
assert.match(dmRemoteVideo, /audio\.srcObject !== stream/);
assert.match(dmRemoteVideo, /hasLiveAudio/);

console.log("useCall media negotiation self-test passed");

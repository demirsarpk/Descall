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

console.log("useCall socket connection self-test passed");

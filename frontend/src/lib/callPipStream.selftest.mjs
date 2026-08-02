import { pickCallPipSource } from "./callPipStream.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const screen = {
  getVideoTracks: () => [{ readyState: "live", enabled: true }],
};
const cam = {
  getVideoTracks: () => [{ readyState: "live", enabled: true }],
};

{
  const r = pickCallPipSource({
    isDm: false,
    groupCall: {
      screenStream: screen,
      participants: [{ id: "a", stream: cam, username: "A" }],
    },
  });
  assert(r.kind === "screen" && r.label === "Your screen", "local screen first");
}

{
  const r = pickCallPipSource({
    isDm: false,
    groupCall: {
      participants: [
        { id: "a", stream: cam, username: "Alice" },
        { id: "b", stream: cam, username: "Bob", screenStream: screen, isScreenSharing: true },
      ],
    },
  });
  assert(r.kind === "screen" && r.userId === "b", "remote screen before cameras");
}

{
  const r = pickCallPipSource({
    isDm: false,
    lastSpeakerId: "b",
    groupCall: {
      participants: [
        { id: "a", stream: cam, username: "Alice" },
        { id: "b", stream: cam, username: "Bob" },
      ],
    },
  });
  assert(r.userId === "b" && r.kind === "camera", "last speaker preferred");
}

{
  const r = pickCallPipSource({
    isDm: true,
    call: { peer: { username: "Pat", id: "p1" }, remoteStream: null, cameraOn: false },
  });
  assert(r.kind === "avatar" && r.username === "Pat", "avatar fallback for audio-only DM");
}

console.log("callPipStream.selftest: ok");

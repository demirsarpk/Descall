/**
 * Pick the best MediaStream to show in OS Picture-in-Picture.
 * Priority: screen share → speaking/camera remote → last speaker → any remote cam → local cam.
 */

function hasLiveVideo(stream) {
  return Boolean(
    stream?.getVideoTracks?.().some((t) => t && t.readyState === "live" && t.enabled !== false)
  );
}

export function pickCallPipSource({
  isDm,
  call,
  groupCall,
  lastSpeakerId = null,
} = {}) {
  const localScreen = isDm ? call?.screenStream : groupCall?.screenStream;
  if (hasLiveVideo(localScreen)) {
    return {
      stream: localScreen,
      label: "Your screen",
      kind: "screen",
      userId: null,
    };
  }

  const participants = groupCall?.participants || [];
  const remoteScreen = participants.find((p) => hasLiveVideo(p.screenStream));
  if (remoteScreen) {
    return {
      stream: remoteScreen.screenStream,
      label: `${remoteScreen.username || "Member"}'s screen`,
      kind: "screen",
      userId: remoteScreen.id,
    };
  }

  if (isDm) {
    const remote = call?.remoteStream;
    if (hasLiveVideo(remote)) {
      return {
        stream: remote,
        label: call?.peer?.username || "Caller",
        kind: "camera",
        userId: call?.peer?.id || null,
      };
    }
    const local = call?.localStream;
    if (hasLiveVideo(local) && call?.cameraOn) {
      return {
        stream: local,
        label: "You",
        kind: "camera-local",
        userId: null,
      };
    }
    return {
      stream: null,
      label: call?.peer?.username || "Call",
      kind: "avatar",
      userId: call?.peer?.id || null,
      avatarUrl: call?.peer?.avatarUrl || call?.peer?.avatar_url || null,
      username: call?.peer?.username || "Caller",
    };
  }

  const withCam = participants.filter((p) => hasLiveVideo(p.stream));
  const preferred =
    (lastSpeakerId && withCam.find((p) => p.id === lastSpeakerId)) ||
    withCam[0] ||
    null;

  if (preferred) {
    return {
      stream: preferred.stream,
      label: preferred.username || "Member",
      kind: "camera",
      userId: preferred.id,
    };
  }

  const local = groupCall?.localStream;
  if (hasLiveVideo(local) && groupCall?.isCameraOn) {
    return {
      stream: local,
      label: "You",
      kind: "camera-local",
      userId: null,
    };
  }

  const anyone = participants[0];
  return {
    stream: null,
    label: anyone?.username || "Group Call",
    kind: "avatar",
    userId: anyone?.id || null,
    avatarUrl: anyone?.avatarUrl || null,
    username: anyone?.username || "Group Call",
  };
}

/**
 * Lightweight speaking detector: returns cleanup + current lastSpeakerId via callback.
 */
export function attachSpeakerWatcher(streamByUserId, onSpeaker) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || typeof onSpeaker !== "function") {
    return () => {};
  }

  let ctx;
  try {
    ctx = new AudioCtx();
  } catch {
    return () => {};
  }

  const nodes = [];
  let raf = 0;
  let lastId = null;
  let lastBump = 0;

  const entries = [...streamByUserId.entries()];
  for (const [userId, stream] of entries) {
    const audioTracks = stream?.getAudioTracks?.() || [];
    if (!audioTracks.length) continue;
    try {
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      nodes.push({ userId, analyser, data });
    } catch {
      /* ignore bad streams */
    }
  }

  const tick = () => {
    let bestId = null;
    let best = 0;
    for (const n of nodes) {
      n.analyser.getByteFrequencyData(n.data);
      let sum = 0;
      for (let i = 0; i < n.data.length; i += 1) sum += n.data[i];
      const avg = sum / n.data.length;
      if (avg > best) {
        best = avg;
        bestId = n.userId;
      }
    }
    // Threshold ~ speaking vs silence
    if (best > 18 && bestId && (bestId !== lastId || Date.now() - lastBump > 800)) {
      lastId = bestId;
      lastBump = Date.now();
      onSpeaker(bestId);
    }
    raf = requestAnimationFrame(tick);
  };

  if (nodes.length) {
    ctx.resume?.().catch(() => {});
    raf = requestAnimationFrame(tick);
  }

  return () => {
    cancelAnimationFrame(raf);
    try {
      ctx.close?.();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Client helper: emit descoin:heartbeat while in an active call and speaking
 * (or screensharing). Server validates against its own call state.
 */

const INTERVAL_MS = 16_000;

function createSpeakingDetector(stream) {
  if (!stream || typeof AudioContext === "undefined") {
    return { speaking: () => false, stop: () => {} };
  }
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let stopped = false;
    return {
      speaking: () => {
        if (stopped) return false;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        return sum / data.length > 12;
      },
      stop: () => {
        stopped = true;
        try {
          source.disconnect();
          analyser.disconnect();
          ctx.close();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return { speaking: () => false, stop: () => {} };
  }
}

/**
 * @param {object} opts
 * @param {() => any} opts.getSocket
 * @param {() => MediaStream|null} opts.getLocalStream
 * @param {() => boolean} opts.isActive
 * @param {() => boolean} opts.isScreenSharing
 * @param {() => ({ context: 'dm'|'group', peerId?: string, groupId?: string })} opts.getContext
 */
export function startDesCoinHeartbeat({
  getSocket,
  getLocalStream,
  isActive,
  isScreenSharing,
  getContext,
}) {
  let detector = null;
  let lastStream = null;

  const tick = () => {
    if (!isActive?.()) return;
    const socket = getSocket?.();
    if (!socket?.connected) return;
    const ctx = getContext?.() || {};
    if (!ctx.context) return;

    const stream = getLocalStream?.() || null;
    if (stream !== lastStream) {
      detector?.stop?.();
      detector = stream ? createSpeakingDetector(stream) : null;
      lastStream = stream;
    }

    const screensharing = Boolean(isScreenSharing?.());
    const speaking = Boolean(detector?.speaking?.());

    if (speaking) {
      socket.emit("descoin:heartbeat", {
        ...ctx,
        type: "voice",
        speaking: true,
      });
    }
    if (screensharing) {
      socket.emit("descoin:heartbeat", {
        ...ctx,
        type: "screenshare",
        speaking: false,
      });
    }
  };

  const id = setInterval(tick, INTERVAL_MS);
  // First tick shortly after join so users see earn feedback quickly.
  const boot = setTimeout(tick, 2_500);

  return () => {
    clearInterval(id);
    clearTimeout(boot);
    detector?.stop?.();
    detector = null;
    lastStream = null;
  };
}

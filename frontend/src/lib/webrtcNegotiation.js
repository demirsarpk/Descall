/**
 * Perfect negotiation helpers for mesh group calls.
 * When two peers both createOffer (e.g. simultaneous screen shares),
 * one offer would otherwise fail with InvalidStateError and the new
 * video track never attaches → black screen for the second sharer.
 */

export function isPolitePeer(localUserId, remoteUserId) {
  return String(localUserId || "") < String(remoteUserId || "");
}

/**
 * Apply a remote SDP offer, resolving glare when we also have a local offer in flight.
 * @returns {{ accepted: boolean, rolledBack: boolean }}
 */
export async function applyRemoteOffer(pc, offer, { polite, makingOffer }) {
  if (!pc || !offer) return { accepted: false, rolledBack: false };

  const desc =
    offer instanceof RTCSessionDescription
      ? offer
      : new RTCSessionDescription(offer);

  const collision =
    Boolean(makingOffer) || pc.signalingState !== "stable";

  if (collision) {
    if (!polite) {
      // Impolite peer keeps its own offer; remote side will roll back / answer later.
      return { accepted: false, rolledBack: false };
    }
    await Promise.all([
      pc.setLocalDescription({ type: "rollback" }),
      pc.setRemoteDescription(desc),
    ]);
    return { accepted: true, rolledBack: true };
  }

  await pc.setRemoteDescription(desc);
  return { accepted: true, rolledBack: false };
}

/** Chain track.onunmute without clobbering an existing handler. */
export function chainTrackUnmute(track, handler) {
  if (!track || typeof handler !== "function") return;
  const prev = track.onunmute;
  track.onunmute = (ev) => {
    try {
      if (typeof prev === "function") prev.call(track, ev);
    } catch {
      /* ignore */
    }
    handler(ev);
  };
}

import { useEffect, useRef, useState } from "react";

export const DM_PARTICIPANT_EXIT_MS = 300;

export function deriveDmConnectionStatus({
  mode,
  peerConnectionState,
  remoteMediaReady,
  connectionQuality,
}) {
  if (mode !== "active") return null;
  if (peerConnectionState === "disconnected" || connectionQuality === "failed") {
    return "disconnected";
  }
  if (peerConnectionState === "reconnecting" || connectionQuality === "poor") {
    return "reconnecting";
  }
  if (!remoteMediaReady) return "connecting";
  return "connected";
}

const STATUS_LABEL = {
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

export function getConnectionStatusLabel(status) {
  return status ? STATUS_LABEL[status] || null : null;
}

/**
 * Manages DM remote participant slot visibility with enter/exit animation phases.
 * Keeps the peer snapshot alive during exit so AnimatePresence can finish.
 */
export function useDmRemoteParticipant({
  peer,
  mode,
  remoteMediaReady,
  peerConnectionState,
  connectionQuality,
}) {
  const [slotOpen, setSlotOpen] = useState(false);
  const [displayPeer, setDisplayPeer] = useState(null);
  const [phase, setPhase] = useState("hidden"); // hidden | connecting | visible | exiting
  const peerSnapshotRef = useRef(null);
  const exitTimerRef = useRef(null);

  const clearExitTimer = () => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (mode === "active" && peer) {
      clearExitTimer();
      peerSnapshotRef.current = peer;
      setDisplayPeer(peer);
      setSlotOpen(true);
      setPhase(remoteMediaReady ? "visible" : "connecting");
      return;
    }

    if (slotOpen && (displayPeer || peerSnapshotRef.current)) {
      setPhase("exiting");
      exitTimerRef.current = setTimeout(() => {
        setSlotOpen(false);
        setDisplayPeer(null);
        setPhase("hidden");
        peerSnapshotRef.current = null;
      }, DM_PARTICIPANT_EXIT_MS);
      return clearExitTimer;
    }
  }, [peer, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "active" && peer && remoteMediaReady && phase === "connecting") {
      setPhase("visible");
    }
  }, [remoteMediaReady, mode, peer, phase]);

  useEffect(() => {
    if (mode !== "active" || !peer) return;
    if (peerConnectionState === "reconnecting" && phase === "visible") {
      setPhase("connecting");
    } else if (peerConnectionState === "connected" && remoteMediaReady && phase === "connecting") {
      setPhase("visible");
    }
  }, [peerConnectionState, remoteMediaReady, mode, peer, phase]);

  const resolvedPeer = displayPeer || peerSnapshotRef.current;

  return {
    showSlot: slotOpen || phase === "exiting",
    displayPeer: resolvedPeer,
    phase,
    connectionStatus: deriveDmConnectionStatus({
      mode,
      peerConnectionState,
      remoteMediaReady,
      connectionQuality,
    }),
    isMediaReady: remoteMediaReady && phase === "visible",
  };
}

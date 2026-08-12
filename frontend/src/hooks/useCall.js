import { useCallback, useEffect, useRef, useState } from "react";
import { patchUserAvatar } from "../lib/userProfile";
import audioManager from "../lib/audioManager";
import notificationService from "../lib/notificationService";
import {
  buildElectronDesktopConstraints,
  optimizeScreenShareSender,
  optimizeScreenShareTrack,
  resolveScreenCaptureSize,
  screenBitrateForPeerCount,
  DM_SCREEN_DEFAULT_QUALITY,
  isRemoteScreenVideoTrack,
  ensureScreenShareAudioTrack,
  isMobileScreenCapture,
  getDisplayMediaStream,
} from "../lib/webrtcScreenShare";
import { useToast } from "../context/ToastContext";
import { t as tRuntime } from "../i18n/runtime";
import {
  applyRemoteOffer,
  isPolitePeer,
} from "../lib/webrtcNegotiation";
import { getIceServers, preloadIceServers } from "../lib/iceConfig";
import { getUser } from "../lib/storage";
import useConnectionStats from "./useConnectionStats";
import { applyAdaptiveVideoEncoding, applyAdaptiveAudioEncoding } from "../lib/adaptiveBitrate";
import { acquireCallWakeLock, releaseCallWakeLock, pulseCallWakeLock } from "../lib/callWakeLock";
import { startDesCoinHeartbeat } from "../lib/descoinHeartbeat";

// Helper: show a screen-picker for Electron with fully inline styles (no CSS dep)
function showElectronScreenPicker(sources) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (id) => {
      if (resolved) return;
      resolved = true;
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      resolve(id);
    };

    // Inject keyframes once
    const STYLE_ID = '__esp_anim__';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        @keyframes _esp_overlay { from { opacity:0 } to { opacity:1 } }
        @keyframes _esp_modal { from { opacity:0; transform:scale(0.9) translateY(16px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `;
      document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: '_esp_overlay 0.2s ease',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px', width: '720px', maxWidth: '90vw',
      maxHeight: '82vh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      animation: '_esp_modal 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)',
      flexShrink: '0',
    });

    const title = document.createElement('h3');
    title.textContent = 'Share your screen';
    Object.assign(title.style, { margin: '0', fontSize: '16px', fontWeight: '600', color: '#f0f0f5' });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
      width: '32px', height: '32px', border: 'none', borderRadius: '8px',
      background: 'transparent', color: '#8a8a93', fontSize: '24px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: '1',
    });
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(255,255,255,0.08)'; closeBtn.style.color = '#f0f0f5'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'transparent'; closeBtn.style.color = '#8a8a93'; });
    closeBtn.addEventListener('click', () => done(null));

    header.appendChild(title);
    header.appendChild(closeBtn);

    const tip = document.createElement('div');
    tip.textContent = 'Choose the screen, window, or browser tab you want to share.';
    Object.assign(tip.style, {
      padding: '10px 24px', fontSize: '12px', color: '#949ba4',
      borderBottom: '1px solid rgba(255,255,255,0.07)', lineHeight: '1.4',
    });

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '12px', padding: '20px 24px 24px', overflowY: 'auto',
    });

    sources.forEach((source) => {
      const item = document.createElement('div');
      Object.assign(item.style, {
        display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.07)',
        borderRadius: '12px', padding: '10px', cursor: 'pointer',
        transition: 'all 0.15s',
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(88,101,242,0.15)';
        item.style.borderColor = '#5865f2';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255,255,255,0.04)';
        item.style.borderColor = 'rgba(255,255,255,0.07)';
      });

      const thumb = document.createElement('img');
      thumb.src = source.thumbnailDataURL;
      thumb.alt = source.name;
      thumb.draggable = false;
      Object.assign(thumb.style, {
        width: '100%', aspectRatio: '16/9', objectFit: 'cover',
        borderRadius: '8px', background: '#111',
      });

      const label = document.createElement('span');
      label.textContent = source.name;
      Object.assign(label.style, {
        fontSize: '12px', fontWeight: '500', color: '#c0c0c8',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center',
      });

      item.appendChild(thumb);
      item.appendChild(label);
      item.addEventListener('click', () => done(source.id));
      grid.appendChild(item);
    });

    modal.appendChild(header);
    modal.appendChild(tip);
    modal.appendChild(grid);
    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    document.body.appendChild(overlay);
  });
}

/**
 * Unified WebRTC call hook supporting:
 * - Voice calls (audio only)
 * - Video calls (audio + camera)
 * - Screen sharing (getDisplayMedia)
 *
 * Signaling is done via Socket.io events:
 *   call:offer, call:answer, call:ice-candidate, call:ended, call:declined
 *   screen:share-start, screen:share-stop, screen:stream-replace
 */
export function useCall(socket, callOccupancyRef = null) {
  const { toast } = useToast();
  const [mode, setMode] = useState(null); // null | "incoming" | "outgoing" | "active"
  const [callType, setCallType] = useState(null); // null | "voice" | "video"
  const [peer, setPeer] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteCameraOn, setRemoteCameraOn] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState("unknown");
  const [peerConnectionState, setPeerConnectionState] = useState("idle");
  const [remoteMediaReady, setRemoteMediaReady] = useState(false);
  const [localStream, setLocalStream] = useState(null);

  // Keep the screen awake / tab exempt from background throttling for as
  // long as a call is ringing or active — screen lock and aggressive tab
  // suspension are common causes of calls silently dropping on mobile.
  useEffect(() => {
    if (mode) {
      acquireCallWakeLock({ title: "Descall call", artist: peer?.username || "" });
    } else {
      releaseCallWakeLock();
    }
  }, [mode, peer?.username]);

  useEffect(() => {
    if (mode !== "active" || !peer?.id) return undefined;
    return startDesCoinHeartbeat({
      getSocket: () => socketRef.current,
      getLocalStream: () => localStreamRef.current,
      isActive: () => modeRef.current === "active",
      isScreenSharing: () => Boolean(screenSharingRef.current),
      getContext: () => ({ context: "dm", peerId: peerRef.current?.id }),
    });
  }, [mode, peer?.id]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");
  const [screenQuality, setScreenQuality] = useState(DM_SCREEN_DEFAULT_QUALITY);
  const screenQualityRef = useRef(screenQuality);

  useEffect(() => {
    screenQualityRef.current = screenQuality;
  }, [screenQuality]);

  useEffect(() => {
    preloadIceServers().catch(() => {});
  }, []);

  const pcRef = useRef(null);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const networkStats = useConnectionStats(pcRef, { active: mode === "active" });
  const lastAdaptiveVideoQualityRef = useRef(null);
  const lastAdaptiveAudioQualityRef = useRef(null);
  useEffect(() => {
    if (mode !== "active" || !networkStats.quality) return;
    const pc = pcRef.current;
    if (!pc) return;
    const senders = pc.getSenders();
    const videoSender = senders.find(
      (s) => s.track?.kind === "video" && s !== screenSenderRef.current
    );
    const audioSender = senders.find(
      (s) => s.track?.kind === "audio" && s !== screenAudioSenderRef.current
    );
    applyAdaptiveVideoEncoding(videoSender, networkStats.quality, lastAdaptiveVideoQualityRef);
    applyAdaptiveAudioEncoding(audioSender, networkStats.quality, lastAdaptiveAudioQualityRef);
  }, [mode, networkStats.quality]);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteScreenStreamRef = useRef(null);
  const remoteScreenSharingRef = useRef(false);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const pendingIceRef = useRef([]);
  const incomingOfferRef = useRef(null);
  const incomingCallTypeRef = useRef(null);
  const peerRef = useRef(null);
  const timerRef = useRef(null);
  const screenSenderRef = useRef(null);
  const screenAudioSenderRef = useRef(null);
  const screenAudioCtxRef = useRef(null);
  const screenSharingRef = useRef(false);
  const intentionalScreenStopRef = useRef(false);
  const screenEndedInBackgroundRef = useRef(false);
  const stopScreenShareRef = useRef(null);
  const cleanupTimerRef = useRef(null);
  const socketRef = useRef(socket);
  const callTypeRef = useRef(callType);
  const makingOfferRef = useRef(false);
  const negotiationQueuedRef = useRef(false);
  const iceRestartAttemptedRef = useRef(false);
  const iceRecoveryTimerRef = useRef(null);
  const negotiateRef = useRef(null);
  // Keep the original stream association so a late screen-share signal can
  // recover only a likely display track, never an arbitrary camera receiver.
  const receivedVideoTracksRef = useRef(new Map());

  useEffect(() => { peerRef.current = peer; }, [peer]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);

  // Enumerate audio devices on mount and on device change
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === "audioinput");
        const outputs = devices.filter(d => d.kind === "audiooutput");
        setAudioInputDevices(inputs);
        setAudioOutputDevices(outputs);
        if (!selectedAudioInput && inputs.length > 0) setSelectedAudioInput(inputs[0].deviceId);
        if (!selectedAudioOutput && outputs.length > 0) setSelectedAudioOutput(outputs[0].deviceId);
      } catch (_) {}
    };
    getDevices();
    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", getDevices);
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setDuration(0);
    incomingOfferRef.current = null;
    incomingCallTypeRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    setRemoteScreenStream(null);
    remoteScreenStreamRef.current = null;
    setRemoteScreenSharing(false);
    remoteScreenSharingRef.current = false;
    setScreenStream(null);
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    pendingIceRef.current = [];
    screenSenderRef.current = null;
    screenAudioSenderRef.current = null;
    if (screenAudioCtxRef.current) {
      try { screenAudioCtxRef.current.close(); } catch { /* ignore */ }
      screenAudioCtxRef.current = null;
    }
    screenSharingRef.current = false;
    makingOfferRef.current = false;
    negotiationQueuedRef.current = false;
    iceRestartAttemptedRef.current = false;
    receivedVideoTracksRef.current.clear();
    if (iceRecoveryTimerRef.current) {
      clearTimeout(iceRecoveryTimerRef.current);
      iceRecoveryTimerRef.current = null;
    }
    negotiateRef.current = null;
    setMode(null);
    setCallType(null);
    setPeer(null);
    setMuted(false);
    setCameraOn(false);
    setRemoteMuted(false);
    setRemoteCameraOn(null);
    setScreenSharing(false);
    setConnectionQuality("unknown");
    setPeerConnectionState("idle");
    setRemoteMediaReady(false);
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    // Stop all call sounds
    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
  }, []);

  const gracefulEnd = useCallback(() => {
    if (modeRef.current === "active") {
      setPeerConnectionState("disconnected");
      setRemoteMediaReady(false);
      setPeer(null);
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        cleanupTimerRef.current = null;
        cleanup();
      }, 320);
      return;
    }
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    if (mode !== "active") return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode]);

  // Handle call sounds based on mode
  useEffect(() => {
    if (mode === "incoming") {
      // Play looping ringtone for incoming call
      audioManager.play("incomingCall", { loop: true });
    } else if (mode === "outgoing") {
      // Play outgoing call sound (looping until answered/cancelled)
      audioManager.play("outgoingCall", { loop: true });
    } else if (mode === "active" || mode === null) {
      // Stop all call sounds when call is active or ended
      audioManager.stop("incomingCall");
      audioManager.stop("outgoingCall");
    }
  }, [mode]);

  const flushIce = async (pc) => {
    for (const c of pendingIceRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    pendingIceRef.current = [];
  };

  const markRemoteMediaReady = useCallback((stream) => {
    if (!stream) return;
    const tracks = stream.getTracks?.() || [];
    if (tracks.length === 0) return;
    const hasUsable = tracks.some((t) => t.readyState === "live" || t.readyState === "new");
    if (hasUsable) setRemoteMediaReady(true);
  }, []);

  const attachRemoteScreenTrack = useCallback((track, stream = null) => {
    if (!track || (track.kind !== "video" && track.kind !== "audio")) return;
    // Always build a fresh MediaStream so React re-renders when audio arrives
    // after video on the same underlying capture stream (mobile especially
    // won't rebind <audio srcObject> if the object identity is unchanged).
    setRemoteScreenStream((prev) => {
      const tracks = [];
      const push = (t) => {
        if (!t || t.readyState === "ended" || tracks.includes(t)) return;
        tracks.push(t);
      };
      if (prev) prev.getTracks().forEach(push);
      if (stream) stream.getTracks().forEach(push);
      push(track);
      const next = new MediaStream(tracks);
      remoteScreenStreamRef.current = next;
      // If we got a live screen track without the socket signal, still flip
      // the sharing flag so CallOverlay mounts the dedicated <audio>.
      if (!remoteScreenSharingRef.current) {
        remoteScreenSharingRef.current = true;
        setRemoteScreenSharing(true);
      }
      return next;
    });

    track.onended = () => {
      receivedVideoTracksRef.current.delete(track.id);
      setRemoteScreenStream((prev) => {
        if (!prev) return null;
        const remaining = prev.getTracks().filter((item) => item !== track && item.readyState !== "ended");
        const next = remaining.length ? new MediaStream(remaining) : null;
        remoteScreenStreamRef.current = next;
        if (!next) {
          remoteScreenSharingRef.current = false;
          setRemoteScreenSharing(false);
        }
        return next;
      });
    };
  }, [])

  const setupPeerConnection = useCallback((pc, stream, isInitiator) => {
    setPeerConnectionState("connecting");
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const track = e.track;
      // Mid-call camera renegotiation may omit e.streams — wrap the track.
      const raw = e.streams?.[0];
      const rs = (raw && raw.getTracks().length > 0) ? raw : new MediaStream([track]);
      if (track?.kind === "video") {
        receivedVideoTracksRef.current.set(track.id, {
          track,
          stream: rs,
          receivedAt: Date.now(),
          hasAudio: Boolean(raw?.getAudioTracks?.().length),
        });
      }
      const isScreenTrack = isRemoteScreenVideoTrack(track, {
        rawStream: raw,
        peerExpectsScreen: remoteScreenSharingRef.current,
        mainRemoteStream: remoteStreamRef.current,
        participantHasCameraVideo: Boolean(remoteStreamRef.current?.getVideoTracks().length),
      });

      if (isScreenTrack) {
        attachRemoteScreenTrack(track, rs);
        return;
      }

      // A display stream can carry both its video and approved tab/system
      // audio. Keep that audio with the screen stream (attached to the
      // durable screen-share <audio> sink) instead of mixing it into
      // the participant microphone audio element.
      //
      // MediaStream identity is unreliable after we clone into a fresh
      // remoteScreenStream for React rebinds — also match by shared video
      // tracks, or the expect-screen signal vs the long-lived mic stream.
      const sharesScreenVideo =
        Boolean(raw) &&
        Boolean(remoteScreenStreamRef.current) &&
        raw.getVideoTracks?.().some((vt) =>
          remoteScreenStreamRef.current.getVideoTracks().includes(vt)
        );
      const isScreenAudioTrack =
        track?.kind === "audio" &&
        Boolean(raw) &&
        (
          sharesScreenVideo ||
          (remoteScreenStreamRef.current && raw.id === remoteScreenStreamRef.current.id) ||
          (remoteScreenSharingRef.current &&
            (!remoteStreamRef.current || raw.id !== remoteStreamRef.current.id))
        );
      if (isScreenAudioTrack) {
        attachRemoteScreenTrack(track, raw);
        return;
      }

      // Force a state update even when the same MediaStream gains a new track
      // (same object identity would otherwise skip React re-renders).
      setRemoteStream((prev) => {
        let next;
        if (prev && prev !== rs) {
          // Merge newly arrived track into the existing remote stream when possible
          try {
            if (track && !prev.getTracks().includes(track)) prev.addTrack(track);
            next = new MediaStream(prev.getTracks());
            remoteStreamRef.current = next;
            return next;
          } catch {
            /* fall through */
          }
        }
        next = prev === rs ? new MediaStream(rs.getTracks()) : rs;
        remoteStreamRef.current = next;
        return next;
      });
      markRemoteMediaReady(rs);

      // Voice → camera upgrade: flip call type so UI mounts the remote <video>
      if (track?.kind === "video") {
        setCallType("video");
        setRemoteCameraOn((current) => current ?? true);
      }

      const attachMedia = () => {
        if (track.kind === "audio" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = rs;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(() => {});
        }
        if (track.kind === "video" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = rs;
          remoteVideoRef.current.play().catch(() => {});
        }
        if (remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.srcObject = rs;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current && !remoteVideoRef.current.srcObject && track.kind === "video") {
          remoteVideoRef.current.srcObject = rs;
          remoteVideoRef.current.play().catch(() => {});
        }
      };

      attachMedia();

      if (track?.muted) {
        track.onunmute = () => {
          markRemoteMediaReady(rs);
          if (track.kind === "video") setCallType("video");
          attachMedia();
        };
      }

      track.onended = () => {
        receivedVideoTracksRef.current.delete(track.id);
        setRemoteStream((prev) => {
          if (!prev) return prev;
          const remaining = prev.getTracks().filter((t) => t !== track && t.readyState !== "ended");
          const next = remaining.length ? new MediaStream(remaining) : null;
          remoteStreamRef.current = next;
          return next;
        });
      };
    };

    pc.onicecandidate = (e) => {
      const sock = socketRef.current;
      if (e.candidate && peerRef.current?.id && sock?.connected) {
        sock.emit("call:ice-candidate", { toUserId: peerRef.current.id, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setMode("active");
        modeRef.current = "active";
        setConnectionQuality("good");
        setPeerConnectionState("connected");
        iceRestartAttemptedRef.current = false;
        if (iceRecoveryTimerRef.current) {
          clearTimeout(iceRecoveryTimerRef.current);
          iceRecoveryTimerRef.current = null;
        }
      } else if (state === "connecting") {
        setPeerConnectionState("connecting");
        setConnectionQuality("connecting");
      } else if (state === "disconnected") {
        setPeerConnectionState("reconnecting");
        setConnectionQuality("poor");
      } else if (state === "failed") {
        setPeerConnectionState("disconnected");
        setConnectionQuality("failed");
      } else if (state === "closed") {
        setPeerConnectionState("disconnected");
      }
    };

    const attemptIceRecovery = () => {
      if (modeRef.current !== "active") return;
      if (iceRestartAttemptedRef.current) return;
      iceRestartAttemptedRef.current = true;
      setPeerConnectionState("reconnecting");
      setConnectionQuality("poor");
      try {
        if (negotiateRef.current) {
          void negotiateRef.current({ iceRestart: true });
        } else {
          pc.restartIce();
        }
      } catch {
        /* ignore — UI already shows reconnecting */
      }
    };

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") {
        setConnectionQuality("good");
        setPeerConnectionState("connected");
        iceRestartAttemptedRef.current = false;
        if (iceRecoveryTimerRef.current) {
          clearTimeout(iceRecoveryTimerRef.current);
          iceRecoveryTimerRef.current = null;
        }
      } else if (ice === "checking") {
        setPeerConnectionState("connecting");
        setConnectionQuality("connecting");
      } else if (ice === "disconnected") {
        // Brief drops often self-heal; if still broken after a short wait,
        // renegotiate with iceRestart (group-call parity). Do NOT hang up.
        setPeerConnectionState("reconnecting");
        setConnectionQuality("poor");
        if (iceRecoveryTimerRef.current) clearTimeout(iceRecoveryTimerRef.current);
        iceRecoveryTimerRef.current = setTimeout(() => {
          iceRecoveryTimerRef.current = null;
          if (!pcRef.current || pcRef.current !== pc) return;
          const still = pc.iceConnectionState;
          if (still === "disconnected" || still === "failed") {
            attemptIceRecovery();
          }
        }, 2500);
      } else if (ice === "failed") {
        attemptIceRecovery();
        setPeerConnectionState("reconnecting");
        setConnectionQuality("poor");
      }
    };

    // A single serialized offer path for camera/screen changes. This mirrors
    // group-call peer behavior and avoids a second, delayed screen offer
    // racing the browser's negotiationneeded event.
    const negotiate = async (opts = {}) => {
      const sock = socketRef.current;
      try {
        if (modeRef.current !== "active") return;
        if (!peerRef.current?.id || !sock?.connected) return;
        if (makingOfferRef.current) return;
        if (pc.signalingState !== "stable") return;
        negotiationQueuedRef.current = false;
        makingOfferRef.current = true;
        const offer = await pc.createOffer(opts.iceRestart ? { iceRestart: true } : undefined);
        await pc.setLocalDescription(offer);
        sock.emit("call:offer", {
          toUserId: peerRef.current.id,
          offer: pc.localDescription,
          callType: callTypeRef.current || "voice",
        });
      } catch { /* ignore */ }
      finally {
        makingOfferRef.current = false;
        if (negotiationQueuedRef.current && pc.signalingState === "stable") {
          void negotiate();
        }
      }
    };
    negotiateRef.current = negotiate;
    // Skip while dialing — startCall already sends the initial offer; a
    // renegotiation request remains queued until the connection is stable.
    pc.onnegotiationneeded = () => {
      negotiationQueuedRef.current = true;
      void negotiate();
    };
    pc.onsignalingstatechange = () => {
      if (pc.signalingState === "stable" && negotiationQueuedRef.current) {
        void negotiate();
      }
    };
  }, [attachRemoteScreenTrack, markRemoteMediaReady]);

  // When returning from background (mobile home / app switcher), resume
  // remote audio and recover ICE — never hang up just because we left.
  // Also surface screen-share death that Safari/Chrome caused while hidden.
  useEffect(() => {
    if (mode !== "active") return undefined;

    const resumeAfterBackground = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      pulseCallWakeLock();

      if (screenEndedInBackgroundRef.current) {
        screenEndedInBackgroundRef.current = false;
        toast(
          tRuntime("Screen share ended while Descall was in the background."),
          "info"
        );
      }

      const audio = remoteAudioRef.current;
      if (audio) {
        try {
          audio.muted = false;
          const p = audio.play();
          if (p?.catch) p.catch(() => {});
        } catch {
          /* ignore */
        }
      }
      const video = remoteVideoRef.current;
      if (video) {
        try {
          const p = video.play();
          if (p?.catch) p.catch(() => {});
        } catch {
          /* ignore */
        }
      }
      const pc = pcRef.current;
      if (!pc || modeRef.current !== "active") return;
      const ice = pc.iceConnectionState;
      const conn = pc.connectionState;
      const unhealthy =
        ice === "disconnected" ||
        ice === "failed" ||
        conn === "disconnected" ||
        conn === "failed";
      if (!unhealthy) return;
      iceRestartAttemptedRef.current = false;
      setPeerConnectionState("reconnecting");
      setConnectionQuality("poor");
      try {
        if (negotiateRef.current) void negotiateRef.current({ iceRestart: true });
        else pc.restartIce();
        iceRestartAttemptedRef.current = true;
      } catch {
        /* ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Keep media pipeline warm while user switches apps during screen share.
        pulseCallWakeLock();
        return;
      }
      resumeAfterBackground();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", resumeAfterBackground);
    window.addEventListener("focus", resumeAfterBackground);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", resumeAfterBackground);
      window.removeEventListener("focus", resumeAfterBackground);
    };
  }, [mode, toast]);

  useEffect(() => {
    if (!socket) return;

    const onOffer = async ({ fromUser, offer, callType: incomingType } = {}) => {
      if (!fromUser?.id || !offer) return;
      if (callOccupancyRef?.current?.groupActive) {
        socketRef.current?.emit("call:decline", { toUserId: fromUser.id });
        return;
      }
      
      const pc = pcRef.current;
      const isRenegotiation = pc && modeRef.current === "active" && peerRef.current?.id === fromUser.id;
      
      if (isRenegotiation) {
        // Renegotiation with glare handling (same polite-peer rule as group calls)
        try {
          const myId = getUser()?.id || null;
          const polite = isPolitePeer(myId, fromUser.id);
          const { accepted } = await applyRemoteOffer(pc, offer, {
            polite,
            makingOffer: Boolean(makingOfferRef.current),
          });
          if (!accepted) return;
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit("call:answer", { toUserId: fromUser.id, answer: pc.localDescription });
          await flushIce(pc);
          // Peer upgraded voice → video (camera on): update UI mode
          if (incomingType === "video") {
            setCallType("video");
            setRemoteCameraOn(true);
          }
        } catch (err) { console.error("[WebRTC] Renegotiation failed:", err); }
        return;
      }

      // Already ringing / dialing this peer → refresh SDP, keep popup
      if (
        peerRef.current?.id === fromUser.id &&
        (modeRef.current === "incoming" || modeRef.current === "outgoing")
      ) {
        incomingOfferRef.current = offer;
        if (incomingType) incomingCallTypeRef.current = incomingType;
        return;
      }

      // Busy with another call — do not steal the UI
      if (modeRef.current === "active" || modeRef.current === "outgoing" || modeRef.current === "incoming") {
        socket.emit("call:decline", { toUserId: fromUser.id });
        return;
      }
      
      // New incoming call
      incomingOfferRef.current = offer;
      incomingCallTypeRef.current = incomingType || "voice";
      setRemoteCameraOn(incomingType === "video");
      setPeer({
        ...fromUser,
        avatarUrl: fromUser?.avatarUrl || fromUser?.avatar_url || null,
      });
      setCallType(incomingType || "voice");
      setMode("incoming");
      notificationService.incomingCall({ from: fromUser.username, type: incomingType || "voice" });
    };

    const onAnswer = async ({ fromUserId, answer } = {}) => {
      if (!fromUserId || !answer || !pcRef.current) return;
      if (peerRef.current?.id && fromUserId !== peerRef.current.id) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(pcRef.current);
        setMode("active");
        modeRef.current = "active";
      } catch { /* ignore */ }
    };

    const onIce = async ({ fromUserId, candidate } = {}) => {
      if (!candidate || !fromUserId) return;
      if (peerRef.current?.id && fromUserId !== peerRef.current.id) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
    };

    const onEnded = ({ fromUserId } = {}) => {
      if (!fromUserId || peerRef.current?.id === fromUserId) gracefulEnd();
    };

    const onMediaState = ({ fromUserId, muted: peerMuted, cameraOn: peerCameraOn } = {}) => {
      if (!fromUserId || fromUserId !== peerRef.current?.id) return;
      setRemoteMuted(Boolean(peerMuted));
      setRemoteCameraOn(Boolean(peerCameraOn));
    };

    const onCancelled = ({ fromUserId } = {}) => {
      if (!fromUserId || peerRef.current?.id === fromUserId) {
        audioManager.stop('incomingCall');
        gracefulEnd();
      }
    };

    const onProfileUpdated = ({ user } = {}) => {
      if (!user?.id) return;
      setPeer((prev) => (prev?.id === user.id ? patchUserAvatar(prev, user.avatarUrl || user.avatar_url, user.avatarVersion || user.updated_at) : prev));
    };

    const onUnreachable = ({ toUserId, reason } = {}) => {
      if (!toUserId || peerRef.current?.id !== toUserId) return;
      if (modeRef.current !== "outgoing") return;
      // Soft fail: keep the outgoing UI briefly so a flaky presence check
      // doesn't instantly hang up. Caller can cancel manually.
      console.warn("[Call] Callee unreachable:", toUserId, reason || "");
      setConnectionQuality("failed");
      setPeerConnectionState("disconnected");
    };

    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIce);
    socket.on('call:ended', onEnded);
    socket.on('call:declined', onEnded);
    socket.on('call:cancelled', onCancelled);
    socket.on('call:unreachable', onUnreachable);
    socket.on('call:media-state', onMediaState);

    socket.on('user:profile:updated', onProfileUpdated);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIce);
      socket.off('call:ended', onEnded);
      socket.off('call:declined', onEnded);
      socket.off('call:cancelled', onCancelled);
      socket.off('call:unreachable', onUnreachable);
      socket.off('call:media-state', onMediaState);
      socket.off('user:profile:updated', onProfileUpdated);
    };
  }, [socket, gracefulEnd, cleanup]);

  const startCall = useCallback(async (friend, type = "voice") => {
    const peerId = friend?.id || friend?.userId;
    if (!peerId) return;
    // `startCall` is intentionally stable; reading the render-time `socket`
    // here captured its initial null value and made both DM call buttons no-op.
    if (!socketRef.current?.connected) {
      toast("Call connection unavailable. Please wait and try again.", "error");
      return;
    }
    if (modeRef.current === "outgoing" || modeRef.current === "active" || modeRef.current === "incoming") {
      console.warn("[Call] startCall ignored — already in a call:", modeRef.current);
      return;
    }
    try {
      const audio = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        channelCount: { ideal: 1 },
      };
      const constraints = type === "video"
        ? { audio, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Sync peerRef immediately — unreachable/decline can arrive before React commit
      const peerObj = { ...friend, id: peerId };
      peerRef.current = peerObj;
      setPeer(peerObj);
      setCallType(type);
      setMode("outgoing");
      modeRef.current = "outgoing";
      setCameraOn(type === "video");
      setConnectionQuality("connecting");
      setPeerConnectionState("connecting");

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;
      setupPeerConnection(pc, stream, true);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!socketRef.current?.connected) {
        cleanup();
        return;
      }
      socketRef.current.emit("call:offer", { toUserId: String(peerId), offer: pc.localDescription, callType: type });
    } catch (err) {
      console.error("[Call] startCall failed:", err?.name || err?.message || err);
      cleanup();
    }
  }, [cleanup, setupPeerConnection, toast]);

  const acceptIncoming = useCallback(async () => {
    const offer = incomingOfferRef.current;
    const type = incomingCallTypeRef.current || "voice";
    // Use peerRef — Electron Accept IPC can fire with a stale React `peer` closure
    const currentPeer = peerRef.current || peer;
    if (!currentPeer?.id || !offer || !socketRef.current?.connected) return;
    if (modeRef.current !== "incoming" && modeRef.current !== "idle") {
      // Only accept while ringing (or allow if somehow idle with offer still set)
      if (modeRef.current !== "incoming") return;
    }
    try {
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCallType(type);
      setCameraOn(type === "video");

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;
      setupPeerConnection(pc, stream, false);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (!socketRef.current?.connected) {
        cleanup();
        return;
      }
      socketRef.current.emit("call:answer", { toUserId: currentPeer.id, answer: pc.localDescription });
      setMode("active");
      modeRef.current = "active";
    } catch {
      cleanup();
    }
  }, [peer, cleanup, setupPeerConnection]);

  const endCall = useCallback((toUserId) => {
    const targetId = toUserId ?? peerRef.current?.id;
    const sock = socketRef.current;
    if (targetId && sock?.connected) {
      const currentMode = modeRef.current;
      if (currentMode === 'outgoing') {
        sock.emit('call:cancel', { toUserId: targetId });
      } else {
        sock.emit('call:end', { toUserId: targetId });
      }
    }
    gracefulEnd();
  }, [gracefulEnd]);

  const declineIncoming = useCallback(() => {
    const targetId = peerRef.current?.id ?? peer?.id;
    if (targetId && socketRef.current?.connected) {
      socketRef.current.emit('call:decline', { toUserId: targetId });
    }
    cleanup();
  }, [peer, cleanup]);

  // Electron notification Accept / Decline — refs avoid stale closures from mount-once effect
  const acceptIncomingRef = useRef(acceptIncoming);
  const declineIncomingRef = useRef(declineIncoming);
  useEffect(() => { acceptIncomingRef.current = acceptIncoming; }, [acceptIncoming]);
  useEffect(() => { declineIncomingRef.current = declineIncoming; }, [declineIncoming]);

  useEffect(() => {
    if (!window.electronAPI?.onCallAccept) return;
    const unsubAccept = window.electronAPI.onCallAccept(() => {
      // Only handle DM incoming ring — group hook owns group-call accepts
      if (modeRef.current !== "incoming") return;
      acceptIncomingRef.current?.();
    });
    const unsubDecline = window.electronAPI.onCallDecline(() => {
      if (modeRef.current !== "incoming") return;
      declineIncomingRef.current?.();
    });
    return () => {
      unsubAccept?.();
      unsubDecline?.();
    };
  }, []);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
      if (peerRef.current?.id && socketRef.current?.connected) {
        socketRef.current.emit("call:media-state", {
          toUserId: peerRef.current.id,
          muted: !track.enabled,
          cameraOn: Boolean(cameraOn),
        });
      }
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (cameraOn) {
      // Stop camera - disable track but don't remove
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
      }
      if (localVideoRef.current) localVideoRef.current.style.display = "none";
      setCameraOn(false);
      if (peerRef.current?.id && socketRef.current?.connected) {
        socketRef.current.emit("call:media-state", {
          toUserId: peerRef.current.id,
          muted: Boolean(muted),
          cameraOn: false,
        });
      }
    } else {
      try {
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        let addedNewTrack = false;

        if (videoTrack) {
          // Re-enable existing track — frames resume without SDP
          videoTrack.enabled = true;
        } else {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          }
          pc.addTrack(videoTrack, localStreamRef.current);
          addedNewTrack = true;
        }

        if (localVideoRef.current) {
          localVideoRef.current.style.display = "block";
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
        setCallType("video");
        if (peerRef.current?.id && socketRef.current?.connected) {
          socketRef.current.emit("call:media-state", {
            toUserId: peerRef.current.id,
            muted: Boolean(muted),
            cameraOn: true,
          });
        }

        // addTrack schedules the single serialized offer through
        // onnegotiationneeded. A second manual offer can collide and crash
        // the remote voice-to-video upgrade.
      } catch (err) {
        console.error("[WebRTC] toggleCamera failed:", err);
      }
    }
  }, [cameraOn, muted]);

  // Keep stopScreenShareRef always pointing to latest stopScreenShare
  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  });

  const startScreenShare = useCallback(async (qualityOverride) => {
    console.log('[ScreenShare] startScreenShare called');
    const pc = pcRef.current;
    if (!pc || screenSharingRef.current) {
      console.log('[ScreenShare] abort: no pc or already sharing');
      return;
    }
    try {
      const effectiveQuality = qualityOverride || screenQualityRef.current || DM_SCREEN_DEFAULT_QUALITY;
      const { width, height, fps } = resolveScreenCaptureSize(effectiveQuality);
      let screenStream;

      if (window.electronAPI?.isElectron) {
        console.log('[ScreenShare] Electron detected, fetching sources...');
        const sources = await window.electronAPI.getScreenSources();
        console.log('[ScreenShare] sources:', sources?.length);
        if (!sources || sources.length === 0) {
          console.warn('[ScreenShare] no sources');
          return;
        }
        console.log('[ScreenShare] opening picker...');
        const sourceId = await showElectronScreenPicker(sources);
        console.log('[ScreenShare] picked sourceId:', sourceId);
        if (!sourceId) return;
        screenStream = await navigator.mediaDevices.getUserMedia(
          buildElectronDesktopConstraints(sourceId, { width, height, fps })
        );
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          toast("Screen sharing is not available in this browser.", "error");
          return;
        }
        console.log('[ScreenShare] web path — getDisplayMedia');
        // Mobile: entire screen (preferTab false) so switching to YouTube/Safari
        // home does not end a Descall-tab-only capture.
        screenStream = await getDisplayMediaStream({
          width,
          height,
          fps,
          preferTab: !isMobileScreenCapture(),
        });
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      await optimizeScreenShareTrack(screenTrack, {
        width,
        height,
        fps,
        contentHint: effectiveQuality.contentHint || "motion",
      });
      if (screenTrack.readyState !== "live") {
        screenStream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (isMobileScreenCapture()) {
        toast(
          tRuntime("Share your entire screen so switching apps keeps the broadcast alive."),
          "info"
        );
      }

      const { track: screenAudioTrack } = await ensureScreenShareAudioTrack(screenStream);
      if (!screenAudioTrack) {
        toast(
          tRuntime(
            isMobileScreenCapture()
              ? "This device can’t share system/tab audio with screen share."
              : "No system/tab audio selected — enable “Share audio” in the picker for sound."
          ),
          "info"
        );
      }

      // Tell the peer to reserve the next video track for the screen layout
      // before WebRTC can deliver that track.
      if (peerRef.current?.id && socketRef.current?.connected) {
        socketRef.current.emit("screen:share-start", { toUserId: peerRef.current.id });
      }

      // Add screen track - this triggers onnegotiationneeded
      const screenSender = pc.addTrack(screenTrack, screenStream);
      if (screenAudioTrack) {
        screenAudioSenderRef.current = pc.addTrack(screenAudioTrack, screenStream);
      }
      await optimizeScreenShareSender(screenSender, {
        maxBitrate: 1_500_000,
        maxFramerate: fps,
      });
      screenSenderRef.current = screenSender;
      screenStreamRef.current = screenStream;
      setScreenStream(screenStream);
      screenSharingRef.current = true;
      intentionalScreenStopRef.current = false;
      screenEndedInBackgroundRef.current = false;
      pulseCallWakeLock();

      // `addTrack` schedules the sole renegotiation through
      // `onnegotiationneeded`. A second delayed offer causes glare and was the
      // main source of tracks arriving before their screen-share signal.

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
        screenVideoRef.current.play().catch((e) => {});
      }

      screenTrack.onended = () => {
        // Browser ends display tracks when the app backgrounds or the user
        // leaves a tab-only capture. Don't treat that as a deliberate stop
        // while hidden — clean up, then toast when they return.
        if (intentionalScreenStopRef.current) {
          intentionalScreenStopRef.current = false;
          return;
        }
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          screenEndedInBackgroundRef.current = true;
        }
        stopScreenShareRef.current?.();
      };

      setScreenSharing(true);
    } catch (err) {
    }
  }, [toast]);

  const stopScreenShare = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || !screenSharingRef.current) return;
    intentionalScreenStopRef.current = true;

    if (screenSenderRef.current) {
      try { pc.removeTrack(screenSenderRef.current); } catch {}
      screenSenderRef.current = null;
    }
    if (screenAudioSenderRef.current) {
      try { pc.removeTrack(screenAudioSenderRef.current); } catch {}
      screenAudioSenderRef.current = null;
    }
    if (screenAudioCtxRef.current) {
      try { screenAudioCtxRef.current.close(); } catch { /* ignore */ }
      screenAudioCtxRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    screenSharingRef.current = false;
    setScreenStream(null);
    setScreenSharing(false);
    if (peerRef.current?.id && socketRef.current?.connected) {
      socketRef.current.emit("screen:share-stop", { toUserId: peerRef.current.id });
    }
  }, []);

  const restartScreenShareWithQuality = useCallback(
    async (nextQuality) => {
      if (!screenSharingRef.current) {
        setScreenQuality(nextQuality);
        return;
      }
      stopScreenShare();
      await new Promise((r) => setTimeout(r, 120));
      setScreenQuality(nextQuality);
      screenQualityRef.current = nextQuality;
      await startScreenShare(nextQuality);
    },
    [startScreenShare, stopScreenShare]
  );

  const handleRemoteScreenShareStart = useCallback((fromUserId) => {
    if (!fromUserId || fromUserId !== peerRef.current?.id) return;
    remoteScreenSharingRef.current = true;
    setRemoteScreenSharing(true);

    // Screen signaling can arrive after a fast ontrack callback. Display
    // streams carry no audio; select the most recently received such track
    // instead of blindly moving the latest receiver (which can be a camera).
    const candidate = [...receivedVideoTracksRef.current.values()]
      .filter(({ track, hasAudio }) => track.readyState !== "ended" && !hasAudio)
      .sort((a, b) => b.receivedAt - a.receivedAt)[0];
    const screenTrack = candidate?.track;
    if (!screenTrack || remoteScreenStreamRef.current?.getVideoTracks().includes(screenTrack)) return;

    setRemoteStream((prev) => {
      if (!prev?.getVideoTracks().includes(screenTrack)) return prev;
      const remaining = prev.getTracks().filter((track) => track !== screenTrack);
      const next = remaining.length ? new MediaStream(remaining) : null;
      remoteStreamRef.current = next;
      return next;
    });
    attachRemoteScreenTrack(screenTrack, candidate.stream);
  }, [attachRemoteScreenTrack]);

  const handleRemoteScreenShareStop = useCallback((fromUserId) => {
    if (!fromUserId || fromUserId !== peerRef.current?.id) return;
    remoteScreenSharingRef.current = false;
    setRemoteScreenSharing(false);
    setRemoteScreenStream(null);
    remoteScreenStreamRef.current = null;
  }, []);

  // DM screen events are separate from SDP. The explicit signal is needed to
  // reserve/recover the display track before camera-layout heuristics run.
  useEffect(() => {
    if (!socket) return;

    const onScreenShareStart = ({ fromUserId } = {}) => {
      handleRemoteScreenShareStart(fromUserId);
    };
    const onScreenShareStop = ({ fromUserId } = {}) => {
      handleRemoteScreenShareStop(fromUserId);
    };

    socket.on("screen:share-start", onScreenShareStart);
    socket.on("screen:share-stop", onScreenShareStop);
    return () => {
      socket.off("screen:share-start", onScreenShareStart);
      socket.off("screen:share-stop", onScreenShareStop);
    };
  }, [socket, handleRemoteScreenShareStart, handleRemoteScreenShareStop]);

  // Change active microphone mid-call
  const setAudioInput = useCallback(async (deviceId) => {
    setSelectedAudioInput(deviceId);
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } }, video: false });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;
      localStreamRef.current.getAudioTracks().forEach(t => { t.stop(); localStreamRef.current.removeTrack(t); });
      localStreamRef.current.addTrack(newTrack);
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === "audio");
        if (sender) await sender.replaceTrack(newTrack);
      }
      setLocalStream(localStreamRef.current);
    } catch (_) {}
  }, []);

  // Change active speaker/output mid-call
  const setAudioOutput = useCallback((deviceId) => {
    setSelectedAudioOutput(deviceId);
    if (remoteAudioRef.current?.setSinkId) {
      remoteAudioRef.current.setSinkId(deviceId).catch(() => {});
    }
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Computed state properties for UI rendering
  const isInCall = mode === "active";
  const isCalling = mode === "outgoing";
  const isReceiving = mode === "incoming";

  return {
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    screenVideoRef,
    mode,
    callType,
    peer,
    muted,
    cameraOn,
    remoteMuted,
    remoteCameraOn,
    screenSharing,
    duration,
    connectionQuality,
    networkStats,
    peerConnectionState,
    remoteMediaReady,
    localStream,
    remoteStream,
    remoteScreenStream,
    remoteScreenSharing,
    screenStream,
    isInCall,
    isCalling,
    isReceiving,
    formatDuration,
    startCall,
    endCall,
    acceptIncoming,
    declineIncoming,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    screenQuality,
    setScreenQuality,
    restartScreenShareWithQuality,
    handleRemoteScreenShareStart,
    handleRemoteScreenShareStop,
    cleanup,
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    setAudioInput,
    setAudioOutput,
  };
}

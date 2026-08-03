import { useCallback, useEffect, useRef, useState } from "react";
import { patchUserAvatar } from "../lib/userProfile";
import audioManager from "../lib/audioManager";
import notificationService from "../lib/notificationService";
import {
  buildDisplayMediaConstraints,
  buildElectronDesktopConstraints,
  optimizeScreenShareSender,
  optimizeScreenShareTrack,
  resolveScreenCaptureSize,
  GROUP_SCREEN_DEFAULT_QUALITY,
} from "../lib/webrtcScreenShare";
import { getIceServers, preloadIceServers } from "../lib/iceConfig";

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
export function useCall(socket) {
  const [mode, setMode] = useState(null); // null | "incoming" | "outgoing" | "active"
  const [callType, setCallType] = useState(null); // null | "voice" | "video"
  const [peer, setPeer] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState("unknown");
  const [peerConnectionState, setPeerConnectionState] = useState("idle");
  const [remoteMediaReady, setRemoteMediaReady] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");
  const [screenQuality, setScreenQuality] = useState(GROUP_SCREEN_DEFAULT_QUALITY);
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
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
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
  const screenSharingRef = useRef(false);
  const stopScreenShareRef = useRef(null);
  const cleanupTimerRef = useRef(null);

  useEffect(() => { peerRef.current = peer; }, [peer]);

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
    setScreenStream(null);
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    pendingIceRef.current = [];
    screenSenderRef.current = null;
    screenSharingRef.current = false;
    setMode(null);
    setCallType(null);
    setPeer(null);
    setMuted(false);
    setCameraOn(false);
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

  const setupPeerConnection = useCallback((pc, stream, isInitiator) => {
    setPeerConnectionState("connecting");
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const track = e.track;
      // Mid-call camera renegotiation may omit e.streams — wrap the track.
      const raw = e.streams?.[0];
      const rs = (raw && raw.getTracks().length > 0) ? raw : new MediaStream([track]);

      // Force a state update even when the same MediaStream gains a new track
      // (same object identity would otherwise skip React re-renders).
      setRemoteStream((prev) => {
        if (prev && prev !== rs) {
          // Merge newly arrived track into the existing remote stream when possible
          try {
            if (track && !prev.getTracks().includes(track)) prev.addTrack(track);
            return new MediaStream(prev.getTracks());
          } catch {
            /* fall through */
          }
        }
        if (prev === rs) return new MediaStream(rs.getTracks());
        return rs;
      });
      markRemoteMediaReady(rs);

      // Voice → camera upgrade: flip call type so UI mounts the remote <video>
      if (track?.kind === "video") {
        setCallType("video");
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
        setRemoteStream((prev) => {
          if (!prev) return prev;
          const remaining = prev.getTracks().filter((t) => t !== track && t.readyState !== "ended");
          return remaining.length ? new MediaStream(remaining) : null;
        });
      };
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && peerRef.current?.id && socket?.connected) {
        socket.emit("call:ice-candidate", { toUserId: peerRef.current.id, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setMode("active");
        setConnectionQuality("good");
        setPeerConnectionState("connected");
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

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") {
        setConnectionQuality("good");
        setPeerConnectionState("connected");
      } else if (ice === "checking") {
        setPeerConnectionState("connecting");
        setConnectionQuality("connecting");
      } else if (ice === "disconnected") {
        setPeerConnectionState("reconnecting");
        setConnectionQuality("poor");
      } else if (ice === "failed") {
        setPeerConnectionState("disconnected");
        setConnectionQuality("failed");
      }
    };

    // Handle renegotiation for screen/camera changes after call is active.
    // Skip while dialing — startCall already sends the initial offer; a second
    // offer from negotiationneeded can race and confuse the callee popup.
    pc.onnegotiationneeded = async () => {
      try {
        if (modeRef.current !== "active") return;
        if (!peerRef.current?.id || !socket?.connected) return;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", {
          toUserId: peerRef.current.id,
          offer: pc.localDescription,
          callType: callType || "voice",
        });
      } catch { /* ignore */ }
    };
  }, [socket, callType, markRemoteMediaReady]);

  useEffect(() => {
    if (!socket) return;

    const onOffer = async ({ fromUser, offer, callType: incomingType } = {}) => {
      if (!fromUser?.id || !offer) return;
      
      const pc = pcRef.current;
      const isRenegotiation = pc && modeRef.current === "active" && peerRef.current?.id === fromUser.id;
      
      if (isRenegotiation) {
        // Renegotiation: update remote description and create answer
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call:answer", { toUserId: fromUser.id, answer: pc.localDescription });
          await flushIce(pc);
          // Peer upgraded voice → video (camera on): update UI mode
          if (incomingType === "video") setCallType("video");
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

    socket.on('user:profile:updated', onProfileUpdated);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIce);
      socket.off('call:ended', onEnded);
      socket.off('call:declined', onEnded);
      socket.off('call:cancelled', onCancelled);
      socket.off('call:unreachable', onUnreachable);
      socket.off('user:profile:updated', onProfileUpdated);
    };
  }, [socket, gracefulEnd, cleanup]);

  const startCall = useCallback(async (friend, type = "voice") => {
    const peerId = friend?.id || friend?.userId;
    if (!peerId || !socket) return;
    if (modeRef.current === "outgoing" || modeRef.current === "active" || modeRef.current === "incoming") {
      console.warn("[Call] startCall ignored — already in a call:", modeRef.current);
      return;
    }
    try {
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };

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
      socket.emit("call:offer", { toUserId: String(peerId), offer: pc.localDescription, callType: type });
    } catch (err) {
      console.error("[Call] startCall failed:", err?.name || err?.message || err);
      cleanup();
    }
  }, [socket, cleanup, setupPeerConnection]);

  const acceptIncoming = useCallback(async () => {
    const offer = incomingOfferRef.current;
    const type = incomingCallTypeRef.current || "voice";
    // Use peerRef — Electron Accept IPC can fire with a stale React `peer` closure
    const currentPeer = peerRef.current || peer;
    if (!currentPeer?.id || !offer || !socket) return;
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
      socket.emit("call:answer", { toUserId: currentPeer.id, answer: pc.localDescription });
      setMode("active");
      modeRef.current = "active";
    } catch {
      cleanup();
    }
  }, [peer, socket, cleanup, setupPeerConnection]);

  const endCall = useCallback((toUserId) => {
    const targetId = toUserId ?? peerRef.current?.id;
    if (targetId && socket?.connected) {
      const currentMode = modeRef.current;
      if (currentMode === 'outgoing') {
        socket.emit('call:cancel', { toUserId: targetId });
      } else {
        socket.emit('call:end', { toUserId: targetId });
      }
    }
    gracefulEnd();
  }, [socket, gracefulEnd]);

  const declineIncoming = useCallback(() => {
    const targetId = peerRef.current?.id ?? peer?.id;
    if (targetId && socket?.connected) socket.emit('call:decline', { toUserId: targetId });
    cleanup();
  }, [peer, socket, cleanup]);

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

        // Renegotiate so the remote peer gets the new video m-line
        if (addedNewTrack) {
          for (let i = 0; i < 10 && pc.signalingState !== "stable"; i += 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
          if (pc.signalingState === "stable") {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (peerRef.current?.id && socket?.connected) {
              socket.emit("call:offer", {
                toUserId: peerRef.current.id,
                offer: pc.localDescription,
                callType: "video",
              });
            }
          } else {
            console.warn("[WebRTC] camera renegotiate skipped — signaling not stable");
          }
        }
      } catch (err) {
        console.error("[WebRTC] toggleCamera failed:", err);
      }
    }
  }, [cameraOn, socket]);

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
      const effectiveQuality = qualityOverride || screenQualityRef.current || GROUP_SCREEN_DEFAULT_QUALITY;
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
        console.log('[ScreenShare] web path — getDisplayMedia');
        screenStream = await navigator.mediaDevices.getDisplayMedia(
          buildDisplayMediaConstraints({ width, height, fps })
        );
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      await optimizeScreenShareTrack(screenTrack, { width, height, fps });
      
      // Add screen track - this triggers onnegotiationneeded
      const screenSender = pc.addTrack(screenTrack, screenStream);
      await optimizeScreenShareSender(screenSender, {
        maxBitrate: 1_500_000,
        maxFramerate: fps,
      });
      screenSenderRef.current = screenSender;
      screenStreamRef.current = screenStream;
      setScreenStream(screenStream);
      screenSharingRef.current = true;

      // Manual renegotiation fallback
      setTimeout(async () => {
        if (pc.signalingState === "stable" && peerRef.current?.id && socket?.connected) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("call:offer", {
              toUserId: peerRef.current.id,
              offer: pc.localDescription,
              callType: "screen",
            });
          } catch (err) {
          }
        }
      }, 500);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
        screenVideoRef.current.play().catch((e) => {});
      }

      screenTrack.onended = () => {
        if (stopScreenShareRef.current) stopScreenShareRef.current();
      };

      setScreenSharing(true);
      if (peerRef.current?.id && socket?.connected) {
        socket.emit("screen:share-start", { toUserId: peerRef.current.id });
      }
    } catch (err) {
    }
  }, [socket]);

  const stopScreenShare = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || !screenSharingRef.current) return;

    if (screenSenderRef.current) {
      try { pc.removeTrack(screenSenderRef.current); } catch {}
      screenSenderRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    screenSharingRef.current = false;
    setScreenStream(null);
    setScreenSharing(false);
    if (peerRef.current?.id && socket?.connected) {
      socket.emit("screen:share-stop", { toUserId: peerRef.current.id });
    }
  }, [socket]);

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
    screenSharing,
    duration,
    connectionQuality,
    peerConnectionState,
    remoteMediaReady,
    localStream,
    remoteStream,
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
    cleanup,
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    setAudioInput,
    setAudioOutput,
  };
}

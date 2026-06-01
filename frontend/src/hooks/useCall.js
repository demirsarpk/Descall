import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";
import notificationService from "../lib/notificationService";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");

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
    // Stop all call sounds
    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
  }, []);

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

  const setupPeerConnection = useCallback((pc, stream, isInitiator) => {
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const rs = e.streams[0];
      setRemoteStream(rs);
      const track = e.track;
      
      // Store remote stream for later use
      if (track.kind === "audio" && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = rs;
        remoteAudioRef.current.muted = false; // Ensure not muted
        remoteAudioRef.current.play().catch((err) => {});
      }

      if (track.kind === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = rs;
        remoteVideoRef.current.play().catch((err) => {});
      }
      
      // Handle muted tracks - wait for unmute
      if (track?.muted) {
        track.onunmute = () => {
          if (track.kind === "video" && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = rs;
            remoteVideoRef.current.play().catch((err) => {});
          }
          if (track.kind === "audio" && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = rs;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch((err) => {});
          }
        };
      }
      
      // Also attach combined stream to both refs for safety
      if (remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject = rs;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch((err) => {});
      }
      if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = rs;
        remoteVideoRef.current.play().catch((err) => {});
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && peerRef.current?.id && socket?.connected) {
        socket.emit("call:ice-candidate", { toUserId: peerRef.current.id, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setMode("active");
        setConnectionQuality("good");
      } else if (pc.connectionState === "disconnected") {
        setConnectionQuality("poor");
      } else if (pc.connectionState === "failed") {
        setConnectionQuality("failed");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setConnectionQuality("good");
      } else if (pc.iceConnectionState === "checking") {
        setConnectionQuality("connecting");
      } else if (pc.iceConnectionState === "failed") {
        setConnectionQuality("failed");
      }
    };

    // Handle renegotiation for both initiator and responder
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (peerRef.current?.id && socket?.connected) {
          socket.emit("call:offer", {
            toUserId: peerRef.current.id,
            offer: pc.localDescription,
            callType: callType || "voice",
          });
        }
      } catch { /* ignore */ }
    };
  }, [socket, callType]);

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
        } catch (err) { console.error("[WebRTC] Renegotiation failed:", err); }
        return;
      }
      
      // New incoming call
      incomingOfferRef.current = offer;
      incomingCallTypeRef.current = incomingType || "voice";
      setPeer(fromUser);
      setCallType(incomingType || "voice");
      setMode("incoming");
      notificationService.incomingCall({ from: fromUser.username, type: incomingType || "voice" });
    };

    const onAnswer = async ({ fromUserId, answer } = {}) => {
      if (!fromUserId || !answer || !pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(pcRef.current);
        setMode("active");
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
      if (peerRef.current?.id === fromUserId) cleanup();
    };

    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onIce);
    socket.on("call:ended", onEnded);
    socket.on("call:declined", onEnded);

    return () => {
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onIce);
      socket.off("call:ended", onEnded);
      socket.off("call:declined", onEnded);
    };
  }, [socket, cleanup]);

  const startCall = useCallback(async (friend, type = "voice") => {
    if (!friend?.id || !socket) return;
    try {
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setPeer(friend);
      setCallType(type);
      setMode("outgoing");
      setCameraOn(type === "video");

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      setupPeerConnection(pc, stream, true);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", { toUserId: friend.id, offer: pc.localDescription, callType: type });
    } catch {
      cleanup();
    }
  }, [socket, cleanup, setupPeerConnection]);

  const acceptIncoming = useCallback(async () => {
    const offer = incomingOfferRef.current;
    const type = incomingCallTypeRef.current || "voice";
    if (!peer?.id || !offer || !socket) return;
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

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      setupPeerConnection(pc, stream, false);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { toUserId: peer.id, answer: pc.localDescription });
      setMode("active");
    } catch {
      cleanup();
    }
  }, [peer, socket, cleanup, setupPeerConnection]);

  const endCall = useCallback((toUserId) => {
    if (toUserId && socket?.connected) socket.emit("call:end", { toUserId });
    cleanup();
  }, [socket, cleanup]);

  const declineIncoming = useCallback(() => {
    if (peer?.id) socket.emit("call:decline", { toUserId: peer.id });
    cleanup();
  }, [peer, socket, cleanup]);

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
        // Check if we already have a video track
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        
        if (videoTrack) {
          // Re-enable existing track
          videoTrack.enabled = true;
        } else {
          // Get new video stream
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          
          // Add to local stream
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          }
          
          // Add to peer connection - use transceiver to ensure it's sent
          const sender = pc.addTrack(videoTrack, localStreamRef.current);
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.style.display = "block";
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch((e) => {});
        }
        setCameraOn(true);
        setCallType("video");
        
        // Trigger renegotiation for new track
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
        }
      } catch (err) { 
      }
    }
  }, [cameraOn, socket]);

  // Keep stopScreenShareRef always pointing to latest stopScreenShare
  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  });

  const startScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || screenSharingRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", width: 1920, height: 1080 },
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      
      // Add screen track - this triggers onnegotiationneeded
      const screenSender = pc.addTrack(screenTrack, screenStream);
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
    cleanup,
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    setAudioInput,
    setAudioOutput,
  };
}

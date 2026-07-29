import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";
import notificationService from "../lib/notificationService";
import { getUser } from "../lib/storage";

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

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Group Call Hook - Simplified multi-peer WebRTC
 * Based on working DM call (useCall.js) with Map for multiple peers
 */
export function useGroupCall(socket, currentUserId = null) {
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callType, setCallType] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const incomingCallRef = useRef(null);
  const [activeCallBanner, setActiveCallBanner] = useState(null); // { groupId, initiatorId, initiatorUsername, callType, participantCount }
  const [callSummaries, setCallSummaries] = useState({}); // groupId -> summary[]
  // Audio device selection states
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");
  
  // Screen sharing quality settings
  const [screenQuality, setScreenQuality] = useState({
    resolution: '1080p', // '720p' | '1080p'
    fps: 30, // 30 | 60 | 120 | 240
  });

  const socketRef = useRef(socket);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pcMapRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const remoteAudioRefs = useRef(new Map());
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const myIdRef = useRef(null);
  const timerRef = useRef(null);
  const screenSenderRef = useRef(null);
  const isInCallRef = useRef(false);
  const callTypeRef = useRef(null);
  const incomingDedupeRef = useRef(new Map()); // groupId -> ts

  useEffect(() => { socketRef.current = socket; }, [socket]);

  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    if (currentUserId) {
      myIdRef.current = currentUserId;
      return;
    }
    const stored = getUser()?.id;
    if (stored) myIdRef.current = stored;
  }, [currentUserId]);

  // Cleanup on unmount - prevent resource leaks
  useEffect(() => {
    return () => {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Stop all local streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close all peer connections
      pcMapRef.current.forEach(peerData => {
        try {
          peerData.pc.close();
        } catch (error) {
            }
      });
      pcMapRef.current.clear();
      
      // Clear remote streams
      remoteStreamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      remoteStreamsRef.current.clear();
      
      // Clear audio refs
      remoteAudioRefs.current.forEach(audio => {
        if (audio) {
          audio.srcObject = null;
        }
      });
      remoteAudioRefs.current.clear();
      
    };
  }, []);

  // Enumerate audio devices on mount
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioInputDevices(inputs);
        setAudioOutputDevices(outputs);
        if (!selectedAudioInput && inputs.length > 0) {
          setSelectedAudioInput(inputs[0].deviceId);
        }
        if (!selectedAudioOutput && outputs.length > 0) {
          setSelectedAudioOutput(outputs[0].deviceId);
        }
      } catch (err) {
      }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  useEffect(() => {
    if (!isInCall) return;
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isInCall]);

  const cleanup = useCallback(() => {
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDuration(0);

    pcMapRef.current.forEach((peerData, userId) => {
      if (peerData.pc) peerData.pc.close();
    });
    pcMapRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    
    // Stop all remote streams before clearing
    remoteStreamsRef.current.forEach((stream, userId) => {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    });
    remoteStreamsRef.current.clear();
    
    // Properly cleanup remote audio elements
    remoteAudioRefs.current.forEach((audioEl, userId) => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (e) {
        console.warn(`[GroupCall] Error removing audio for ${userId}:`, e);
      }
    });
    remoteAudioRefs.current.clear();

    screenSenderRef.current = null;

    setIsInCall(false);
    setIsInitiator(false);
    setCallType(null);
    setActiveGroupId(null);
    setLocalStream(null);
    setScreenStream(null);
    setIsMuted(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setParticipants([]);
    setIncomingCall(null);

    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
  }, []);

  const setupPeerConnection = useCallback((pc, stream, userId, groupId) => {
    stream.getTracks().forEach((t) => {
      t.enabled = true;
      pc.addTrack(t, stream);
    });

    pc.ontrack = (e) => {
      const track = e.track;
      // e.streams[0] may be undefined or empty during renegotiation — fall back to wrapping the track.
      const rawStream = e.streams?.[0];
      const incomingStream = (rawStream && rawStream.getTracks().length > 0)
        ? rawStream
        : new MediaStream([track]);

      // Screen share detection: video track whose stream carries no audio,
      // OR whose label explicitly mentions the screen/display surface
      const isScreenTrack = track.kind === "video" &&
        (track.label?.toLowerCase().includes("screen") ||
         track.label?.toLowerCase().includes("display") ||
         track.label?.toLowerCase().includes("window") ||
         track.label?.toLowerCase().includes("tab") ||
         incomingStream.getAudioTracks().length === 0);

      if (track.kind === "audio") {
        // Audio always belongs to the main participant stream
        remoteStreamsRef.current.set(userId, incomingStream);
        let audioEl = remoteAudioRefs.current.get(userId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.muted = false;
          audioEl.playsInline = true;
          audioEl.style.display = "none";
          document.body.appendChild(audioEl);
          remoteAudioRefs.current.set(userId, audioEl);
        }
        audioEl.srcObject = incomingStream;
        audioEl.play().catch(() => {});
        track.onunmute = () => {
          audioEl.srcObject = incomingStream;
          audioEl.play().catch(() => {});
        };
      }

      if (isScreenTrack) {
        // Dedicated screen share stream — store separately on the participant
        const applyScreenStream = () => {
          setParticipants((prev) => {
            if (userId === myIdRef.current) return prev;
            const exists = prev.find((p) => p.id === userId);
            if (exists) {
              return prev.map((p) => p.id === userId
                ? { ...p, screenStream: incomingStream, isScreenSharing: true }
                : p
              );
            }
            const storedUser = pcMapRef.current.get(userId)?.fromUser;
            return [...prev, {
              id: userId,
              stream: null,
              screenStream: incomingStream,
              hasVideo: false,
              hasAudio: false,
              isScreenSharing: true,
              username: storedUser?.username || storedUser?.displayName || "Member",
              avatarUrl: storedUser?.avatar_url || null,
            }];
          });
        };
        applyScreenStream();
        // Track may be muted until ICE/DTLS completes — re-apply on unmute
        // so the video element gets re-attached and stops showing black.
        track.onunmute = applyScreenStream;
        return; // don't fall through to camera logic
      }

      if (track.kind === "video") {
        // Camera video track
        remoteStreamsRef.current.set(userId, incomingStream);
        const applyCameraStream = () => {
          setParticipants((prev) => {
            if (userId === myIdRef.current) return prev;
            const exists = prev.find((p) => p.id === userId);
            if (exists) {
              return prev.map((p) => p.id === userId
                ? { ...p, stream: incomingStream, hasVideo: true }
                : p
              );
            }
            const storedUser = pcMapRef.current.get(userId)?.fromUser;
            return [...prev, {
              id: userId,
              stream: incomingStream,
              screenStream: null,
              hasVideo: true,
              hasAudio: false,
              isScreenSharing: false,
              username: storedUser?.username || storedUser?.displayName || "Member",
              avatarUrl: storedUser?.avatar_url || null,
            }];
          });
        };
        applyCameraStream();
        track.onunmute = applyCameraStream;
      }

      // For audio-only participants, ensure they appear in the list
      if (track.kind === "audio") {
        setParticipants((prev) => {
          if (userId === myIdRef.current) return prev;
          if (prev.find((p) => p.id === userId)) {
            return prev.map((p) => p.id === userId ? { ...p, hasAudio: true } : p);
          }
          const storedUser = pcMapRef.current.get(userId)?.fromUser;
          return [...prev, {
            id: userId,
            stream: incomingStream,
            screenStream: null,
            hasVideo: false,
            hasAudio: true,
            isScreenSharing: false,
            username: storedUser?.username || storedUser?.displayName || "Member",
            avatarUrl: storedUser?.avatar_url || null,
          }];
        });
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit("group:call:ice", {
          groupId,
          toUserId: userId,
          candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
      } else if (pc.connectionState === "disconnected") {
        // Don't delete participant on disconnected - they might reconnect
      } else if (pc.connectionState === "failed") {
        // Don't immediately delete on failed - might recover
        // Only delete if no tracks are working
        const remoteStream = remoteStreamsRef.current.get(userId);
        if (!remoteStream || remoteStream.getTracks().length === 0) {
          pcMapRef.current.delete(userId);
          remoteStreamsRef.current.delete(userId);
          setParticipants((prev) => prev.filter((p) => p.id !== userId));
        }
      } else if (pc.connectionState === "closed") {
        pcMapRef.current.delete(userId);
        remoteStreamsRef.current.delete(userId);
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      }
    };
  }, []);

  const flushIce = async (pc, userId) => {
    const peerData = pcMapRef.current.get(userId);
    if (!peerData || !peerData.pendingIce?.length) return;
    
    
    const failedCandidates = [];
    
    for (const candidate of peerData.pendingIce) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        failedCandidates.push(candidate);
      }
    }
    
    // Keep failed candidates if connection still viable
    peerData.pendingIce = failedCandidates;
    
    // Clear if connection failed
    if (failedCandidates.length > 0 && pc.connectionState === 'failed') {
      peerData.pendingIce = [];
    }
  };

  const startGroupCall = useCallback(async (groupId, type, memberIds = []) => {
    if (!groupId || !type || !socketRef.current) return;
    
    try {
      // OPTIMIZED: Low latency audio constraints to reduce 1-2 second delay
      const constraints = type === "video"
        ? { 
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true,
              autoGainControl: true,
              latency: { ideal: 0.01 }, // 10ms target latency
              sampleRate: { ideal: 48000 }, // Standard VoIP sample rate
              channelCount: { ideal: 2 }
            }, 
            video: { width: 1280, height: 720, facingMode: "user" } 
          }
        : { 
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true,
              autoGainControl: true,
              latency: { ideal: 0.01 }, // 10ms target latency
              sampleRate: { ideal: 48000 },
              channelCount: { ideal: 2 }
            }, 
            video: false 
          };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Ensure audio track is enabled for voice calls
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      
      setIsInCall(true);
      setIsInitiator(true);
      setCallType(type);
      setActiveGroupId(groupId);
      setIsCameraOn(type === "video");
      setIncomingCall(null);

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Set up peer connections for all group members
      memberIds.forEach((userId) => {
        if (userId === myIdRef.current) return;
        
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const peerData = { pc, pendingIce: [] };
        pcMapRef.current.set(userId, peerData);
        
        setupPeerConnection(pc, stream, userId, groupId);
        
      });

      // Ensure we're in the group socket room to receive left/ended events
      socketRef.current.emit("group:join", groupId);

      // Emit start event
      socketRef.current.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds,
      });

      // Immediately set the banner for the initiator — the server only pushes
      // group:call:active-banner to users who join later via group:join
      setActiveCallBanner({
        groupId,
        initiatorId: myIdRef.current,
        initiatorUsername: getUser()?.username || socketRef.current?.user?.username || "You",
        callType: type,
        participantCount: 1,
        participants: [myIdRef.current],
        startTime: Date.now(),
      });

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone and camera permissions are required for calls. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone or camera found. Please connect a device and try again.');
      } else if (err.name === 'NotReadableError') {
        alert('Microphone or camera is already in use by another application.');
      } else {
        alert('Failed to start call. Please check your device permissions and try again.');
      }
      cleanup();
    }
  }, [cleanup, setupPeerConnection]);

  const acceptGroupCall = useCallback(async (groupId, type, fromUser) => {
    if (!groupId || !fromUser?.id || !socketRef.current) return;
    if (isInCall) return;
    
    try {
      audioManager.stop("incomingCall");

      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Ensure audio track is enabled for voice calls
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      
      setIsInCall(true);
      setIsInitiator(false);
      setCallType(type);
      setActiveGroupId(groupId);
      setIsCameraOn(type === "video");
      setIncomingCall(null);

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Register the initiator in participants with correct username immediately
      // — before WebRTC ontrack fires (which would fall back to 'Member')
      setParticipants([{
        id: fromUser.id,
        username: fromUser.username || fromUser.displayName || "Member",
        avatarUrl: fromUser.avatar_url || fromUser.avatarUrl,
        hasVideo: type === "video",
        hasAudio: true,
      }]);

      // Join the group socket room so group:call:left/ended events are received
      socketRef.current.emit("group:join", groupId);

      // Send accept signal - initiator will then send offer
      socketRef.current.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
      });

      setActiveCallBanner((prev) => prev ?? {
        groupId,
        initiatorId: fromUser.id,
        initiatorUsername: fromUser.username || "Unknown",
        callType: type,
        participantCount: 2,
        participants: [fromUser.id, myIdRef.current],
      });

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone and camera permissions are required for calls. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone or camera found. Please connect a device and try again.');
      } else if (err.name === 'NotReadableError') {
        alert('Microphone or camera is already in use by another application.');
      } else {
        alert('Failed to join call. Please check your device permissions and try again.');
      }
      cleanup();
    }
  }, [cleanup, isInCall]);

  const declineCall = useCallback((groupId, fromUserId, fromUser, callType) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:call:decline", { groupId, toUserId: fromUserId });
    }
    audioManager.stop("incomingCall");
    setIncomingCall(null);
    // Keep the ongoing call banner visible so the user can join later
    setActiveCallBanner((prev) => prev ?? {
      groupId,
      initiatorId: fromUserId,
      initiatorUsername: fromUser?.username || "Unknown",
      callType: callType || "voice",
      participantCount: 1,
      participants: fromUserId ? [fromUserId] : [],
    });
  }, []);

  const leaveCall = useCallback(() => {
    if (activeGroupId && socketRef.current?.connected) {
      socketRef.current.emit("group:call:leave", { groupId: activeGroupId });
    }
    cleanup();
  }, [activeGroupId, cleanup]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
      }
      if (localVideoRef.current) localVideoRef.current.style.display = "none";
      setIsCameraOn(false);
    } else {
      try {
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        
        if (videoTrack) {
          videoTrack.enabled = true;
        } else {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" },
          });
          videoTrack = videoStream.getVideoTracks()[0];
          
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          }
          
          pcMapRef.current.forEach((peerData, userId) => {
            try {
              peerData.pc.addTrack(videoTrack, localStreamRef.current);
            } catch (err) {
            }
          });
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.style.display = "block";
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
        setIsCameraOn(true);
        setCallType("video");
      } catch (err) {
      }
    }
  }, [isCameraOn]);

  const startScreenShare = useCallback(async (quality) => {
    console.log('[GroupScreenShare] startScreenShare called, quality:', quality);
    try {
      // Use provided quality or fall back to current state
      const effectiveQuality = quality || screenQuality;
      
      if (isScreenSharing) {
        console.log('[GroupScreenShare] abort: already sharing');
        return;
      }
      
      // Calculate resolution based on setting with optimized performance
      const resolutionMap = {
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
        '1440p': { width: 2560, height: 1440 },
        '2160p': { width: 3840, height: 2160 },
        'custom': { width: 1920, height: 1080 }, // Default to 1080p for custom
      };
      
      const { width, height } = resolutionMap[effectiveQuality.resolution] || resolutionMap['1080p'];
      const frameRate = effectiveQuality.fps || 30;
      
      let stream;

      if (window.electronAPI?.isElectron) {
        console.log('[GroupScreenShare] Electron detected, fetching sources...');
        const sources = await window.electronAPI.getScreenSources();
        console.log('[GroupScreenShare] sources:', sources?.length);
        if (!sources || sources.length === 0) {
          console.warn('[GroupScreenShare] no sources');
          return;
        }
        console.log('[GroupScreenShare] opening picker...');
        const sourceId = await showElectronScreenPicker(sources);
        console.log('[GroupScreenShare] picked sourceId:', sourceId);
        if (!sourceId) return;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: width,
              maxWidth: width,
              minHeight: height,
              maxHeight: height,
            },
          },
        });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            cursor: "always",
            displaySurface: "monitor",
            width: { ideal: width, max: width },
            height: { ideal: height, max: height },
            frameRate: { ideal: frameRate, max: frameRate },
            resizeMode: "crop-and-scale",
            aspectRatio: width / height
          },
          audio: false,
        });
      }
      
      const screenTrack = stream.getVideoTracks()[0];
      
      // Store original track settings for restoration
      const originalConstraints = screenTrack.getConstraints();
      screenStreamRef.current = stream;
      setScreenStream(stream);
      
      // Always addTrack with the dedicated screen stream for every peer.
      // replaceTrack does NOT fire ontrack on the remote side — the remote
      // peer would never learn about the screen stream and shows black.
      for (const [userId, peerData] of pcMapRef.current.entries()) {
        try {
          const sender = peerData.pc.addTrack(screenTrack, stream);
          // Store per-peer so stopScreenShare can removeTrack precisely
          peerData.screenSender = sender;

          const offer = await peerData.pc.createOffer();
          await peerData.pc.setLocalDescription(offer);
          socketRef.current.emit("group:call:offer", {
            groupId: activeGroupId,
            toUserId: userId,
            offer: peerData.pc.localDescription,
            callType: callType || "voice",
          });
        } catch (err) {
          console.error(`[GroupCall] Screen share addTrack failed for ${userId}:`, err);
        }
      }

      // Set local preview after all operations complete
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      // Handle screen share end
      screenTrack.onended = () => {
        stopScreenShare();
      };

      setIsScreenSharing(true);
      
      if (socketRef.current?.connected) {
        socketRef.current.emit("group:screen:start", { groupId: activeGroupId });
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
      }
    }
  }, [isScreenSharing, activeGroupId, screenQuality]);

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing) return;

    const hadCamera = localStreamRef.current?.getVideoTracks().length > 0;
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    
    // Remove the dedicated screen sender from every peer and renegotiate
    for (const [userId, peerData] of pcMapRef.current.entries()) {
      try {
        const screenSender = peerData.screenSender;
        if (!screenSender) continue;
        peerData.pc.removeTrack(screenSender);
        delete peerData.screenSender;

        const offer = await peerData.pc.createOffer();
        await peerData.pc.setLocalDescription(offer);
        socketRef.current.emit("group:call:offer", {
          groupId: activeGroupId,
          toUserId: userId,
          offer: peerData.pc.localDescription,
          callType: callType || "voice",
        });
      } catch (err) {
        console.error(`[GroupCall] Screen share removeTrack failed for ${userId}:`, err);
      }
    }
    
    // Clean up references and state
    screenSenderRef.current = null;
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    
    // Clear local preview after cleanup
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current.load(); // Force release
    }
    
    setScreenStream(null);
    setIsScreenSharing(false);
    
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:screen:stop", { groupId: activeGroupId });
    }
  }, [activeGroupId, isScreenSharing]);

  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ groupId, fromUser, callType: type, groupName } = {}) => {
      const myId = myIdRef.current;
      if (!groupId || !fromUser?.id) return;
      if (myId && fromUser.id === myId) return;

      // Deduplicate dual delivery (user room + group room)
      const now = Date.now();
      const prevAt = incomingDedupeRef.current.get(groupId) || 0;
      if (now - prevAt < 2500) return;
      incomingDedupeRef.current.set(groupId, now);

      if (isInCallRef.current) {
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }

      setIncomingCall({ groupId, fromUser, callType: type || "voice" });
      audioManager.play("incomingCall", { loop: true });
      notificationService.groupCall({ groupName: groupName || "Grup", from: fromUser.username });
    };

    socket.on("group:call:incoming", onIncoming);
    return () => {
      socket.off("group:call:incoming", onIncoming);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    
    const myId = myIdRef.current || currentUserId || getUser()?.id || null;
    if (myId) myIdRef.current = myId;

    const onAccept = async ({ groupId, fromUserId, fromUser }) => {
      if (!fromUserId) return;
      
      const stream = localStreamRef.current;
      if (!stream) return;

      // Register participant with correct username before peer connection fires ontrack
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === fromUserId);
        if (exists) {
          return prev.map((p) => p.id === fromUserId
            ? { ...p, username: fromUser?.username || p.username, avatarUrl: fromUser?.avatar_url || p.avatarUrl }
            : p
          );
        }
        return [...prev, {
          id: fromUserId,
          username: fromUser?.username || fromUser?.displayName || "Member",
          avatarUrl: fromUser?.avatar_url,
          hasVideo: callTypeRef.current === "video",
          hasAudio: true,
        }];
      });

      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        // Store fromUser so ontrack's new-entry fallback can use the real username
        const peerData = { pc, pendingIce: [], fromUser };
        pcMapRef.current.set(fromUserId, peerData);
        
        setupPeerConnection(pc, stream, fromUserId, groupId);

        // Create and send offer to the callee
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("group:call:offer", {
          groupId,
          toUserId: fromUserId,
          offer: pc.localDescription,
          callType: callTypeRef.current || "voice",
        });

      } catch (err) {
      }
    };

    // Handle when a new participant joins an existing call
    const onParticipantJoined = async ({ groupId, fromUserId, fromUser }) => {
      if (!fromUserId || fromUserId === myIdRef.current) return;

      // Update username if we already have this participant with 'Member' placeholder
      setParticipants((prev) => prev.map((p) =>
        p.id === fromUserId && (!p.username || p.username === "Member")
          ? { ...p, username: fromUser?.username || fromUser?.displayName || p.username }
          : p
      ));
      
      const stream = localStreamRef.current;
      if (!stream) return;

      if (pcMapRef.current.has(fromUserId)) return;

      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        // Store fromUser so ontrack's new-entry fallback can use the real username
        const peerData = { pc, pendingIce: [], fromUser };
        pcMapRef.current.set(fromUserId, peerData);

        setupPeerConnection(pc, stream, fromUserId, groupId);

        // If we're currently screen sharing, add the screen track to this new peer
        // so they see the screen share immediately without needing a separate event.
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        if (screenTrack && screenTrack.readyState === "live") {
          const sender = pc.addTrack(screenTrack, screenStreamRef.current);
          peerData.screenSender = sender;
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("group:call:offer", {
          groupId,
          toUserId: fromUserId,
          offer: pc.localDescription,
          callType: callTypeRef.current || "voice",
        });

      } catch (err) {
      }
    };

    const onAnswer = async ({ groupId, fromUserId, answer }) => {
      if (!fromUserId || !answer) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      if (!peerData) {
        return;
      }

      try {
        // Only accept the answer when we're waiting for one (have-local-offer).
        // This correctly handles both initial setup and subsequent renegotiations
        // (screen share, camera toggle, etc.) without blocking any of them.
        if (peerData.pc.signalingState !== 'have-local-offer') {
          return;
        }
        
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(peerData.pc, fromUserId);
        
        // Ensure all local tracks are enabled
        localStreamRef.current?.getTracks().forEach(track => {
          track.enabled = true;
        });
        
      } catch (err) {
      }
    };

    const onOffer = async ({ groupId, fromUserId, offer }) => {
      if (!fromUserId || !offer) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      if (!peerData) {
        // If we don't have a PC yet, we need to wait for the stream
        const stream = localStreamRef.current;
        if (!stream) {
          return;
        }
        
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const newPeerData = { pc, pendingIce: [] };
        pcMapRef.current.set(fromUserId, newPeerData);
        
        setupPeerConnection(pc, stream, fromUserId, groupId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        // Ensure all local tracks are enabled
        stream.getTracks().forEach(track => {
          track.enabled = true;
        });
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer: pc.localDescription,
        });
        
        console.log(`[GroupCall] Answer sent to ${fromUserId}`);
        return;
      }

      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerData.pc.createAnswer();
        await peerData.pc.setLocalDescription(answer);
        
        // Ensure all local tracks are enabled
        localStreamRef.current?.getTracks().forEach(track => {
          track.enabled = true;
        });
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer: peerData.pc.localDescription,
        });
        
      } catch (err) {
      }
    };

    const onIce = async ({ groupId, fromUserId, candidate }) => {
      if (!fromUserId || !candidate) return;
      
      const peerData = pcMapRef.current.get(fromUserId);
      
      if (!peerData || !peerData.pc || !peerData.pc.remoteDescription) {
        // Queue ICE candidate until both a real peer connection and remote
        // description are available — do NOT create a stub entry with pc=null
        if (peerData && peerData.pc) {
          if (!peerData.pendingIce) peerData.pendingIce = [];
          peerData.pendingIce.push(candidate);
        }
        // If peerData doesn't exist yet, the candidate arrives before the offer;
        // flushIce is called from the offer handler once the PC is set up.
        return;
      }

      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Non-fatal error - connection may still work
      }
    };

    const onLeft = ({ groupId, userId }) => {
      const peerData = pcMapRef.current.get(userId);
      if (peerData?.pc) {
        try { peerData.pc.close(); } catch (_) {}
      }
      pcMapRef.current.delete(userId);

      const remoteStream = remoteStreamsRef.current.get(userId);
      if (remoteStream) {
        remoteStream.getTracks().forEach((t) => t.stop());
      }
      remoteStreamsRef.current.delete(userId);

      const audioEl = remoteAudioRefs.current.get(userId);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        remoteAudioRefs.current.delete(userId);
      }

      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    const onEnded = ({ groupId, summary }) => {
      setActiveCallBanner((prev) => (prev?.groupId === groupId ? null : prev));
      if (groupId === activeGroupId) {
        cleanup();
      }
    };

    const onCallSummary = ({ groupId, summary }) => {
      if (!groupId || !summary) return;
      setCallSummaries((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), summary],
      }));
    };

    const onActiveBanner = ({ groupId, initiatorId, initiatorUsername, callType, participantCount, participants, startTime }) => {
      setActiveCallBanner({ groupId, initiatorId, initiatorUsername, callType, participantCount, participants, startTime: startTime ?? Date.now() });
    };

    const onParticipantLeft = ({ groupId, userId }) => {
      setActiveCallBanner((prev) => {
        if (!prev || prev.groupId !== groupId) return prev;
        const updated = (prev.participantCount ?? 1) - 1;
        if (updated <= 0) return null;
        return { ...prev, participantCount: updated };
      });
    };

    const onDeclined = ({ groupId, fromUserId, fromUser }) => {
      const peerData = pcMapRef.current.get(fromUserId);
      if (peerData?.pc) peerData.pc.close();
      pcMapRef.current.delete(fromUserId);
      remoteStreamsRef.current.delete(fromUserId);
      setParticipants((prev) => prev.filter((p) => p.id !== fromUserId));
    };

    // Called when this client (non-initiator) declines an incoming call —
    // the call is still active on the server so we show the ongoing banner
    const onIncomingDeclined = ({ groupId, fromUser, callType: type }) => {
      audioManager.stop("incomingCall");
      setIncomingCall(null);
      // Show the active call banner so the user can join later
      setActiveCallBanner((prev) => prev ?? {
        groupId,
        initiatorId: fromUser?.id,
        initiatorUsername: fromUser?.username || "Unknown",
        callType: type,
        participantCount: 1,
        participants: fromUser?.id ? [fromUser.id] : [],
      });
    };

    const onScreenStarted = ({ groupId, fromUserId }) => {
      setParticipants((prev) => prev.map((p) => 
        p.id === fromUserId ? { ...p, isScreenSharing: true } : p
      ));
    };

    const onScreenStopped = ({ groupId, fromUserId }) => {
      setParticipants((prev) => prev.map((p) =>
        p.id === fromUserId ? { ...p, isScreenSharing: false, screenStream: null } : p
      ));
    };

    const onParticipants = ({ groupId, participants: enrichedList, callType: existingCallType }) => {
      if (!enrichedList?.length) return;
      setParticipants((prev) => {
        const updated = prev.map((p) => {
          const match = enrichedList.find((e) => e.id === p.id);
          if (!match) return p;
          return { ...p, username: match.username || p.username, avatarUrl: match.avatar_url || p.avatarUrl, isScreenSharing: match.isScreenSharing ?? p.isScreenSharing };
        });
        // Add any participants the server knows about that aren't in state yet
        enrichedList.forEach((e) => {
          if (!updated.find((p) => p.id === e.id) && e.id !== myId) {
            updated.push({
              id: e.id,
              username: e.username || "Member",
              avatarUrl: e.avatar_url || null,
              hasVideo: existingCallType === "video",
              hasAudio: true,
              isScreenSharing: e.isScreenSharing || false,
            });
          }
        });
        return updated;
      });
    };

    const onCallStarted = ({ groupId, fromUserId, fromUser, callType: startedType }) => {
      if (!fromUserId || fromUserId === myIdRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.id === fromUserId)) return prev;
        return [...prev, {
          id: fromUserId,
          username: fromUser?.username || fromUser?.displayName || "Member",
          avatarUrl: fromUser?.avatar_url,
          hasVideo: startedType === "video",
          hasAudio: true,
        }];
      });
    };

    // Handle server telling us to join an existing call instead of starting new
    const onJoinExisting = async ({ groupId, initiatorId, callType: existingCallType, participants: existingParticipants }) => {
      
      if (isInCallRef.current) {
        return;
      }

      try {
        // Get media stream
        const constraints = existingCallType === "video"
          ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
          : { audio: true, video: false };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
        
        // Enable audio tracks
        stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        
        setIsInCall(true);
        setIsInitiator(false); // We're joining, not initiating
        setCallType(existingCallType);
        setActiveGroupId(groupId);
        setIsCameraOn(existingCallType === "video");

        if (localVideoRef.current && existingCallType === "video") {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        // Add existing participants to our list
        existingParticipants.forEach((userId) => {
          if (userId !== myId) {
            setParticipants((prev) => {
              if (prev.find((p) => p.id === userId)) return prev;
              return [...prev, {
                id: userId,
                username: "Member",
                hasVideo: existingCallType === "video",
                hasAudio: true,
              }];
            });

            // Set up peer connection for each existing participant
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const peerData = { pc, pendingIce: [] };
            pcMapRef.current.set(userId, peerData);
            
            setupPeerConnection(pc, stream, userId, groupId);
          }
        });

        // Join the group socket room to receive left/ended events
        socket.emit("group:join", groupId);
        // Notify server we're joining
        socket.emit("group:call:join", { groupId, callType: existingCallType });

      } catch (err) {
        cleanup();
      }
    };

    socket.on("group:call:accepted", onAccept);
    socket.on("group:call:answer", onAnswer);
    socket.on("group:call:ice", onIce);
    socket.on("group:call:offer", onOffer);
    socket.on("group:call:left", onLeft);
    socket.on("group:call:ended", onEnded);
    socket.on("group:call:declined", onDeclined);
    socket.on("group:screen:started", onScreenStarted);
    socket.on("group:screen:stopped", onScreenStopped);
    socket.on("group:call:participant-joined", onParticipantJoined);
    socket.on("group:call:started", onCallStarted);
    socket.on("group:call:join-existing", onJoinExisting);
    socket.on("group:call:summary", onCallSummary);
    socket.on("group:call:active-banner", onActiveBanner);
    socket.on("group:call:left", onParticipantLeft);
    socket.on("group:call:participants", onParticipants);

    return () => {
      socket.off("group:call:accepted", onAccept);
      socket.off("group:call:answer", onAnswer);
      socket.off("group:call:ice", onIce);
      socket.off("group:call:offer", onOffer);
      socket.off("group:call:left", onLeft);
      socket.off("group:call:left", onParticipantLeft);
      socket.off("group:call:ended", onEnded);
      socket.off("group:call:declined", onDeclined);
      socket.off("group:screen:started", onScreenStarted);
      socket.off("group:screen:stopped", onScreenStopped);
      socket.off("group:call:participant-joined", onParticipantJoined);
      socket.off("group:call:started", onCallStarted);
      socket.off("group:call:join-existing", onJoinExisting);
      socket.off("group:call:summary", onCallSummary);
      socket.off("group:call:active-banner", onActiveBanner);
      socket.off("group:call:participants", onParticipants);
    };
  }, [socket, cleanup, setupPeerConnection, currentUserId]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Keep ref current so Electron IPC callbacks can read latest incomingCall without stale closure
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // Electron notification Accept / Decline buttons for group calls
  useEffect(() => {
    if (!window.electronAPI?.onCallAccept) return;
    const unsubAccept = window.electronAPI.onCallAccept(() => {
      const ic = incomingCallRef.current;
      if (ic) acceptGroupCall(ic.groupId, ic.callType, ic.fromUser);
    });
    const unsubDecline = window.electronAPI.onCallDecline(() => {
      const ic = incomingCallRef.current;
      if (ic) declineCall(ic.groupId, ic.fromUser?.id, ic.fromUser, ic.callType);
    });
    return () => {
      unsubAccept?.();
      unsubDecline?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocalVideo = useCallback((ref) => {
    localVideoRef.current = ref;
  }, []);

  const setScreenVideo = useCallback((ref) => {
    screenVideoRef.current = ref;
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Replace audio track for voice effects
  const replaceTrack = useCallback((newTrack) => {
    if (!localStreamRef.current || !newTrack) return;
    
    pcMapRef.current.forEach((peerData, userId) => {
      try {
        const sender = peerData.pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(newTrack);
        }
      } catch (err) {
      }
    });

    // Update local stream ref
    const oldAudioTracks = localStreamRef.current.getAudioTracks();
    if (oldAudioTracks.length > 0) {
      localStreamRef.current.removeTrack(oldAudioTracks[0]);
      oldAudioTracks[0].stop();
    }
    localStreamRef.current.addTrack(newTrack);
    setLocalStream(localStreamRef.current);
  }, []);

  // Change audio input device
  const setAudioInput = useCallback(async (deviceId) => {
    setSelectedAudioInput(deviceId);
    if (!localStreamRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      if (!newAudioTrack) return;

      // Stop and remove old audio tracks from the local stream first
      const oldAudioTracks = localStreamRef.current.getAudioTracks();
      oldAudioTracks.forEach((t) => {
        t.stop();
        localStreamRef.current.removeTrack(t);
      });
      localStreamRef.current.addTrack(newAudioTrack);

      // Replace the track on all active peer senders
      const replacePromises = [];
      pcMapRef.current.forEach((peerData) => {
        const sender = peerData.pc?.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) replacePromises.push(sender.replaceTrack(newAudioTrack));
      });
      await Promise.all(replacePromises);

      setLocalStream(localStreamRef.current);
    } catch (err) {
    }
  }, []);

  // Change audio output device
  const setAudioOutput = useCallback((deviceId) => {
    setSelectedAudioOutput(deviceId);
    remoteAudioRefs.current.forEach(async (audioEl, userId) => {
      try {
        if (audioEl.setSinkId) {
          await audioEl.setSinkId(deviceId);
        }
      } catch (err) {
      }
    });
  }, []);

  const dismissActiveBanner = useCallback(() => setActiveCallBanner(null), []);

  const joinActiveCall = useCallback(async (banner) => {
    if (!banner?.groupId || !socketRef.current || isInCall) return;
    const { groupId, callType: type, participants: existingParticipants = [] } = banner;
    try {
      const constraints = type === "video"
        ? { audio: true, video: { width: 1280, height: 720, facingMode: "user" } }
        : { audio: true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getAudioTracks().forEach((t) => { t.enabled = true; });
      setIsInCall(true);
      setIsInitiator(false);
      setCallType(type);
      setActiveGroupId(groupId);
      setIsCameraOn(type === "video");
      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      const myId = myIdRef.current;
      existingParticipants.forEach((userId) => {
        if (userId === myId) return;
        setParticipants((prev) => {
          if (prev.find((p) => p.id === userId)) return prev;
          return [...prev, { id: userId, username: "Member", hasVideo: type === "video", hasAudio: true }];
        });
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcMapRef.current.set(userId, { pc, pendingIce: [] });
        setupPeerConnection(pc, stream, userId, groupId);
      });
      socketRef.current.emit("group:join", groupId);
      socketRef.current.emit("group:call:join", { groupId, callType: type });
    } catch (err) {
      cleanup();
    }
  }, [isInCall, cleanup, setupPeerConnection]);

  return {
    isInCall,
    isInitiator,
    callType,
    activeGroupId,
    localStream,
    screenStream,
    isMuted,
    isCameraOn,
    isScreenSharing,
    duration,
    participants,
    incomingCall,
    activeCallBanner,
    dismissActiveBanner,
    callSummaries,
    remoteStreams: remoteStreamsRef,
    localVideoRef,
    screenVideoRef,
    setLocalVideo,
    screenQuality,
    setScreenQuality,
    setScreenVideo,
    startGroupCall,
    acceptGroupCall,
    joinActiveCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    replaceTrack,
    formatDuration,
    cleanup,
    // Audio device selection
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    setAudioInput,
    setAudioOutput,
  };
}

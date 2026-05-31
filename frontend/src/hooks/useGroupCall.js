import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Group Call Hook - Simplified multi-peer WebRTC
 * Based on working DM call (useCall.js) with Map for multiple peers
 */
export function useGroupCall(socket) {
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

  useEffect(() => { socketRef.current = socket; }, [socket]);

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

  const setupPeerConnection = useCallback((pc, stream, userId) => {
    stream.getTracks().forEach((t) => {
      t.enabled = true;
      pc.addTrack(t, stream);
    });

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      const track = e.track;
      
      remoteStreamsRef.current.set(userId, remoteStream);
      
      // Create audio element for this user if it doesn't exist
      if (track.kind === "audio") {
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
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((err) => {});
      }
      
      // Handle muted tracks
      if (track?.muted) {
        track.onunmute = () => {
          if (track.kind === "audio") {
            const audioEl = remoteAudioRefs.current.get(userId);
            if (audioEl) {
              audioEl.srcObject = remoteStream;
              audioEl.play().catch((err) => {});
            }
          }
        };
      }
      
      // Detect screen share track: video without audio or label containing "screen"
      const isScreenTrack = track.kind === "video" && 
        (track.label?.toLowerCase().includes("screen") || 
         (remoteStream.getVideoTracks().length > 0 && remoteStream.getAudioTracks().length === 0));
      
      const hasVideoTrack = track.kind === "video" && !isScreenTrack;
      
      setParticipants((prev) => {
        // Exclude local user from participants list to prevent duplication
        if (userId === myIdRef.current) {
          return prev;
        }
        
        const exists = prev.find((p) => p.id === userId);
        if (exists) {
          return prev.map((p) => p.id === userId ? { 
            ...p, 
            stream: remoteStream,
            screenStream: isScreenTrack ? remoteStream : p.screenStream,
            hasVideo: hasVideoTrack || p.hasVideo,
            hasAudio: track.kind === "audio" || p.hasAudio,
            isScreenSharing: isScreenTrack ? true : (p.isScreenSharing || false)
          } : p);
        }
        return [...prev, { 
          id: userId, 
          stream: remoteStream, 
          screenStream: isScreenTrack ? remoteStream : null,
          hasVideo: hasVideoTrack, 
          hasAudio: track.kind === "audio",
          isScreenSharing: isScreenTrack || false,
          username: "Member" 
        }];
      });
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.connected) {
        socketRef.current.emit("group:call:ice", {
          groupId: activeGroupId,
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
  }, [activeGroupId, callType]);

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
        
        setupPeerConnection(pc, stream, userId);
        
      });

      // Emit start event
      socketRef.current.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds,
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

      // Send accept signal - initiator will then send offer
      socketRef.current.emit("group:call:accept", {
        groupId,
        toUserId: fromUser.id,
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
  }, [cleanup]);

  const declineCall = useCallback((groupId, fromUserId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("group:call:decline", { groupId, toUserId: fromUserId });
    }
    setIncomingCall(null);
    audioManager.stop("incomingCall");
  }, []);

  const leaveCall = useCallback(() => {
    if (activeGroupId && socketRef.current?.connected) {
      socketRef.current.emit("group:call:leave", { groupId: activeGroupId });
      if (isInitiator) {
        socketRef.current.emit("group:call:end", { groupId: activeGroupId });
      }
    }
    cleanup();
  }, [activeGroupId, isInitiator, cleanup]);

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
    try {
      // Use provided quality or fall back to current state
      const effectiveQuality = quality || screenQuality;
      
      if (isScreenSharing) {
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
      const frameRate = effectiveQuality.fps || 30; // Support higher FPS now
      
      
      // OPTIMIZED: Get display media with performance constraints
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          cursor: "always",
          displaySurface: "monitor",
          width: { ideal: width, max: width },
          height: { ideal: height, max: height },
          frameRate: { ideal: frameRate, max: frameRate },
          // Performance optimizations
          resizeMode: "crop-and-scale",
          aspectRatio: width / height
        },
        audio: false,
      });
      
      const screenTrack = stream.getVideoTracks()[0];
      
      // Store original track settings for restoration
      const originalConstraints = screenTrack.getConstraints();
      screenStreamRef.current = stream;
      setScreenStream(stream);
      
      // OPTIMIZED: Batch track operations to prevent flicker
      const trackOperations = [];
      
      // Replace camera track with screen track or add if no video exists
      for (const [userId, peerData] of pcMapRef.current.entries()) {
        try {
          const senders = peerData.pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          
          if (videoSender) {
            // Video call - replace camera with screen
            trackOperations.push({
              type: 'replace',
              userId,
              sender: videoSender,
              track: screenTrack
            });
            screenSenderRef.current = videoSender;
          } else {
            // Voice-only call - need to add track and renegotiate
            trackOperations.push({
              type: 'add',
              userId,
              peerConnection: peerData.pc,
              track: screenTrack,
              stream
            });
          }
        } catch (err) {
          console.error(`[GroupCall] Failed to prepare track operation for ${userId}:`, err);
        }
      }
      
      // Execute all track operations in sequence to prevent flicker
      for (const operation of trackOperations) {
        try {
          if (operation.type === 'replace') {
            await operation.sender.replaceTrack(operation.track);
          } else if (operation.type === 'add') {
            operation.peerConnection.addTrack(operation.track, operation.stream);
            
            // Renegotiate - create new offer
            const offer = await operation.peerConnection.createOffer();
            await operation.peerConnection.setLocalDescription(offer);
            
            socketRef.current.emit("group:call:offer", {
              groupId: activeGroupId,
              toUserId: operation.userId,
              offer: operation.peerConnection.localDescription,
              callType: "video", // Upgrade to video for screen share
            });
          }
        } catch (err) {
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
    
    // OPTIMIZED: Batch track operations to prevent flicker
    const trackOperations = [];
    
    // Prepare track restoration operations
    for (const [userId, peerData] of pcMapRef.current.entries()) {
      try {
        const senders = peerData.pc.getSenders();
        if (cameraTrack) {
          // Has camera - find the current video sender for this peer and replace with camera
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            trackOperations.push({
              type: 'replace',
              userId,
              sender: videoSender,
              track: cameraTrack
            });
          }
        } else {
          // Voice-only call - remove screen track sender and renegotiate
          const screenSender = senders.find(s => s.track?.kind === 'video');
          if (screenSender) {
            trackOperations.push({
              type: 'remove',
              userId,
              peerConnection: peerData.pc,
              sender: screenSender
            });
          }
        }
      } catch (err) {
      }
    }
    
    // Execute all track operations in sequence to prevent flicker
    for (const operation of trackOperations) {
      try {
        if (operation.type === 'replace') {
          await operation.sender.replaceTrack(operation.track);
        } else if (operation.type === 'remove') {
          operation.peerConnection.removeTrack(operation.sender);
          
          // Renegotiate back to audio-only
          const offer = await operation.peerConnection.createOffer();
          await operation.peerConnection.setLocalDescription(offer);
          
          socketRef.current.emit("group:call:offer", {
            groupId: activeGroupId,
            toUserId: operation.userId,
            offer: operation.peerConnection.localDescription,
            callType: "voice",
          });
          console.log(`[GroupCall] Renegotiation offer (back to voice) sent to ${operation.userId}`);
        }
      } catch (err) {
        console.error(`[GroupCall] Failed to execute stop operation for ${operation.userId}:`, err);
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
    
    const myId = socket.user?.id;
    myIdRef.current = myId;

    const onIncoming = ({ groupId, fromUser, callType: type }) => {
      if (!groupId || !fromUser?.id || fromUser.id === myId) return;
      if (isInCall) {
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }
      setIncomingCall({ groupId, fromUser, callType: type });
      audioManager.play("incomingCall", { loop: true });
    };

    const onAccept = async ({ groupId, fromUserId, fromUser }) => {
      if (!fromUserId) return;
      
      const stream = localStreamRef.current;
      if (!stream) {
        return;
      }

      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const peerData = { pc, pendingIce: [] };
        pcMapRef.current.set(fromUserId, peerData);
        
        setupPeerConnection(pc, stream, fromUserId);

        // Create and send offer to the callee
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("group:call:offer", {
          groupId,
          toUserId: fromUserId,
          offer: pc.localDescription,
          callType: callType || "voice",
        });

      } catch (err) {
      }
    };

    // Handle when a new participant joins an existing call
    const onParticipantJoined = async ({ groupId, fromUserId, fromUser }) => {
      if (!fromUserId || fromUserId === myId) return;
      
      const stream = localStreamRef.current;
      if (!stream) {
        return;
      }

      // Check if we already have a connection with this user
      if (pcMapRef.current.has(fromUserId)) {
        return;
      }

      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const peerData = { pc, pendingIce: [] };
        pcMapRef.current.set(fromUserId, peerData);
        
        setupPeerConnection(pc, stream, fromUserId);

        // Create and send offer to the new participant
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("group:call:offer", {
          groupId,
          toUserId: fromUserId,
          offer: pc.localDescription,
          callType: callType || "voice",
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
        // Check if we already have a remote description (duplicate answer)
        if (peerData.pc.remoteDescription) {
          return;
        }
        
        // Only set remote description if we're in the right state
        if (peerData.pc.signalingState === 'stable') {
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
        
        setupPeerConnection(pc, stream, fromUserId);
        
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
      pcMapRef.current.delete(userId);
      remoteStreamsRef.current.delete(userId);
      const audioEl = remoteAudioRefs.current.get(userId);
      if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove();
        remoteAudioRefs.current.delete(userId);
      }
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    const onEnded = ({ groupId }) => {
      if (groupId === activeGroupId) {
        cleanup();
      }
    };

    const onDeclined = ({ groupId, fromUserId }) => {
      const peerData = pcMapRef.current.get(fromUserId);
      if (peerData?.pc) {
        peerData.pc.close();
      }
      pcMapRef.current.delete(fromUserId);
      remoteStreamsRef.current.delete(fromUserId);
      setParticipants((prev) => prev.filter((p) => p.id !== fromUserId));
    };

    const onScreenStarted = ({ groupId, fromUserId }) => {
      setParticipants((prev) => prev.map((p) => 
        p.id === fromUserId ? { ...p, isScreenSharing: true } : p
      ));
    };

    const onScreenStopped = ({ groupId, fromUserId }) => {
      setParticipants((prev) => prev.map((p) => 
        p.id === fromUserId ? { ...p, isScreenSharing: false } : p
      ));
    };

    const onCallStarted = ({ groupId, fromUserId, fromUser, callType }) => {
      if (!fromUserId || fromUserId === myId) return;
      
      // Add participant to list if not already there
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === fromUserId);
        if (!exists) {
          const participant = {
            id: fromUserId,
            username: fromUser?.username || "Member",
            avatar_url: fromUser?.avatar_url,
            hasVideo: callType === "video",
            hasAudio: true,
          };
          return [...prev, participant];
        }
        return prev;
      });
    };

    // Handle server telling us to join an existing call instead of starting new
    const onJoinExisting = async ({ groupId, initiatorId, callType: existingCallType, participants: existingParticipants }) => {
      
      if (isInCall) {
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
              const exists = prev.find((p) => p.id === userId);
              if (!exists) {
                return [...prev, {
                  id: userId,
                  username: "Member",
                  hasVideo: existingCallType === "video",
                  hasAudio: true,
                }];
              }
              return prev;
            });

            // Set up peer connection for each existing participant
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const peerData = { pc, pendingIce: [] };
            pcMapRef.current.set(userId, peerData);
            
            setupPeerConnection(pc, stream, userId);
          }
        });

        // Notify server we're joining
        socket.emit("group:call:join", { groupId, callType: existingCallType });

      } catch (err) {
        cleanup();
      }
    };

    socket.on("group:call:incoming", onIncoming);
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

    return () => {
      socket.off("group:call:incoming", onIncoming);
      socket.off("group:call:accepted", onAccept);
      socket.off("group:call:answer", onAnswer);
      socket.off("group:call:ice", onIce);
      socket.off("group:call:offer", onOffer);
      socket.off("group:call:left", onLeft);
      socket.off("group:call:ended", onEnded);
      socket.off("group:call:declined", onDeclined);
      socket.off("group:screen:started", onScreenStarted);
      socket.off("group:screen:stopped", onScreenStopped);
      socket.off("group:call:participant-joined", onParticipantJoined);
      socket.off("group:call:started", onCallStarted);
      socket.off("group:call:join-existing", onJoinExisting);
    };
  }, [socket, activeGroupId, isInCall, callType, cleanup, setupPeerConnection]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

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
    remoteStreams: remoteStreamsRef,
    localVideoRef,
    screenVideoRef,
    setLocalVideo,
    screenQuality,
    setScreenQuality,
    setScreenVideo,
    startGroupCall,
    acceptGroupCall,
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

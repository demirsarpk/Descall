import { useCallback, useEffect, useRef, useState } from "react";
import audioManager from "../lib/audioManager";
import notificationService from "../lib/notificationService";
import { patchUserAvatar, pickEquippedCosmetics } from "../lib/userProfile";
import { getUser } from "../lib/storage";
import {
  GROUP_SCREEN_DEFAULT_QUALITY,
  isRemoteScreenVideoTrack,
  optimizeScreenShareSender,
  optimizeScreenShareTrack,
  resolveScreenCaptureSize,
  screenBitrateForPeerCount,
  ensureScreenShareAudioTrack,
  isMobileScreenCapture,
  captureScreenShareStream,
  showElectronScreenPicker,
} from "../lib/webrtcScreenShare";
import {
  applyRemoteOffer,
  chainTrackUnmute,
  isPolitePeer,
} from "../lib/webrtcNegotiation";
import { preloadIceServers } from "../lib/iceConfig";
import { createPeerConnection, attachLocalTracks, safeClosePeer } from "../lib/webrtcPeerFactory";
import { sampleConnectionStats } from "../lib/connectionStats";
import { applyAdaptiveVideoEncoding, applyAdaptiveAudioEncoding } from "../lib/adaptiveBitrate";
import { useToast } from "../context/ToastContext";
import { t as tRuntime } from "../i18n/runtime";
import { acquireCallWakeLock, releaseCallWakeLock, pulseCallWakeLock } from "../lib/callWakeLock";
import { startDesCoinHeartbeat } from "../lib/descoinHeartbeat";
import {
  acquireVoiceMicStream,
  disposeNoiseSuppressionSession,
  setNoiseSuppressedTrackEnabled,
} from "../lib/noiseSuppression";

/** Build / merge a group-call participant row, keeping shop cosmetics. */
function buildCallParticipant(user, extras = {}) {
  const id = user?.id || extras.id;
  if (!id) return null;
  return {
    id,
    username: user?.username || user?.displayName || extras.username || "Member",
    avatarUrl: user?.avatarUrl || user?.avatar_url || extras.avatarUrl || null,
    ...pickEquippedCosmetics(user),
    ...extras,
    id,
  };
}

export function useGroupCall(socket, currentUserId = null, callOccupancyRef = null) {
  const { toast } = useToast();
  const [isInCall, setIsInCall] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [callType, setCallType] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const incomingCallRef = useRef(null);
  const activeGroupIdRef = useRef(null);
  // Group currently open in the chat UI (may differ from activeGroupIdRef,
  // which is only set while *this* client is actually in a call). Used to
  // re-sync the "ongoing call" banner on reconnect — see onConnect below.
  const viewingGroupIdRef = useRef(null);
  const pendingIceByUserRef = useRef(new Map()); // userId -> candidate[] before PC exists
  const [activeCallBanner, setActiveCallBanner] = useState(null); // { groupId, initiatorId, initiatorUsername, callType, participantCount }
  const [callSummaries, setCallSummaries] = useState({}); // groupId -> summary[]
  // Audio device selection states
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");
  
  // Screen sharing quality settings
  const [screenQuality, setScreenQuality] = useState(GROUP_SCREEN_DEFAULT_QUALITY);

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
  const screenAudioCtxRef = useRef(null);
  const intentionalScreenStopRef = useRef(false);
  const screenEndedInBackgroundRef = useRef(false);
  const isInCallRef = useRef(false);
  const callTypeRef = useRef(null);
  const incomingDedupeRef = useRef(new Map()); // groupId -> ts
  const screenQualityRef = useRef(screenQuality);
  const renegotiateWithPeerRef = useRef(null);
  const stopScreenShareRef = useRef(null);

  useEffect(() => {
    preloadIceServers().catch(() => {});
  }, []);

  useEffect(() => { socketRef.current = socket; }, [socket]);

  useEffect(() => {
    screenQualityRef.current = screenQuality;
  }, [screenQuality]);

  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);

  // Keep the screen awake / tab exempt from background throttling for as
  // long as a group call is active — screen lock and aggressive tab
  // suspension are common causes of calls silently dropping on mobile.
  useEffect(() => {
    if (isInCall) {
      acquireCallWakeLock({ title: "Descall group call" });
    } else {
      releaseCallWakeLock();
    }
  }, [isInCall]);

  // Resume media + ICE after background; explain screen-share death on return.
  useEffect(() => {
    if (!isInCall) return undefined;

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
      for (const peerData of pcMapRef.current.values()) {
        const pc = peerData?.pc;
        if (!pc) continue;
        const ice = pc.iceConnectionState;
        const conn = pc.connectionState;
        const unhealthy =
          ice === "disconnected" ||
          ice === "failed" ||
          conn === "disconnected" ||
          conn === "failed";
        if (!unhealthy) continue;
        try {
          pc.restartIce();
        } catch {
          /* ignore */
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
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
  }, [isInCall, toast]);

  const isScreenSharingRef = useRef(false);
  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    if (!isInCall || !activeGroupId) return undefined;
    return startDesCoinHeartbeat({
      getSocket: () => socketRef.current,
      getLocalStream: () => localStreamRef.current,
      isActive: () => isInCallRef.current,
      isScreenSharing: () => Boolean(isScreenSharingRef.current),
      getContext: () => ({ context: "group", groupId: activeGroupId }),
    });
  }, [isInCall, activeGroupId]);

  // Poll real per-peer WebRTC stats (RTT, packet loss, jitter) so each
  // participant tile can show an actionable network indicator instead of
  // only the binary connected/disconnected state.
  const peerStatsSamplesRef = useRef(new Map());
  const adaptiveQualityRef = useRef(new Map());
  useEffect(() => {
    if (!isInCall) {
      peerStatsSamplesRef.current.clear();
      adaptiveQualityRef.current.clear();
      return undefined;
    }
    let alive = true;
    const poll = async () => {
      const entries = Array.from(pcMapRef.current.entries());
      if (!entries.length) return;
      const results = await Promise.all(
        entries.map(async ([userId, peerData]) => {
          const pc = peerData?.pc;
          if (!pc || pc.connectionState === "closed") return null;
          const prev = peerStatsSamplesRef.current.get(userId) || null;
          const result = await sampleConnectionStats(pc, prev);
          if (!result) return null;
          peerStatsSamplesRef.current.set(userId, result.sample);
          if (result.quality) {
            // Each mesh peer connection is independent, so adapt this
            // outbound video/audio to *that specific* peer's live quality
            // instead of a single global bucket for every participant.
            const senders = pc.getSenders();
            const videoSender = senders.find(
              (s) => s.track?.kind === "video" && s !== peerData.screenSender
            );
            const audioSender = senders.find(
              (s) => s.track?.kind === "audio" && s !== peerData.screenAudioSender
            );
            if (!adaptiveQualityRef.current.has(userId)) {
              adaptiveQualityRef.current.set(userId, {
                video: { current: null },
                audio: { current: null },
              });
            }
            const tracker = adaptiveQualityRef.current.get(userId);
            applyAdaptiveVideoEncoding(videoSender, result.quality, tracker.video);
            applyAdaptiveAudioEncoding(audioSender, result.quality, tracker.audio);
          }
          return [userId, result.quality];
        })
      );
      if (!alive) return;
      const qualityByUser = new Map(results.filter(Boolean));
      if (!qualityByUser.size) return;
      setParticipants((prev) => {
        let changed = false;
        const next = prev.map((p) => {
          const quality = qualityByUser.get(p.id);
          if (!quality || p.connectionQuality === quality) return p;
          changed = true;
          return { ...p, connectionQuality: quality };
        });
        return changed ? next : prev;
      });
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isInCall]);

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

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
        safeClosePeer(peerData.pc);
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
      safeClosePeer(peerData.pc);
    });
    pcMapRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    disposeNoiseSuppressionSession({ stopRaw: true });
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
    if (screenAudioCtxRef.current) {
      try { screenAudioCtxRef.current.close(); } catch { /* ignore */ }
      screenAudioCtxRef.current = null;
    }

    setIsInCall(false);
    setIsInitiator(false);
    setCallType(null);
    setActiveGroupId(null);
    setLocalStream(null);
    setScreenStream(null);
    setIsMuted(false);
    setIsCameraOn(false);
    setIsHandRaised(false);
    setIsScreenSharing(false);
    setParticipants([]);
    setIncomingCall(null);

    audioManager.stop("incomingCall");
    audioManager.stop("outgoingCall");
  }, []);

  const setupPeerConnection = useCallback((pc, stream, userId, groupId) => {
    // Callers always call pcMapRef.current.set(userId, peerData) immediately
    // before invoking setupPeerConnection, so this is always the entry that
    // owns `pc`. If this peer later fully reconnects with a brand new
    // RTCPeerConnection, the old `pc` (and its handlers below) are closed
    // and discarded together, so this reference never goes stale in a way
    // that matters.
    const peerData = pcMapRef.current.get(userId);

    stream.getTracks().forEach((t) => { t.enabled = true; });
    attachLocalTracks(pc, stream);

    pc.ontrack = (e) => {
      const track = e.track;
      // e.streams[0] may be undefined or empty during renegotiation — fall back to wrapping the track.
      const rawStream = e.streams?.[0];
      const incomingStream = (rawStream && rawStream.getTracks().length > 0)
        ? rawStream
        : new MediaStream([track]);

      const peerData = pcMapRef.current.get(userId);
      const peerExpectsScreen = Boolean(peerData?.expectScreenShare);
      const mainRemoteStream = remoteStreamsRef.current.get(userId) || null;
      // Snapshot camera flag from last known participant state via main stream video tracks
      const participantHasCameraVideo = Boolean(
        mainRemoteStream?.getVideoTracks?.().some((t) => t && t !== track && t.readyState !== "ended")
      );
      const isScreenTrack = isRemoteScreenVideoTrack(track, {
        rawStream: rawStream || null,
        peerExpectsScreen,
        mainRemoteStream,
        participantHasCameraVideo,
      });
      // Screen video and its (optional) approved tab/system audio can arrive
      // in either order — don't only match against `peerData.screenStream`,
      // which is still unset the first time the audio track shows up before
      // the video track. Fall back to the same "peer told us a screen share
      // is starting, and this isn't the peer's long-lived mic stream" signal
      // `isRemoteScreenVideoTrack` already uses for video.
      const sharesScreenVideo =
        Boolean(rawStream) &&
        Boolean(peerData?.screenStream) &&
        rawStream.getVideoTracks?.().some((vt) =>
          peerData.screenStream.getVideoTracks().includes(vt)
        );
      const isScreenAudioTrack = Boolean(
        track.kind === "audio" &&
        rawStream &&
        (
          sharesScreenVideo ||
          peerData?.screenStream?.id === rawStream.id ||
          (peerExpectsScreen && (!mainRemoteStream || rawStream.id !== mainRemoteStream.id))
        )
      );

      if (track.kind === "audio" && !isScreenAudioTrack) {
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
        chainTrackUnmute(track, () => {
          audioEl.srcObject = incomingStream;
          audioEl.play().catch(() => {});
        });
      }

      if (isScreenAudioTrack) {
        // Merge into the peer's screen MediaStream. Clone to a NEW stream so
        // React rebinds the dedicated <audio> when audio arrives after video.
        // Do NOT clear expectScreenShare until video is attached — audio-first
        // clearing used to mis-route the later screen video track.
        const existingScreen = peerData?.screenStream || null;
        const tracks = [];
        const push = (t) => {
          if (!t || t.readyState === "ended" || tracks.includes(t)) return;
          tracks.push(t);
        };
        if (existingScreen) existingScreen.getTracks().forEach(push);
        if (incomingStream) incomingStream.getTracks().forEach(push);
        push(track);
        const mergedScreenStream = new MediaStream(tracks);
        if (peerData) {
          peerData.screenStream = mergedScreenStream;
        }
        const applyScreenAudio = () => {
          setParticipants((prev) => {
            if (userId === myIdRef.current) return prev;
            const exists = prev.find((p) => p.id === userId);
            if (exists) {
              if (
                exists.screenStream === mergedScreenStream &&
                (exists.screenStream?.getAudioTracks?.()?.length || 0) ===
                  mergedScreenStream.getAudioTracks().length
              ) {
                return prev;
              }
              return prev.map((p) => p.id === userId
                ? { ...p, screenStream: mergedScreenStream, isScreenSharing: true }
                : p
              );
            }
            const storedUser = pcMapRef.current.get(userId)?.fromUser;
            return [...prev, buildCallParticipant(storedUser, {
              id: userId,
              stream: null,
              screenStream: mergedScreenStream,
              hasVideo: false,
              hasAudio: false,
              isScreenSharing: true,
              username: storedUser?.username || storedUser?.displayName || "Member",
              avatarUrl: storedUser?.avatar_url || storedUser?.avatarUrl || null,
            })];
          });
        };
        applyScreenAudio();
        chainTrackUnmute(track, applyScreenAudio);
        return; // handled — don't fall through to the generic audio-participant branch below
      }

      if (isScreenTrack) {
        // Dedicated screen share stream — store separately on the participant.
        // Merge into any screen stream the (possibly earlier-arriving) screen
        // audio track already created, instead of replacing it and silently
        // dropping that audio track from the stream the UI renders.
        const existingScreen = peerData?.screenStream || null;
        let screenStream = incomingStream;
        if (existingScreen && existingScreen !== incomingStream) {
          try {
            const merged = new MediaStream([
              ...existingScreen.getTracks().filter((t) => t.readyState !== "ended"),
              ...incomingStream.getTracks().filter((t) => t.readyState !== "ended" && !existingScreen.getTracks().includes(t)),
            ]);
            if (!merged.getTracks().includes(track) && track.readyState !== "ended") merged.addTrack(track);
            screenStream = merged;
          } catch {
            screenStream = incomingStream;
          }
        } else if (existingScreen && existingScreen === incomingStream) {
          // Same object — clone so React notices new tracks.
          screenStream = new MediaStream(existingScreen.getTracks().filter((t) => t.readyState !== "ended"));
        }
        if (peerData) {
          peerData.expectScreenShare = false;
          peerData.screenStream = screenStream;
        }
        const applyScreenStream = () => {
          setParticipants((prev) => {
            if (userId === myIdRef.current) return prev;
            const exists = prev.find((p) => p.id === userId);
            // Avoid re-render thrash (black flashes / FPS drops) when stream is unchanged
            if (exists?.isScreenSharing && exists?.screenStream === screenStream) {
              return prev;
            }
            if (exists) {
              return prev.map((p) => p.id === userId
                ? { ...p, screenStream, isScreenSharing: true }
                : p
              );
            }
            const storedUser = pcMapRef.current.get(userId)?.fromUser;
            return [...prev, buildCallParticipant(storedUser, {
              id: userId,
              stream: null,
              screenStream,
              hasVideo: false,
              hasAudio: false,
              isScreenSharing: true,
              username: storedUser?.username || storedUser?.displayName || "Member",
              avatarUrl: storedUser?.avatar_url || storedUser?.avatarUrl || null,
            })];
          });
        };
        applyScreenStream();
        // Track may be muted until ICE/DTLS completes — re-apply on unmute
        // so the video element gets re-attached and stops showing black.
        chainTrackUnmute(track, applyScreenStream);
        return; // don't fall through to camera logic
      }

      if (track.kind === "video") {
        // Camera video track — merge into existing peer stream when possible
        const existingMain = remoteStreamsRef.current.get(userId);
        let cameraStream = incomingStream;
        if (existingMain && existingMain !== incomingStream) {
          try {
            if (!existingMain.getTracks().includes(track)) existingMain.addTrack(track);
            cameraStream = existingMain;
          } catch {
            cameraStream = incomingStream;
          }
        }
        remoteStreamsRef.current.set(userId, cameraStream);
        const applyCameraStream = () => {
          setParticipants((prev) => {
            if (userId === myIdRef.current) return prev;
            const exists = prev.find((p) => p.id === userId);
            // New MediaStream identity so React remounts/attaches <video> on voice→camera
            const nextStream = new MediaStream(cameraStream.getTracks());
            if (exists) {
              if (exists.hasVideo && exists.stream === nextStream) return prev;
              return prev.map((p) => p.id === userId
                ? { ...p, stream: nextStream, hasVideo: true }
                : p
              );
            }
            const storedUser = pcMapRef.current.get(userId)?.fromUser;
            return [...prev, buildCallParticipant(storedUser, {
              id: userId,
              stream: nextStream,
              screenStream: null,
              hasVideo: true,
              hasAudio: nextStream.getAudioTracks().length > 0,
              isScreenSharing: false,
              username: storedUser?.username || storedUser?.displayName || "Member",
              avatarUrl: storedUser?.avatar_url || storedUser?.avatarUrl || null,
            })];
          });
        };
        applyCameraStream();
        chainTrackUnmute(track, applyCameraStream);
      }

      // For audio-only participants, ensure they appear in the list
      if (track.kind === "audio") {
        setParticipants((prev) => {
          if (userId === myIdRef.current) return prev;
          if (prev.find((p) => p.id === userId)) {
            return prev.map((p) => p.id === userId ? { ...p, hasAudio: true } : p);
          }
          const storedUser = pcMapRef.current.get(userId)?.fromUser;
          return [...prev, buildCallParticipant(storedUser, {
            id: userId,
            stream: incomingStream,
            screenStream: null,
            hasVideo: false,
            hasAudio: true,
            isScreenSharing: false,
            username: storedUser?.username || storedUser?.displayName || "Member",
            avatarUrl: storedUser?.avatar_url || storedUser?.avatarUrl || null,
          })];
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

    // Hard-remove a peer only after it's been unrecoverable for a while —
    // a transient network blip (WiFi/cell handoff, brief packet loss, NAT
    // rebind) commonly recovers within a few seconds and previously caused
    // that person to suddenly vanish from the call ("bir anda atıyor") with
    // no attempt to reconnect first.
    const clearPeerCleanupTimer = () => {
      if (peerData.cleanupTimer) {
        clearTimeout(peerData.cleanupTimer);
        peerData.cleanupTimer = null;
      }
    };
    const schedulePeerCleanup = (delayMs) => {
      clearPeerCleanupTimer();
      peerData.cleanupTimer = setTimeout(() => {
        const current = pcMapRef.current.get(userId);
        if (!current || current.pc !== pc) return; // peer already replaced/removed
        const stillBad = ["failed", "disconnected", "closed"].includes(pc.connectionState);
        if (!stillBad) return;
        pcMapRef.current.delete(userId);
        remoteStreamsRef.current.delete(userId);
        const audioEl = remoteAudioRefs.current.get(userId);
        if (audioEl) {
          try { audioEl.pause(); audioEl.srcObject = null; audioEl.remove(); } catch { /* ignore */ }
          remoteAudioRefs.current.delete(userId);
        }
        try { pc.close(); } catch { /* ignore */ }
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      }, delayMs);
    };

    // One ICE-restart attempt per failure episode, resets once the peer
    // reconnects so a later, separate drop can also be recovered from.
    const attemptIceRestart = () => {
      if (peerData.iceRestartAttempted) return;
      peerData.iceRestartAttempted = true;
      renegotiateWithPeerRef.current?.(userId, peerData, { iceRestart: true })?.catch?.(() => {});
    };

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === "connected" || ice === "completed") {
        peerData.iceRestartAttempted = false;
        clearPeerCleanupTimer();
      } else if (ice === "disconnected") {
        // Give the browser a few seconds to self-heal before intervening —
        // most brief drops resolve on their own without a full restart.
        schedulePeerCleanup(6000);
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            attemptIceRestart();
          }
        }, 3000);
      } else if (ice === "failed") {
        attemptIceRestart();
        // Restart needs a moment to succeed before we give up on this peer.
        schedulePeerCleanup(12000);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        peerData.iceRestartAttempted = false;
        clearPeerCleanupTimer();
      } else if (pc.connectionState === "disconnected") {
        // Handled by oniceconnectionstatechange, which fires for the same
        // underlying condition and already schedules a bounded cleanup.
      } else if (pc.connectionState === "failed") {
        schedulePeerCleanup(12000);
      } else if (pc.connectionState === "closed") {
        clearPeerCleanupTimer();
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

  const startGroupCall = useCallback(async (groupId, type, memberIds = [], options = {}) => {
    if (!groupId || !type || !socketRef.current) return;
    const hangout = Boolean(options?.hangout);
    
    try {
      const stream = await acquireVoiceMicStream(
        type === "video"
          ? { video: { width: 1280, height: 720, facingMode: "user" } }
          : { video: false }
      );
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Ensure audio track is enabled for voice calls
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      setNoiseSuppressedTrackEnabled(true);
      
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
        
        const pc = createPeerConnection({});
        const peerData = { pc, pendingIce: [] };
        pcMapRef.current.set(userId, peerData);
        
        setupPeerConnection(pc, stream, userId, groupId);
        
      });

      // Ensure we're in the group socket room to receive left/ended events
      if (!socketRef.current?.connected) {
        cleanup();
        return;
      }
      socketRef.current.emit("group:join", groupId);

      // Emit start event (hangout = silent persistent voice room)
      socketRef.current.emit("group:call:start", {
        groupId,
        callType: type,
        memberIds,
        hangout,
      });

      // Immediately set the banner for the initiator — the server only pushes
      // group:call:active-banner to users who join later via group:join
      setActiveCallBanner({
        groupId,
        initiatorId: myIdRef.current,
        initiatorUsername: getUser()?.username || socketRef.current?.user?.username || "You",
        callType: type,
        hangout,
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
    if (isInCallRef.current) return;
    
    try {
      audioManager.stop("incomingCall");

      const stream = await acquireVoiceMicStream(
        type === "video"
          ? { video: { width: 1280, height: 720, facingMode: "user" } }
          : { video: false }
      );
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Ensure audio track is enabled for voice calls
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      setNoiseSuppressedTrackEnabled(true);
      
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
      setParticipants([buildCallParticipant(fromUser, {
        hasVideo: type === "video",
        hasAudio: true,
      })].filter(Boolean));

      // Join the group socket room so group:call:left/ended events are received
      if (!socketRef.current?.connected) {
        cleanup();
        return;
      }
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
      startTime: Date.now(),
    });
  }, []);

  // Leave only removes THIS user from the room — never force-ends for others.
  // Use ref so a stale closed-over activeGroupId cannot skip the leave emit.
  const leaveCall = useCallback(() => {
    const gid = activeGroupIdRef.current;
    if (gid && socketRef.current?.connected) {
      socketRef.current.emit("group:call:leave", { groupId: gid });
    }
    cleanup();
  }, [cleanup]);

  /** Create+send offer to one peer; sets makingOffer for glare detection. */
  const renegotiateWithPeer = useCallback(async (userId, peerData, opts = {}) => {
    if (!peerData?.pc || !socketRef.current?.connected) return;
    if (peerData.pc.connectionState === "closed" || peerData.pc.signalingState === "closed") {
      return;
    }
    // Wait for stable — concurrent shares / answers can briefly leave have-*-offer
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (peerData.pc.signalingState === "stable") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (peerData.pc.signalingState !== "stable") {
      console.warn(`[GroupCall] skip renegotiate — signalingState=${peerData.pc.signalingState} peer=${userId}`);
      return;
    }
    peerData.makingOffer = true;
    try {
      const offer = await peerData.pc.createOffer(opts.iceRestart ? { iceRestart: true } : undefined);
      await peerData.pc.setLocalDescription(offer);
      socketRef.current.emit("group:call:offer", {
        groupId: activeGroupId,
        toUserId: userId,
        offer: peerData.pc.localDescription,
        callType: callTypeRef.current || callType || "voice",
      });
    } catch (err) {
      console.error(`[GroupCall] renegotiate failed for ${userId}:`, err);
    } finally {
      peerData.makingOffer = false;
    }
  }, [activeGroupId, callType]);

  useEffect(() => {
    renegotiateWithPeerRef.current = renegotiateWithPeer;
  }, [renegotiateWithPeer]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
      const groupId = activeGroupIdRef.current;
      if (groupId && socketRef.current?.connected) {
        socketRef.current.emit("group:call:media-state", {
          groupId,
          muted: !track.enabled,
          cameraOn: Boolean(isCameraOn),
        });
      }
    }
  }, [isCameraOn]);

  const toggleHandRaise = useCallback(() => {
    setIsHandRaised((prev) => {
      const next = !prev;
      const groupId = activeGroupIdRef.current;
      if (groupId && socketRef.current?.connected) {
        socketRef.current.emit("group:call:hand-raise", { groupId, raised: next });
      }
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
      }
      if (localVideoRef.current) localVideoRef.current.style.display = "none";
      setIsCameraOn(false);
      const groupId = activeGroupIdRef.current;
      if (groupId && socketRef.current?.connected) {
        socketRef.current.emit("group:call:media-state", {
          groupId,
          muted: Boolean(isMuted),
          cameraOn: false,
        });
      }
    } else {
      try {
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];
        let addedNewTrack = false;

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

          // Update call type BEFORE renegotiate so offer metadata says "video"
          setCallType("video");
          callTypeRef.current = "video";

          for (const [userId, peerData] of pcMapRef.current.entries()) {
            try {
              peerData.pc.addTrack(videoTrack, localStreamRef.current);
              await renegotiateWithPeer(userId, peerData);
            } catch (err) {
              console.error(`[GroupCall] camera addTrack failed for ${userId}:`, err);
            }
          }
          addedNewTrack = true;
        }

        if (localVideoRef.current) {
          localVideoRef.current.style.display = "block";
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
        setIsCameraOn(true);
        const groupId = activeGroupIdRef.current;
        if (groupId && socketRef.current?.connected) {
          socketRef.current.emit("group:call:media-state", {
            groupId,
            muted: Boolean(isMuted),
            cameraOn: true,
          });
        }
        if (!addedNewTrack) {
          setCallType("video");
          callTypeRef.current = "video";
        }
      } catch (err) {
        console.error("[GroupCall] toggleCamera failed:", err);
      }
    }
  }, [isCameraOn, isMuted, renegotiateWithPeer]);

  const startScreenShare = useCallback(async (quality) => {
    console.log('[GroupScreenShare] startScreenShare called, quality:', quality);
    try {
      // Use provided quality or fall back to current state
      const effectiveQuality = quality || screenQuality;
      
      if (isScreenSharing) {
        console.log('[GroupScreenShare] abort: already sharing');
        return;
      }

      const { width, height, fps: frameRate } = resolveScreenCaptureSize(effectiveQuality);
      const peerCount = Math.max(1, pcMapRef.current.size);
      const maxBitrate = screenBitrateForPeerCount(peerCount, effectiveQuality.resolution || "720p");
      
      let stream;

      stream = await captureScreenShareStream({
        width,
        height,
        fps: frameRate,
        // Full OS picker on desktop (window / screen / tab) — DES-10.
        preferTab: false,
        pickSource: showElectronScreenPicker,
      });
      
      const screenTrack = stream.getVideoTracks()[0];
      await optimizeScreenShareTrack(screenTrack, {
        width,
        height,
        fps: frameRate,
        contentHint: effectiveQuality.contentHint || "motion",
      });
      if (screenTrack.readyState !== "live") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (isMobileScreenCapture()) {
        toast(
          tRuntime("Share your entire screen so switching apps keeps the broadcast alive."),
          "info"
        );
      }

      const { track: screenAudioTrack } = await ensureScreenShareAudioTrack(stream);
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

      screenStreamRef.current = stream;
      setScreenStream(stream);
      intentionalScreenStopRef.current = false;
      screenEndedInBackgroundRef.current = false;
      pulseCallWakeLock();

      // Announce BEFORE renegotiation so remotes set expectScreenShare
      // before ontrack fires (avoids mis-classifying / missing the stream).
      if (socketRef.current?.connected) {
        socketRef.current.emit("group:screen:start", { groupId: activeGroupId });
      }
      
      // Always addTrack with the dedicated screen stream for every peer.
      // replaceTrack does NOT fire ontrack on the remote side — the remote
      // peer would never learn about the screen stream and shows black.
      for (const [userId, peerData] of pcMapRef.current.entries()) {
        try {
          const sender = peerData.pc.addTrack(screenTrack, stream);
          if (screenAudioTrack && !peerData.screenAudioSender) {
            peerData.screenAudioSender = peerData.pc.addTrack(screenAudioTrack, stream);
          }
          // Store per-peer so stopScreenShare can removeTrack precisely
          peerData.screenSender = sender;
          await optimizeScreenShareSender(sender, {
            maxBitrate,
            maxFramerate: frameRate,
          });

          await renegotiateWithPeer(userId, peerData);
        } catch (err) {
          console.error(`[GroupCall] Screen share addTrack failed for ${userId}:`, err);
        }
      }

      // Set local preview after all operations complete
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      // Handle screen share end from the browser picker or source lifecycle.
      screenTrack.onended = () => {
        if (intentionalScreenStopRef.current) {
          intentionalScreenStopRef.current = false;
          return;
        }
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          screenEndedInBackgroundRef.current = true;
        }
        stopScreenShareRef.current?.();
      };

      setIsScreenSharing(true);
    } catch (err) {
      if (err?.name === "AbortError" || err?.name === "NotAllowedError") return;
      console.error("[GroupScreenShare] failed:", err);
      toast(
        tRuntime(err?.message || "Could not start screen share."),
        "error"
      );
    }
  }, [isScreenSharing, activeGroupId, screenQuality, renegotiateWithPeer, toast]);

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing) return;
    intentionalScreenStopRef.current = true;
    
    // Remove the dedicated screen sender from every peer and renegotiate
    for (const [userId, peerData] of pcMapRef.current.entries()) {
      try {
        const screenSender = peerData.screenSender;
        if (!screenSender) continue;
        peerData.pc.removeTrack(screenSender);
        delete peerData.screenSender;
        if (peerData.screenAudioSender) {
          peerData.pc.removeTrack(peerData.screenAudioSender);
          delete peerData.screenAudioSender;
        }

        await renegotiateWithPeer(userId, peerData);
      } catch (err) {
        console.error(`[GroupCall] Screen share removeTrack failed for ${userId}:`, err);
      }
    }
    
    // Clean up references and state
    screenSenderRef.current = null;

    if (screenAudioCtxRef.current) {
      try { screenAudioCtxRef.current.close(); } catch { /* ignore */ }
      screenAudioCtxRef.current = null;
    }
    
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
  }, [activeGroupId, isScreenSharing, renegotiateWithPeer]);

  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

  const restartScreenShareWithQuality = useCallback(
    async (nextQuality) => {
      if (!isScreenSharing) {
        setScreenQuality(nextQuality);
        screenQualityRef.current = nextQuality;
        return;
      }
      await stopScreenShare();
      await new Promise((r) => setTimeout(r, 150));
      setScreenQuality(nextQuality);
      screenQualityRef.current = nextQuality;
      await startScreenShare(nextQuality);
    },
    [isScreenSharing, startScreenShare, stopScreenShare]
  );

  // Ask the server whether a given group currently has an active call, and
  // (re)apply the resulting banner. Call this whenever the chat UI opens or
  // switches to a group — the live group:call:banner-update push only
  // reaches clients that were connected *and* already knew about the group
  // at the moment it fired, so a client that was offline, mid-reconnect, or
  // simply hadn't opened that group chat yet would otherwise never learn an
  // ongoing call exists until something else happens to re-trigger a push.
  const checkGroupCallStatus = useCallback((groupId) => {
    if (!groupId || !socketRef.current?.connected) return;
    socketRef.current.emit("group:call:check", { groupId });
  }, []);

  // Track which group the chat UI currently has open so a socket reconnect
  // can re-sync that group's banner (see onConnect below).
  const setViewingGroupId = useCallback((groupId) => {
    viewingGroupIdRef.current = groupId || null;
    if (groupId) checkGroupCallStatus(groupId);
  }, [checkGroupCallStatus]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      if (isInCallRef.current && activeGroupIdRef.current) {
        socket.emit("group:call:resume", { groupId: activeGroupIdRef.current });
      } else if (viewingGroupIdRef.current) {
        // Not in a call ourselves — re-sync in case someone else started or
        // ended one in the group we're currently viewing while we were away.
        socket.emit("group:call:check", { groupId: viewingGroupIdRef.current });
      }
    };
    const onIncoming = ({ groupId, fromUser, callType: type, groupName } = {}) => {
      const myId = myIdRef.current;
      if (!groupId || !fromUser?.id) return;
      if (myId && fromUser.id === myId) return;

      // Deduplicate dual delivery (user room + group room)
      const now = Date.now();
      const prevAt = incomingDedupeRef.current.get(groupId) || 0;
      if (now - prevAt < 2500) return;
      incomingDedupeRef.current.set(groupId, now);

      if (isInCallRef.current || callOccupancyRef?.current?.dmMode) {
        socket.emit("group:call:busy", { groupId, toUserId: fromUser.id });
        return;
      }

      setIncomingCall({ groupId, fromUser, callType: type || "voice" });
      audioManager.play("incomingCall", { loop: true });
      notificationService.groupCall({ groupName: groupName || "Grup", from: fromUser.username });
    };

    socket.on("connect", onConnect);
    socket.on("group:call:incoming", onIncoming);
    return () => {
      socket.off("connect", onConnect);
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
            ? {
                ...p,
                ...pickEquippedCosmetics(fromUser),
                username: fromUser?.username || p.username,
                avatarUrl: fromUser?.avatar_url || fromUser?.avatarUrl || p.avatarUrl,
              }
            : p
          );
        }
        return [...prev, buildCallParticipant(fromUser || { id: fromUserId }, {
          id: fromUserId,
          hasVideo: callTypeRef.current === "video",
          hasAudio: true,
        })].filter(Boolean);
      });

      try {
        // Reuse existing PC if we already created one for this peer (startGroupCall pre-creates)
        let peerData = pcMapRef.current.get(fromUserId);
        let pc = peerData?.pc;
        if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
          safeClosePeer(pc);
          pc = createPeerConnection({});
          peerData = { pc, pendingIce: peerData?.pendingIce || [], fromUser };
          pcMapRef.current.set(fromUserId, peerData);
          setupPeerConnection(pc, stream, fromUserId, groupId);
        } else {
          peerData.fromUser = fromUser || peerData.fromUser;
        }

        // Flush any ICE that arrived before the PC existed
        const early = pendingIceByUserRef.current.get(fromUserId);
        if (early?.length) {
          peerData.pendingIce = [...(peerData.pendingIce || []), ...early];
          pendingIceByUserRef.current.delete(fromUserId);
        }

        // Deduplicate with concurrent participant-joined (accept path emits both)
        if (peerData.offering || pc.signalingState === "have-local-offer") return;

        // Include an active share in the late accepter's initial SDP. The
        // participant-joined path already does this; onAccept must match it.
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        if (screenTrack && screenTrack.readyState === "live" && !peerData.screenSender) {
          const sender = pc.addTrack(screenTrack, screenStreamRef.current);
          peerData.screenSender = sender;
          const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
          if (screenAudioTrack && !peerData.screenAudioSender) {
            peerData.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
          }
          const quality = resolveScreenCaptureSize(screenQualityRef.current);
          await optimizeScreenShareSender(sender, {
            maxBitrate: screenBitrateForPeerCount(
              pcMapRef.current.size,
              screenQualityRef.current?.resolution
            ),
            maxFramerate: quality.fps,
          });
        }

        peerData.offering = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          peerData.lastOfferAt = Date.now();

          socket.emit("group:call:offer", {
            groupId,
            toUserId: fromUserId,
            offer: pc.localDescription,
            callType: callTypeRef.current || "voice",
          });
        } finally {
          peerData.offering = false;
        }

      } catch (err) {
      }
    };

    // Handle when a new participant joins an existing call.
    // IMPORTANT: startGroupCall pre-creates PCs for all members — we must still
    // send an offer (same as onAccept). Early-returning when PC exists left
    // chat/banner joiners with silent dead peer connections.
    const onParticipantJoined = async ({ groupId, fromUserId, fromUser }) => {
      if (!fromUserId || fromUserId === myIdRef.current) return;
      if (!isInCallRef.current) return;
      if (groupId && activeGroupIdRef.current && groupId !== activeGroupIdRef.current) return;

      // Update username if we already have this participant with 'Member' placeholder
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === fromUserId);
        if (exists) {
          return prev.map((p) =>
            p.id === fromUserId
              ? {
                  ...p,
                  ...pickEquippedCosmetics(fromUser),
                  username: fromUser?.username || fromUser?.displayName || p.username,
                  avatarUrl: fromUser?.avatar_url || fromUser?.avatarUrl || p.avatarUrl,
                }
              : p
          );
        }
        return [...prev, buildCallParticipant(fromUser || { id: fromUserId }, {
          id: fromUserId,
          hasVideo: callTypeRef.current === "video",
          hasAudio: true,
        })].filter(Boolean);
      });
      
      const stream = localStreamRef.current;
      if (!stream) return;

      try {
        let peerData = pcMapRef.current.get(fromUserId);
        let pc = peerData?.pc;
        if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
          safeClosePeer(pc);
          pc = createPeerConnection({});
          peerData = { pc, pendingIce: peerData?.pendingIce || [], fromUser };
          pcMapRef.current.set(fromUserId, peerData);
          setupPeerConnection(pc, stream, fromUserId, groupId);
        } else {
          peerData.fromUser = fromUser || peerData.fromUser;
        }

        const early = pendingIceByUserRef.current.get(fromUserId);
        if (early?.length) {
          peerData.pendingIce = [...(peerData.pendingIce || []), ...early];
          pendingIceByUserRef.current.delete(fromUserId);
        }

        // If we're currently screen sharing, add the screen track to this new peer
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        if (screenTrack && screenTrack.readyState === "live" && !peerData.screenSender) {
          const sender = pc.addTrack(screenTrack, screenStreamRef.current);
          peerData.screenSender = sender;
          const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
          if (screenAudioTrack && !peerData.screenAudioSender) {
            peerData.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
          }
          const q = resolveScreenCaptureSize(screenQualityRef.current);
          await optimizeScreenShareSender(sender, {
            maxBitrate: screenBitrateForPeerCount(
              pcMapRef.current.size,
              screenQualityRef.current?.resolution
            ),
            maxFramerate: q.fps,
          });
        }

        // Wait briefly if a prior offer/answer is in flight
        for (let attempt = 0; attempt < 8; attempt += 1) {
          if (pc.signalingState === "stable") break;
          await new Promise((r) => setTimeout(r, 80));
        }
        // Already negotiating / recently offered (accept emits accepted + participant-joined)
        if (peerData.offering) return;
        if (pc.signalingState === "have-local-offer" || pc.signalingState === "have-remote-offer") return;
        if (peerData.lastOfferAt && Date.now() - peerData.lastOfferAt < 2000) return;
        // Already connected to this peer — join re-notify shouldn't renegotiate
        if (pc.connectionState === "connected" || pc.connectionState === "connecting") return;
        if (pc.signalingState !== "stable") {
          console.warn(`[GroupCall] participant-joined: skip offer, state=${pc.signalingState}`);
          return;
        }

        peerData.offering = true;
        peerData.makingOffer = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          peerData.lastOfferAt = Date.now();

          socket.emit("group:call:offer", {
            groupId,
            toUserId: fromUserId,
            offer: pc.localDescription,
            callType: callTypeRef.current || "voice",
          });
        } finally {
          peerData.makingOffer = false;
          peerData.offering = false;
        }

      } catch (err) {
        console.error("[GroupCall] participant-joined offer failed:", err);
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
        
        const pc = createPeerConnection({});
        const early = pendingIceByUserRef.current.get(fromUserId) || [];
        pendingIceByUserRef.current.delete(fromUserId);
        const newPeerData = { pc, pendingIce: [...early], makingOffer: false };
        pcMapRef.current.set(fromUserId, newPeerData);
        
        setupPeerConnection(pc, stream, fromUserId, groupId);

        // If we are already screen-sharing, attach screen before answering
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        if (screenTrack && screenTrack.readyState === "live") {
          try {
            const sender = pc.addTrack(screenTrack, screenStreamRef.current);
            newPeerData.screenSender = sender;
            const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
            if (screenAudioTrack) {
              newPeerData.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
            }
          } catch (err) {
            console.warn("[GroupCall] attach screen on new PC failed:", err);
          }
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await flushIce(pc, fromUserId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          stream.getTracks().forEach(track => {
            track.enabled = true;
          });
          
          socket.emit("group:call:answer", {
            groupId,
            toUserId: fromUserId,
            answer: pc.localDescription,
          });
        } catch (err) {
          console.error(`[GroupCall] initial answer failed for ${fromUserId}:`, err);
        }
        return;
      }

      try {
        const polite = isPolitePeer(myIdRef.current, fromUserId);
        const { accepted, rolledBack } = await applyRemoteOffer(peerData.pc, offer, {
          polite,
          makingOffer: Boolean(peerData.makingOffer),
        });

        if (!accepted) {
          // Impolite peer ignored remote offer during glare — we keep our local offer.
          // Remote (polite) will roll back and answer us; they re-offer their screen after.
          console.warn(`[GroupCall] glare: ignored remote offer from ${fromUserId}`);
          return;
        }

        const answer = await peerData.pc.createAnswer();
        await peerData.pc.setLocalDescription(answer);
        
        localStreamRef.current?.getTracks().forEach(track => {
          track.enabled = true;
        });
        
        socket.emit("group:call:answer", {
          groupId,
          toUserId: fromUserId,
          answer: peerData.pc.localDescription,
        });

        // After rolling back our offer to accept theirs, re-send ours if we still
        // have a live screen or camera track that needs to be signaled.
        if (rolledBack) {
          const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
          const cameraTrack = localStreamRef.current?.getVideoTracks()?.[0];
          const needsResend =
            (screenTrack && screenTrack.readyState === "live") ||
            (cameraTrack && cameraTrack.readyState === "live" && cameraTrack.enabled);
          if (screenTrack && screenTrack.readyState === "live") {
            if (!peerData.screenSender) {
              try {
                peerData.screenSender = peerData.pc.addTrack(screenTrack, screenStreamRef.current);
                const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
                if (screenAudioTrack && !peerData.screenAudioSender) {
                  peerData.screenAudioSender = peerData.pc.addTrack(screenAudioTrack, screenStreamRef.current);
                }
              } catch {
                /* may already exist */
              }
            }
          }
          if (needsResend) {
            // Defer so our answer is processed first
            setTimeout(() => {
              renegotiateWithPeerRef.current?.(fromUserId, peerData)?.catch?.(() => {});
            }, 120);
          }
        }
      } catch (err) {
        console.error(`[GroupCall] onOffer failed for ${fromUserId}:`, err);
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
        } else {
          // Peer connection not created yet — buffer by user until onAccept/offer
          const buf = pendingIceByUserRef.current.get(fromUserId) || [];
          buf.push(candidate);
          pendingIceByUserRef.current.set(fromUserId, buf);
        }
        return;
      }

      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Non-fatal error - connection may still work
      }
    };

    const onLeft = ({ groupId, userId }) => {
      // Only tear down the peer that left — NEVER end the whole local call.
      // Remaining user(s) stay in-call so others can rejoin.
      if (!userId || userId === myIdRef.current) return;
      if (groupId && activeGroupIdRef.current && groupId !== activeGroupIdRef.current) return;

      const peerData = pcMapRef.current.get(userId);
      safeClosePeer(peerData?.pc);
      pcMapRef.current.delete(userId);
      pendingIceByUserRef.current.delete(userId);

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
      // Only tear down if WE are still in this group call. A stale ended event
      // for another group must not kill the active session.
      if (groupId && groupId === activeGroupIdRef.current && isInCallRef.current) {
        cleanup();
      }
    };

    const onCallSummary = ({ groupId, summary }) => {
      if (!groupId || !summary) return;
      setActiveCallBanner((prev) => (prev?.groupId === groupId ? null : prev));
      setCallSummaries((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), summary],
      }));
    };

    const onActiveBanner = ({ groupId, initiatorId, initiatorUsername, callType, hangout, participantCount, participants, startTime }) => {
      setActiveCallBanner({
        groupId,
        initiatorId,
        initiatorUsername,
        callType,
        hangout: Boolean(hangout),
        participantCount,
        participants,
        startTime: startTime ?? Date.now(),
      });
    };

    const onBannerUpdate = ({ groupId, banner }) => {
      setActiveCallBanner((prev) => {
        if (banner) {
          return {
            ...banner,
            startTime: banner.startTime ?? prev?.startTime ?? Date.now(),
          };
        }
        if (prev?.groupId === groupId) return null;
        return prev;
      });
    };

    const onCallError = ({ groupId, message } = {}) => {
      if (message) toast(message === "No active call in this group"
        ? tRuntime("No active call to join")
        : (message || tRuntime("Could not join the call")), "error");
      if (groupId && groupId === activeGroupIdRef.current && isInCallRef.current) {
        cleanup();
      }
      setActiveCallBanner((prev) => (prev?.groupId === groupId ? null : prev));
    };

    const onDeclined = ({ groupId, fromUserId, fromUser }) => {
      const peerData = pcMapRef.current.get(fromUserId);
      safeClosePeer(peerData?.pc);
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
        startTime: Date.now(),
      });
    };

    const onScreenStarted = ({ groupId, fromUserId }) => {
      if (!fromUserId || fromUserId === myIdRef.current) return;
      const peerData = pcMapRef.current.get(fromUserId);
      if (peerData) peerData.expectScreenShare = true;

      // Recover tracks that arrived before this event / were misclassified as camera
      try {
        const pc = peerData?.pc;
        if (pc) {
          for (const receiver of pc.getReceivers()) {
            const track = receiver.track;
            if (!track || track.kind !== "video" || track.readyState === "ended") continue;
            const label = (track.label || "").toLowerCase();
            const looksLikeScreen =
              label.includes("screen") ||
              label.includes("display") ||
              label.includes("window") ||
              label.includes("tab") ||
              label.includes("desktop") ||
              label.includes("web contents") ||
              label.includes("monitor") ||
              label.includes("primary");
            const main = remoteStreamsRef.current.get(fromUserId);
            const isExtraVideo = main && !main.getVideoTracks().includes(track);
            // Only recover tracks that look like screen or are a second video m-line
            if (!looksLikeScreen && !isExtraVideo) continue;

            const screenMs = new MediaStream([track]);
            setParticipants((prev) => {
              if (fromUserId === myIdRef.current) return prev;
              const exists = prev.find((p) => p.id === fromUserId);
              if (exists?.screenStream?.getVideoTracks?.()?.[0] === track) {
                return prev.map((p) =>
                  p.id === fromUserId ? { ...p, isScreenSharing: true } : p
                );
              }
              if (exists) {
                // If camera stream was actually the screen (video-only), move it
                const cam = exists.stream;
                const camIsVideoOnly =
                  cam &&
                  cam.getVideoTracks().length > 0 &&
                  cam.getAudioTracks().length === 0 &&
                  cam.getVideoTracks()[0] === track;
                return prev.map((p) =>
                  p.id === fromUserId
                    ? {
                        ...p,
                        screenStream: screenMs,
                        isScreenSharing: true,
                        stream: camIsVideoOnly ? null : p.stream,
                        hasVideo: camIsVideoOnly ? false : p.hasVideo,
                      }
                    : p
                );
              }
              const storedUser = peerData?.fromUser;
              return [
                ...prev,
                buildCallParticipant(storedUser, {
                  id: fromUserId,
                  stream: null,
                  screenStream: screenMs,
                  hasVideo: false,
                  hasAudio: false,
                  isScreenSharing: true,
                  username: storedUser?.username || storedUser?.displayName || "Member",
                  avatarUrl: storedUser?.avatar_url || storedUser?.avatarUrl || null,
                }),
              ].filter(Boolean);
            });
          }
        }
      } catch (err) {
        console.warn("[GroupCall] screen recover failed:", err);
      }

      setParticipants((prev) =>
        prev.map((p) =>
          p.id === fromUserId ? { ...p, isScreenSharing: true } : p
        )
      );
    };

    const onScreenStopped = ({ groupId, fromUserId }) => {
      const peerData = pcMapRef.current.get(fromUserId);
      if (peerData) peerData.expectScreenShare = false;
      setParticipants((prev) => prev.map((p) =>
        p.id === fromUserId ? { ...p, isScreenSharing: false, screenStream: null } : p
      ));
    };

    const onMediaState = ({ groupId, fromUserId, muted, cameraOn }) => {
      if (!groupId || !fromUserId || fromUserId === myIdRef.current) return;
      setParticipants((prev) => prev.map((p) =>
        p.id === fromUserId
          ? { ...p, isMuted: Boolean(muted), isCameraOn: Boolean(cameraOn) }
          : p
      ));
    };

    const onHandRaise = ({ groupId, fromUserId, raised }) => {
      if (!groupId || !fromUserId || fromUserId === myIdRef.current) return;
      setParticipants((prev) => {
        const match = prev.find((p) => p.id === fromUserId);
        if (raised && match) {
          toast?.(tRuntime("{name} raised their hand", { name: match.username || tRuntime("Someone") }), "info");
        }
        return prev.map((p) => (p.id === fromUserId ? { ...p, isHandRaised: Boolean(raised) } : p));
      });
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
            updated.push(buildCallParticipant(e, {
              hasVideo: existingCallType === "video",
              hasAudio: true,
              isScreenSharing: e.isScreenSharing || false,
            }));
          }
        });
        return updated;
      });
    };

    const onCallStarted = ({ groupId, fromUserId, fromUser, callType: startedType }) => {
      if (!fromUserId || fromUserId === myIdRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.id === fromUserId)) return prev;
        return [...prev, buildCallParticipant(fromUser || { id: fromUserId }, {
          id: fromUserId,
          hasVideo: startedType === "video",
          hasAudio: true,
        })].filter(Boolean);
      });
    };

    // Handle server telling us to join an existing call instead of starting new
    const onJoinExisting = async ({ groupId, initiatorId, callType: existingCallType, participants: existingParticipants }) => {
      
      if (isInCallRef.current) {
        return;
      }

      try {
        // Get media stream (AI noise suppression applied when enabled)
        const stream = await acquireVoiceMicStream(
          existingCallType === "video"
            ? { video: { width: 1280, height: 720, facingMode: "user" } }
            : { video: false }
        );
        localStreamRef.current = stream;
        setLocalStream(stream);
        
        // Enable audio tracks
        stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        setNoiseSuppressedTrackEnabled(true);
        
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
            const pc = createPeerConnection({});
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

    const onProfileUpdated = ({ user } = {}) => {
      if (!user?.id) return;
      const avatarUrl = user.avatarUrl || user.avatar_url;
      const avatarVersion = user.avatarVersion || user.updated_at;
      setParticipants((prev) => prev.map((p) =>
        p.id === user.id ? patchUserAvatar(p, avatarUrl, avatarVersion) : p
      ));
      setIncomingCall((prev) => {
        if (!prev?.fromUser || prev.fromUser.id !== user.id) return prev;
        return { ...prev, fromUser: patchUserAvatar(prev.fromUser, avatarUrl, avatarVersion) };
      });
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
    socket.on("group:call:media-state", onMediaState);
    socket.on("group:call:hand-raise", onHandRaise);
    socket.on("group:call:participant-joined", onParticipantJoined);
    socket.on("group:call:started", onCallStarted);
    socket.on("group:call:join-existing", onJoinExisting);
    socket.on("group:call:summary", onCallSummary);
    socket.on("group:call:active-banner", onActiveBanner);
    socket.on("group:call:banner-update", onBannerUpdate);
    socket.on("group:call:participants", onParticipants);
    socket.on("group:call:error", onCallError);
    socket.on("user:profile:updated", onProfileUpdated);

    return () => {
      socket.off("group:call:accepted", onAccept);
      socket.off("group:call:answer", onAnswer);
      socket.off("group:call:ice", onIce);
      socket.off("group:call:offer", onOffer);
      socket.off("group:call:left", onLeft);
      socket.off("group:call:ended", onEnded);
      socket.off("group:call:declined", onDeclined);
      socket.off("group:screen:started", onScreenStarted);
      socket.off("group:screen:stopped", onScreenStopped);
      socket.off("group:call:media-state", onMediaState);
      socket.off("group:call:hand-raise", onHandRaise);
      socket.off("group:call:participant-joined", onParticipantJoined);
      socket.off("group:call:started", onCallStarted);
      socket.off("group:call:join-existing", onJoinExisting);
      socket.off("group:call:summary", onCallSummary);
      socket.off("group:call:active-banner", onActiveBanner);
      socket.off("group:call:banner-update", onBannerUpdate);
      socket.off("group:call:participants", onParticipants);
      socket.off("group:call:error", onCallError);
      socket.off("user:profile:updated", onProfileUpdated);
    };
  }, [socket, cleanup, setupPeerConnection, currentUserId, toast]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Keep ref current so Electron IPC callbacks can read latest incomingCall without stale closure
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  const acceptGroupCallRef = useRef(acceptGroupCall);
  const declineCallRef = useRef(declineCall);
  useEffect(() => { acceptGroupCallRef.current = acceptGroupCall; }, [acceptGroupCall]);
  useEffect(() => { declineCallRef.current = declineCall; }, [declineCall]);

  // Electron notification Accept / Decline buttons for group calls
  useEffect(() => {
    if (!window.electronAPI?.onCallAccept) return;
    const unsubAccept = window.electronAPI.onCallAccept(() => {
      // Only handle when a group incoming ring is active — DM path owns mode===incoming
      const ic = incomingCallRef.current;
      if (!ic || isInCallRef.current) return;
      acceptGroupCallRef.current?.(ic.groupId, ic.callType, ic.fromUser);
    });
    const unsubDecline = window.electronAPI.onCallDecline(() => {
      const ic = incomingCallRef.current;
      if (!ic) return;
      declineCallRef.current?.(ic.groupId, ic.fromUser?.id, ic.fromUser, ic.callType);
    });
    return () => {
      unsubAccept?.();
      unsubDecline?.();
    };
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
      disposeNoiseSuppressionSession({ stopRaw: true });
      const newStream = await acquireVoiceMicStream({
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
      setNoiseSuppressedTrackEnabled(true);

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
    if (!banner?.groupId || !socketRef.current || isInCallRef.current) return;
    const {
      groupId,
      callType: type = "voice",
      participants: existingParticipants = [],
      startTime,
      initiatorId,
      initiatorUsername,
      participantCount,
    } = banner;
    try {
      const stream = await acquireVoiceMicStream(
        type === "video"
          ? { video: { width: 1280, height: 720, facingMode: "user" } }
          : { video: false }
      );
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getAudioTracks().forEach((t) => { t.enabled = true; });
      setNoiseSuppressedTrackEnabled(true);
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
      const myId = myIdRef.current;
      // Prefer server participant list from banner; PCs are created lazily on
      // offer OR eagerly here so ICE can buffer. Existing peers will offer via
      // participant-joined (fixed to renegotiate even when a stub PC exists).
      const peerIds = (existingParticipants || []).filter((id) => id && id !== myId);
      peerIds.forEach((userId) => {
        setParticipants((prev) => {
          if (prev.find((p) => p.id === userId)) return prev;
          return [...prev, { id: userId, username: "Member", hasVideo: type === "video", hasAudio: true }];
        });
        if (!pcMapRef.current.has(userId)) {
          const pc = createPeerConnection({});
          pcMapRef.current.set(userId, { pc, pendingIce: [] });
          setupPeerConnection(pc, stream, userId, groupId);
        }
      });
      // Keep / refresh banner so chat "Join" stays valid while we connect
      setActiveCallBanner({
        groupId,
        initiatorId: initiatorId || peerIds[0],
        initiatorUsername: initiatorUsername || "Unknown",
        callType: type,
        hangout: Boolean(banner.hangout),
        participantCount: participantCount || peerIds.length + 1,
        participants: [...new Set([...(existingParticipants || []), myId].filter(Boolean))],
        startTime: startTime || Date.now(),
      });
      if (!socketRef.current?.connected) {
        cleanup();
        toast(tRuntime("Could not join the call"), "error");
        return;
      }
      socketRef.current.emit("group:join", groupId);
      socketRef.current.emit("group:call:join", { groupId, callType: type });
    } catch (err) {
      cleanup();
      toast(tRuntime("Could not join the call"), "error");
    }
  }, [cleanup, setupPeerConnection, toast]);

  /** Join active voice room, or open a silent hangout if none exists. */
  const joinOrStartVoiceRoom = useCallback(async (groupId, memberIds = [], bannerOverride = null) => {
    if (!groupId || isInCallRef.current) return;
    const banner = bannerOverride || activeCallBanner;
    if (banner?.groupId === groupId) {
      await joinActiveCall(banner);
      return;
    }
    await startGroupCall(groupId, "voice", memberIds, { hangout: true });
  }, [activeCallBanner, joinActiveCall, startGroupCall]);

  return {
    isInCall,
    isInitiator,
    callType,
    activeGroupId,
    localStream,
    screenStream,
    isMuted,
    isCameraOn,
    isHandRaised,
    isScreenSharing,
    duration,
    participants,
    incomingCall,
    activeCallBanner,
    dismissActiveBanner,
    checkGroupCallStatus,
    setViewingGroupId,
    callSummaries,
    remoteStreams: remoteStreamsRef,
    localVideoRef,
    screenVideoRef,
    setLocalVideo,
    screenQuality,
    setScreenQuality,
    setScreenVideo,
    startGroupCall,
    joinOrStartVoiceRoom,
    acceptGroupCall,
    joinActiveCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleHandRaise,
    startScreenShare,
    stopScreenShare,
    restartScreenShareWithQuality,
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

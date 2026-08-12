import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { getIceServers, preloadIceServers } from "../lib/iceConfig";
import { API_BASE_URL } from "../config/api";
import { getToken, getUser } from "../lib/storage";
import {
  GROUP_SCREEN_DEFAULT_QUALITY,
  getDisplayMediaStream,
  optimizeScreenShareTrack,
  optimizeScreenShareSender,
  ensureScreenShareAudioTrack,
  resolveScreenCaptureSize,
  screenBitrateForPeerCount,
  isMobileScreenCapture,
  isRemoteScreenVideoTrack,
} from "../lib/webrtcScreenShare";

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
};

/**
 * Mesh voice hangout for server voice channels (Step 10).
 * Existing members offer to new joiners; joiner answers.
 */
export function useServerVoice(socket) {
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeServerId, setActiveServerId] = useState(null);
  const [channelName, setChannelName] = useState("");
  const [participants, setParticipants] = useState([]);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  /** serverId -> { channelId -> { members, memberCount } } */
  const [voiceStatesByServer, setVoiceStatesByServer] = useState({});

  const localStreamRef = useRef(null);
  const pcMapRef = useRef(new Map()); // userId -> { pc, pendingIce }
  const remoteAudioRefs = useRef(new Map());
  const remoteStreamMapRef = useRef(new Map()); // userId -> MediaStream
  const activeChannelIdRef = useRef(null);
  const activeServerIdRef = useRef(null);
  const myIdRef = useRef(getUser()?.id || null);
  const mutedRef = useRef(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreamsVersion, setRemoteStreamsVersion] = useState(0);
  const [serverMuted, setServerMuted] = useState(false);
  const serverMutedRef = useRef(false);
  const joinRef = useRef(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const screenStreamRef = useRef(null);
  const stopScreenShareRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const cameraStreamRef = useRef(null);
  const stopCameraRef = useRef(null);
  const [channelType, setChannelType] = useState("voice");
  const channelTypeRef = useRef("voice");
  const [stageRole, setStageRole] = useState("speaker");
  const stageRoleRef = useRef("speaker");
  const [requestedToSpeak, setRequestedToSpeak] = useState(false);
  const [canRequestToSpeak, setCanRequestToSpeak] = useState(false);
  const [canSpeak, setCanSpeak] = useState(true);
  const canSpeakRef = useRef(true);
  const [canStream, setCanStream] = useState(true);
  const canStreamRef = useRef(true);
  const [mediaMode, setMediaMode] = useState("mesh");
  const sfuModeRef = useRef(false);
  const liveKitRoomRef = useRef(null);
  const liveKitConfigRef = useRef(null);
  const screenQuality = GROUP_SCREEN_DEFAULT_QUALITY;

  useEffect(() => {
    preloadIceServers().catch(() => {});
  }, []);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    activeServerIdRef.current = activeServerId;
  }, [activeServerId]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    channelTypeRef.current = channelType || "voice";
  }, [channelType]);

  useEffect(() => {
    stageRoleRef.current = stageRole || "speaker";
  }, [stageRole]);

  useEffect(() => {
    canSpeakRef.current = Boolean(canSpeak);
  }, [canSpeak]);

  useEffect(() => {
    canStreamRef.current = Boolean(canStream);
  }, [canStream]);

  const canPublishVoice = useCallback(() => {
    if (channelTypeRef.current === "stage") {
      return stageRoleRef.current === "speaker" && canSpeakRef.current;
    }
    return canSpeakRef.current;
  }, []);

  const canPublishVideo = useCallback(() => canPublishVoice() && canStreamRef.current, [canPublishVoice]);

  const attachRemoteAudio = useCallback((userId, stream) => {
    let el = remoteAudioRefs.current.get(userId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.playsInline = true;
      el.style.display = "none";
      document.body.appendChild(el);
      remoteAudioRefs.current.set(userId, el);
    }
    el.srcObject = stream;
    el.play().catch(() => {});
    remoteStreamMapRef.current.set(userId, stream);
    setRemoteStreamsVersion((v) => v + 1);
    setParticipants((prev) => {
      const exists = prev.find((p) => p.id === userId);
      if (exists) return prev.map((p) => (p.id === userId ? { ...p, stream, hasAudio: true } : p));
      return [...prev, { id: userId, username: "Member", stream, hasAudio: true }];
    });
  }, []);

  const updateRemoteParticipant = useCallback((userId, patch) => {
    if (!userId) return;
    setParticipants((prev) => {
      const exists = prev.find((p) => p.id === userId);
      if (exists) return prev.map((p) => (p.id === userId ? { ...p, ...patch } : p));
      return [...prev, { id: userId, username: "Member", ...patch }];
    });
  }, []);

  const getMediaConfig = useCallback(async () => {
    if (liveKitConfigRef.current) return liveKitConfigRef.current;
    try {
      const res = await fetch(`${API_BASE_URL}/api/webrtc/media-config`, {
        credentials: "omit",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("media-config failed");
      liveKitConfigRef.current = await res.json();
    } catch {
      liveKitConfigRef.current = { sfu: false };
    }
    return liveKitConfigRef.current;
  }, []);

  const getLiveKitToken = useCallback(async (channelId) => {
    const token = getToken();
    if (!token || !channelId) return { enabled: false };
    const res = await fetch(
      `${API_BASE_URL}/api/webrtc/livekit-token?channelId=${encodeURIComponent(channelId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || "Could not prepare SFU voice.");
    }
    return res.json();
  }, []);

  const disconnectLiveKit = useCallback(() => {
    const room = liveKitRoomRef.current;
    if (room) {
      try {
        room.disconnect();
      } catch {
        /* ignore */
      }
    }
    liveKitRoomRef.current = null;
    sfuModeRef.current = false;
    setMediaMode("mesh");
  }, []);

  const cleanupPeer = useCallback((userId) => {
    const peer = pcMapRef.current.get(userId);
    if (peer?.pc) {
      try {
        peer.pc.close();
      } catch {
        /* ignore */
      }
    }
    pcMapRef.current.delete(userId);
    if (remoteStreamMapRef.current.has(userId)) {
      remoteStreamMapRef.current.delete(userId);
      setRemoteStreamsVersion((v) => v + 1);
    }
    const el = remoteAudioRefs.current.get(userId);
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        /* ignore */
      }
      remoteAudioRefs.current.delete(userId);
    }
  }, []);

  const connectLiveKitRoom = useCallback(
    async (channelId, tokenData, stream) => {
      if (!tokenData?.enabled || !tokenData?.livekitUrl || !tokenData?.token) return false;
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        cleanupPeer(participant.identity);
        setParticipants((prev) => prev.filter((p) => p.id !== participant.identity));
      });
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        const userId = participant.identity;
        const mediaTrack = track.mediaStreamTrack;
        if (!userId || !mediaTrack) return;
        const source = publication?.source || track?.source;
        const remote = new MediaStream([mediaTrack]);
        if (track.kind === "audio") {
          attachRemoteAudio(userId, remote);
        } else if (source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio) {
          updateRemoteParticipant(userId, { screenStream: remote, isScreenSharing: true });
        } else {
          updateRemoteParticipant(userId, { cameraStream: remote, cameraOn: true });
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        const userId = participant.identity;
        if (!userId) return;
        const source = publication?.source || track?.source;
        if (track.kind === "audio") {
          cleanupPeer(userId);
        } else if (source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio) {
          updateRemoteParticipant(userId, { screenStream: null, isScreenSharing: false });
        } else {
          updateRemoteParticipant(userId, { cameraStream: null, cameraOn: false });
        }
      });
      await room.connect(tokenData.livekitUrl, tokenData.token);
      liveKitRoomRef.current = room;
      sfuModeRef.current = true;
      setMediaMode("sfu");
      const audioTrack = stream?.getAudioTracks?.()[0] || null;
      if (audioTrack && canPublishVoice()) {
        await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
      }
      return true;
    },
    [attachRemoteAudio, canPublishVoice, cleanupPeer, updateRemoteParticipant]
  );

  const removeUserFromVoiceStates = useCallback((channelId, userId, serverId = null) => {
    if (!channelId || !userId) return;
    const uid = String(userId);
    setVoiceStatesByServer((prev) => {
      const next = { ...prev };
      const serverIds = serverId
        ? [String(serverId)]
        : Object.keys(next);
      let changed = false;
      for (const sid of serverIds) {
        const channels = next[sid];
        if (!channels?.[channelId]) continue;
        const members = (channels[channelId].members || []).filter(
          (m) => String(m?.id) !== uid
        );
        if (members.length === (channels[channelId].members || []).length) continue;
        changed = true;
        next[sid] = {
          ...channels,
          [channelId]: {
            members,
            memberCount: members.length,
          },
        };
      }
      return changed ? next : prev;
    });
  }, []);

  const cleanupAll = useCallback(() => {
    const leavingChannelId = activeChannelIdRef.current;
    const leavingServerId = activeServerIdRef.current;
    const meId = myIdRef.current;
    disconnectLiveKit();
    for (const userId of [...pcMapRef.current.keys()]) cleanupPeer(userId);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraStream(null);
    setIsCameraOn(false);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamMapRef.current = new Map();
    setLocalStream(null);
    setRemoteStreamsVersion((v) => v + 1);
    // Drop own ghost from sidebar voice lists immediately
    if (leavingChannelId && meId) {
      removeUserFromVoiceStates(leavingChannelId, meId, leavingServerId);
    }
    setActiveChannelId(null);
    setActiveServerId(null);
    setChannelName("");
    setParticipants([]);
    setMuted(false);
    setServerMuted(false);
    serverMutedRef.current = false;
    setChannelType("voice");
    setStageRole("speaker");
    setRequestedToSpeak(false);
    setCanRequestToSpeak(false);
    setCanSpeak(true);
    setCanStream(true);
    setConnecting(false);
  }, [cleanupPeer, disconnectLiveKit, removeUserFromVoiceStates]);

  const flushIce = async (pc, userId) => {
    const peer = pcMapRef.current.get(userId);
    if (!peer?.pendingIce?.length) return;
    for (const c of peer.pendingIce) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* ignore */
      }
    }
    peer.pendingIce = [];
  };

  const setupPc = useCallback(
    (pc, stream, userId, channelId) => {
      if (canPublishVoice()) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }
      if (cameraStreamRef.current && canPublishVideo()) {
        const peer = pcMapRef.current.get(userId);
        const v = cameraStreamRef.current.getVideoTracks()[0];
        if (v && peer) peer.cameraSender = pc.addTrack(v, cameraStreamRef.current);
      }
      // If we are already screen sharing, attach those tracks to new peers
      if (screenStreamRef.current && canPublishVideo()) {
        const peer = pcMapRef.current.get(userId);
        const ss = screenStreamRef.current;
        const v = ss.getVideoTracks()[0];
        const a = ss.getAudioTracks()[0];
        if (v && peer) {
          peer.screenSender = pc.addTrack(v, ss);
          if (a) peer.screenAudioSender = pc.addTrack(a, ss);
        }
      }
      pc.ontrack = (e) => {
        const track = e.track;
        const peer = pcMapRef.current.get(userId);
        const remote = e.streams?.[0] || new MediaStream([track]);
        const isScreenVideo =
          track.kind === "video" &&
          (Boolean(peer?.expectScreenShare) ||
            isRemoteScreenVideoTrack(track, {
              peerExpectsScreen: Boolean(peer?.expectScreenShare),
            }));
        const isScreenAudio = track.kind === "audio" && Boolean(peer?.expectScreenShare);
        if (isScreenVideo || isScreenAudio) {
          if (isScreenVideo && peer) peer.expectScreenShare = false;
          setParticipants((prev) => {
            const exists = prev.find((p) => p.id === userId);
            const existingScreen = exists?.screenStream || null;
            let screenStream = remote;
            if (existingScreen) {
              const kept = existingScreen
                .getTracks()
                .filter((t) => t.readyState !== "ended" && t.kind !== track.kind);
              const incoming = remote
                .getTracks()
                .filter((t) => t.readyState !== "ended");
              const merged = new MediaStream([...kept, ...incoming]);
              if (!merged.getTracks().includes(track) && track.readyState !== "ended") {
                merged.addTrack(track);
              }
              screenStream = merged;
            }
            if (exists) {
              return prev.map((p) =>
                p.id === userId
                  ? { ...p, screenStream, isScreenSharing: true, hasAudio: true }
                  : p
              );
            }
            return [
              ...prev,
              {
                id: userId,
                username: "Member",
                screenStream,
                isScreenSharing: true,
              },
            ];
          });
          return;
        }
        if (track.kind === "video") {
          setParticipants((prev) => {
            const exists = prev.find((p) => p.id === userId);
            if (exists) {
              return prev.map((p) =>
                p.id === userId ? { ...p, cameraStream: remote, cameraOn: true } : p
              );
            }
            return [...prev, { id: userId, username: "Member", cameraStream: remote, cameraOn: true }];
          });
          return;
        }
        attachRemoteAudio(userId, remote);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate && socket?.connected) {
          socket.emit("server:voice:ice", {
            channelId,
            toUserId: userId,
            candidate: e.candidate,
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          cleanupPeer(userId);
          setParticipants((prev) => prev.filter((p) => p.id !== userId));
        }
      };
    },
    [attachRemoteAudio, canPublishVideo, canPublishVoice, cleanupPeer, socket]
  );

  const renegotiateWithPeer = useCallback(
    async (userId, peerData) => {
      if (!peerData?.pc || !socket?.connected) return;
      if (peerData.pc.connectionState === "closed" || peerData.pc.signalingState === "closed") {
        return;
      }
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (peerData.pc.signalingState === "stable") break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (peerData.pc.signalingState !== "stable") return;
      const channelId = activeChannelIdRef.current;
      if (!channelId) return;
      try {
        const offer = await peerData.pc.createOffer();
        await peerData.pc.setLocalDescription(offer);
        socket.emit("server:voice:offer", {
          channelId,
          toUserId: userId,
          offer: peerData.pc.localDescription,
        });
      } catch (err) {
        console.warn("[ServerVoice] renegotiate failed:", err);
      }
    },
    [socket]
  );

  const offerToPeer = useCallback(
    async (user, channelId) => {
      if (!user?.id || !localStreamRef.current || !socket) return;
      if (sfuModeRef.current) return;
      if (pcMapRef.current.has(user.id)) return;
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      const peer = { pc, pendingIce: [] };
      pcMapRef.current.set(user.id, peer);
      setupPc(pc, localStreamRef.current, user.id, channelId);
      setParticipants((prev) => {
        if (prev.find((p) => p.id === user.id)) {
          return prev.map((p) => (p.id === user.id ? { ...p, ...user } : p));
        }
        return [...prev, { ...user, hasAudio: true }];
      });
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("server:voice:offer", {
          channelId,
          toUserId: user.id,
          offer: pc.localDescription,
        });
      } catch (err) {
        console.warn("[ServerVoice] offer failed:", err);
        cleanupPeer(user.id);
      }
    },
    [cleanupPeer, setupPc, socket]
  );

  const leave = useCallback(() => {
    const channelId = activeChannelIdRef.current;
    if (isScreenSharing) {
      stopScreenShareRef.current?.();
    }
    if (channelId && socket?.connected) {
      socket.emit("server:voice:leave", { channelId });
    }
    cleanupAll();
  }, [cleanupAll, isScreenSharing, socket]);

  const join = useCallback(
    async (serverId, channel) => {
      if (!socket?.connected || !channel?.id || !serverId) return;
      if (activeChannelIdRef.current === channel.id) return;
      if (activeChannelIdRef.current) leave();

      setConnecting(true);
      setError("");
      try {
        const nextChannelType = channel.type === "stage" ? "stage" : "voice";
        const isStage = nextChannelType === "stage";
        const stream = isStage
          ? new MediaStream()
          : await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
        setActiveChannelId(channel.id);
        setActiveServerId(serverId);
        setChannelName(channel.name || "");
        channelTypeRef.current = nextChannelType;
        stageRoleRef.current = isStage ? "audience" : "speaker";
        canSpeakRef.current = !isStage;
        canStreamRef.current = true;
        setChannelType(nextChannelType);
        setStageRole(isStage ? "audience" : "speaker");
        setCanSpeak(!isStage);
        setCanStream(true);
        setCanRequestToSpeak(isStage);
        setRequestedToSpeak(false);
        setParticipants([]);
        setMuted(isStage);
        socket.emit("server:voice:join", { serverId, channelId: channel.id });
        const mediaConfig = await getMediaConfig();
        if (mediaConfig?.sfu) {
          try {
            const tokenData = await getLiveKitToken(channel.id);
            if (tokenData?.enabled) {
              canSpeakRef.current = Boolean(tokenData.canPublish);
              setCanSpeak(Boolean(tokenData.canPublish));
              if (tokenData.canStream !== undefined) {
                canStreamRef.current = Boolean(tokenData.canStream);
                setCanStream(Boolean(tokenData.canStream));
              }
              if (tokenData.channelType) {
                channelTypeRef.current = tokenData.channelType;
                setChannelType(tokenData.channelType);
              }
              if (tokenData.stageRole) {
                stageRoleRef.current = tokenData.stageRole;
                setStageRole(tokenData.stageRole);
              }
              setCanRequestToSpeak(Boolean(tokenData.canRequestToSpeak));
              await connectLiveKitRoom(channel.id, tokenData, stream);
            }
          } catch (sfuErr) {
            console.warn("[ServerVoice] SFU connect failed; falling back to mesh:", sfuErr);
            disconnectLiveKit();
          }
        }
      } catch (err) {
        cleanupAll();
        const msg =
          err?.name === "NotAllowedError"
            ? "Microphone permission is required."
            : err?.message || "Could not join voice channel.";
        setError(msg);
      } finally {
        setConnecting(false);
      }
    },
    [cleanupAll, connectLiveKitRoom, disconnectLiveKit, getLiveKitToken, getMediaConfig, leave, socket]
  );

  const toggleMute = useCallback(async () => {
    if (serverMutedRef.current) return;
    if (!canPublishVoice()) {
      setError(
        channelTypeRef.current === "stage"
          ? "You need to be invited to speak first."
          : "You do not have permission to speak."
      );
      return;
    }
    let track = localStreamRef.current?.getAudioTracks()?.[0];
    if (!track) {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      track = stream.getAudioTracks()[0];
      if (!localStreamRef.current) localStreamRef.current = new MediaStream();
      if (track) localStreamRef.current.addTrack(track);
      setLocalStream(localStreamRef.current);
      if (sfuModeRef.current && liveKitRoomRef.current && track) {
        await liveKitRoomRef.current.localParticipant.publishTrack(track, {
          source: Track.Source.Microphone,
        });
      } else if (track) {
        for (const [userId, peerData] of pcMapRef.current.entries()) {
          try {
            peerData.audioSender = peerData.pc.addTrack(track, localStreamRef.current);
            await renegotiateWithPeer(userId, peerData);
          } catch (err) {
            console.warn("[ServerVoice] mic addTrack failed:", err);
          }
        }
      }
    }
    if (!track) return;
    track.enabled = !track.enabled;
    const nextMuted = !track.enabled;
    setMuted(nextMuted);
    const channelId = activeChannelIdRef.current;
    if (channelId && socket?.connected) {
      socket.emit("server:voice:media-state", {
        channelId,
        muted: nextMuted,
        cameraOn: cameraStreamRef.current?.getVideoTracks?.()[0]?.readyState === "live",
      });
    }
  }, [canPublishVoice, renegotiateWithPeer, socket]);

  const applyLocalMute = useCallback((nextMuted, { forced = false } = {}) => {
    const track = localStreamRef.current?.getAudioTracks()?.[0];
    if (track) track.enabled = !nextMuted;
    setMuted(Boolean(nextMuted));
    if (forced) {
      setServerMuted(true);
      serverMutedRef.current = true;
    }
  }, []);

  const disconnectMember = useCallback(
    (serverId, channelId, userId) => {
      if (!socket?.connected || !serverId || !userId) return;
      socket.emit("server:voice:disconnect", { serverId, channelId, userId });
    },
    [socket]
  );

  const moveMember = useCallback(
    (serverId, userId, fromChannelId, toChannelId) => {
      if (!socket?.connected || !serverId || !userId || !toChannelId) return;
      socket.emit("server:voice:move", { serverId, userId, fromChannelId, toChannelId });
    },
    [socket]
  );

  const serverMute = useCallback(
    (serverId, channelId, userId, muted) => {
      if (!socket?.connected || !serverId || !userId) return;
      socket.emit("server:voice:server-mute", {
        serverId,
        channelId,
        userId,
        muted: Boolean(muted),
      });
    },
    [socket]
  );

  const requestToSpeak = useCallback(() => {
    const channelId = activeChannelIdRef.current;
    if (!socket?.connected || !channelId || channelTypeRef.current !== "stage") return;
    socket.emit("server:voice:stage:request", { channelId });
    setRequestedToSpeak(true);
  }, [socket]);

  const setStageParticipantRole = useCallback(
    (serverId, channelId, userId, nextStageRole) => {
      if (!socket?.connected || !serverId || !channelId || !userId) return;
      socket.emit("server:voice:stage:set-role", {
        serverId,
        channelId,
        userId,
        stageRole: nextStageRole === "speaker" ? "speaker" : "audience",
      });
    },
    [socket]
  );

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing && !screenStreamRef.current) return;
    if (sfuModeRef.current && liveKitRoomRef.current && screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) {
        try {
          liveKitRoomRef.current.localParticipant.unpublishTrack(track);
        } catch {
          /* ignore */
        }
      }
    }
    for (const [userId, peerData] of pcMapRef.current.entries()) {
      try {
        if (peerData.screenSender) {
          peerData.pc.removeTrack(peerData.screenSender);
          delete peerData.screenSender;
        }
        if (peerData.screenAudioSender) {
          peerData.pc.removeTrack(peerData.screenAudioSender);
          delete peerData.screenAudioSender;
        }
        await renegotiateWithPeer(userId, peerData);
      } catch (err) {
        console.warn("[ServerVoice] screen removeTrack failed:", err);
      }
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    const channelId = activeChannelIdRef.current;
    if (channelId && socket?.connected) {
      socket.emit("server:voice:screen:stop", { channelId });
    }
  }, [isScreenSharing, renegotiateWithPeer, socket]);

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing || !activeChannelIdRef.current) return;
    if (!canPublishVideo()) {
      setError("You need SPEAK and STREAM permission to share media.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getDisplayMedia && !window.electronAPI?.isElectron) {
        setError("Screen sharing is not available in this browser.");
        return;
      }
      const { width, height, fps: frameRate } = resolveScreenCaptureSize(screenQuality);
      const peerCount = Math.max(1, pcMapRef.current.size);
      const maxBitrate = screenBitrateForPeerCount(peerCount, screenQuality.resolution || "720p");
      let stream;
      if (window.electronAPI?.isElectron) {
        const sources = await window.electronAPI.getScreenSources();
        if (!sources?.length) return;
        // Prefer entire screen source
        const source = sources.find((s) => s.id?.startsWith("screen:")) || sources[0];
        const { buildElectronDesktopConstraints } = await import("../lib/webrtcScreenShare");
        stream = await navigator.mediaDevices.getUserMedia(
          buildElectronDesktopConstraints(source.id, { width, height, fps: frameRate })
        );
      } else {
        stream = await getDisplayMediaStream({
          width,
          height,
          fps: frameRate,
          preferTab: !isMobileScreenCapture(),
        });
      }
      const screenTrack = stream.getVideoTracks()[0];
      await optimizeScreenShareTrack(screenTrack, {
        width,
        height,
        fps: frameRate,
        contentHint: screenQuality.contentHint || "motion",
      });
      if (screenTrack.readyState !== "live") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const { track: screenAudioTrack } = await ensureScreenShareAudioTrack(stream);
      screenStreamRef.current = stream;
      setScreenStream(stream);

      const channelId = activeChannelIdRef.current;
      if (socket?.connected && channelId) {
        socket.emit("server:voice:screen:start", { channelId });
      }

      if (sfuModeRef.current && liveKitRoomRef.current) {
        await liveKitRoomRef.current.localParticipant.publishTrack(screenTrack, {
          source: Track.Source.ScreenShare,
        });
        if (screenAudioTrack) {
          await liveKitRoomRef.current.localParticipant.publishTrack(screenAudioTrack, {
            source: Track.Source.ScreenShareAudio,
          });
        }
        screenTrack.onended = () => {
          stopScreenShareRef.current?.();
        };
        setIsScreenSharing(true);
        return;
      }

      for (const [userId, peerData] of pcMapRef.current.entries()) {
        try {
          peerData.screenSender = peerData.pc.addTrack(screenTrack, stream);
          if (screenAudioTrack) {
            peerData.screenAudioSender = peerData.pc.addTrack(screenAudioTrack, stream);
          }
          await optimizeScreenShareSender(peerData.screenSender, {
            maxBitrate,
            maxFramerate: frameRate,
          });
          await renegotiateWithPeer(userId, peerData);
        } catch (err) {
          console.warn("[ServerVoice] screen addTrack failed:", err);
        }
      }

      screenTrack.onended = () => {
        stopScreenShareRef.current?.();
      };
      setIsScreenSharing(true);
    } catch (err) {
      if (err?.name !== "NotAllowedError") {
        setError(err?.message || "Could not start screen share.");
      }
    }
  }, [canPublishVideo, isScreenSharing, renegotiateWithPeer, screenQuality, socket]);

  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

  const stopCamera = useCallback(async () => {
    if (!isCameraOn && !cameraStreamRef.current) return;
    const stream = cameraStreamRef.current;
    if (sfuModeRef.current && liveKitRoomRef.current && stream) {
      for (const track of stream.getTracks()) {
        try {
          liveKitRoomRef.current.localParticipant.unpublishTrack(track);
        } catch {
          /* ignore */
        }
      }
    }
    for (const [userId, peerData] of pcMapRef.current.entries()) {
      try {
        if (peerData.cameraSender) {
          peerData.pc.removeTrack(peerData.cameraSender);
          delete peerData.cameraSender;
        }
        await renegotiateWithPeer(userId, peerData);
      } catch (err) {
        console.warn("[ServerVoice] camera removeTrack failed:", err);
      }
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraStream(null);
    setIsCameraOn(false);
    const channelId = activeChannelIdRef.current;
    if (channelId && socket?.connected) {
      socket.emit("server:voice:camera:stop", { channelId });
      socket.emit("server:voice:media-state", { channelId, muted: mutedRef.current, cameraOn: false });
    }
  }, [isCameraOn, renegotiateWithPeer, socket]);

  const startCamera = useCallback(async () => {
    if (isCameraOn || !activeChannelIdRef.current) return;
    if (!canPublishVideo()) {
      setError("You need SPEAK and STREAM permission to turn on camera.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      const cameraTrack = stream.getVideoTracks()[0];
      if (!cameraTrack || cameraTrack.readyState !== "live") {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      const channelId = activeChannelIdRef.current;
      if (socket?.connected && channelId) {
        socket.emit("server:voice:camera:start", { channelId });
        socket.emit("server:voice:media-state", { channelId, muted: mutedRef.current, cameraOn: true });
      }
      if (sfuModeRef.current && liveKitRoomRef.current) {
        await liveKitRoomRef.current.localParticipant.publishTrack(cameraTrack, {
          source: Track.Source.Camera,
        });
      } else {
        for (const [userId, peerData] of pcMapRef.current.entries()) {
          try {
            peerData.cameraSender = peerData.pc.addTrack(cameraTrack, stream);
            await renegotiateWithPeer(userId, peerData);
          } catch (err) {
            console.warn("[ServerVoice] camera addTrack failed:", err);
          }
        }
      }
      cameraTrack.onended = () => {
        stopCameraRef.current?.();
      };
      setIsCameraOn(true);
    } catch (err) {
      if (err?.name !== "NotAllowedError") {
        setError(err?.message || "Could not start camera.");
      }
    }
  }, [canPublishVideo, isCameraOn, renegotiateWithPeer, socket]);

  useEffect(() => {
    stopCameraRef.current = stopCamera;
  }, [stopCamera]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) await stopCamera();
    else await startCamera();
  }, [isCameraOn, startCamera, stopCamera]);

  const subscribeServer = useCallback(
    (serverId) => {
      if (!socket?.connected || !serverId) return;
      socket.emit("server:voice:subscribe", { serverId });
    },
    [socket]
  );

  const checkChannel = useCallback(
    (channelId) => {
      if (!socket?.connected || !channelId) return;
      socket.emit("server:voice:check", { channelId });
    },
    [socket]
  );

  useEffect(() => {
    if (!socket) return undefined;
    myIdRef.current = getUser()?.id || myIdRef.current;

    const onJoined = ({
      channelId,
      serverId,
      channelName: name,
      channelType: type,
      participants: others,
      canSpeak: canSpeakNow,
      canStream: canStreamNow,
      canRequestToSpeak: canRequest,
      stageRole: role,
      requestedToSpeak: requested,
      serverMuted: forcedMute,
    } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current) return;
      setActiveServerId(serverId || null);
      if (name) setChannelName(name);
      if (type) {
        channelTypeRef.current = type;
        setChannelType(type);
      }
      if (role) {
        stageRoleRef.current = role;
        setStageRole(role);
      }
      if (canSpeakNow !== undefined) {
        canSpeakRef.current = Boolean(canSpeakNow);
        setCanSpeak(Boolean(canSpeakNow));
      }
      if (canStreamNow !== undefined) {
        canStreamRef.current = Boolean(canStreamNow);
        setCanStream(Boolean(canStreamNow));
      }
      if (canRequest !== undefined) setCanRequestToSpeak(Boolean(canRequest));
      setRequestedToSpeak(Boolean(requested));
      setParticipants(Array.isArray(others) ? others.map((u) => ({ ...u, hasAudio: true })) : []);
      if (forcedMute || canSpeakNow === false) {
        applyLocalMute(true, { forced: Boolean(forcedMute) });
        const ch = activeChannelIdRef.current;
        if (ch && socket?.connected) {
          socket.emit("server:voice:media-state", { channelId: ch, muted: true, cameraOn: false });
        }
      }
    };

    const onMemberJoined = ({ channelId, user } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !user?.id) return;
      if (user.id === myIdRef.current) return;
      // We are already in the room — offer to the new joiner
      offerToPeer(user, channelId);
    };

    const onMemberLeft = ({ serverId, channelId, userId } = {}) => {
      if (!channelId || !userId) return;
      const uid = String(userId);
      // Always clear sidebar / presence lists (viewers not in the call)
      removeUserFromVoiceStates(channelId, uid, serverId || null);
      // If we're in that channel, tear down the peer + in-call roster
      if (channelId === activeChannelIdRef.current) {
        cleanupPeer(uid);
        setParticipants((prev) => prev.filter((p) => String(p.id) !== uid));
      }
    };

    const onOffer = async ({ channelId, fromUserId, fromUser, offer } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId || !offer) return;
      if (sfuModeRef.current) return;
      const stream = localStreamRef.current;
      if (!stream) return;

      let peer = pcMapRef.current.get(fromUserId);
      if (!peer) {
        const pc = new RTCPeerConnection({ iceServers: getIceServers() });
        peer = { pc, pendingIce: [] };
        pcMapRef.current.set(fromUserId, peer);
        setupPc(pc, stream, fromUserId, channelId);
      }
      setParticipants((prev) => {
        const base = fromUser || { id: fromUserId };
        if (prev.find((p) => p.id === fromUserId)) {
          return prev.map((p) => (p.id === fromUserId ? { ...p, ...base } : p));
        }
        return [...prev, { ...base, hasAudio: true }];
      });
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(peer.pc, fromUserId);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        socket.emit("server:voice:answer", {
          channelId,
          toUserId: fromUserId,
          answer: peer.pc.localDescription,
        });
      } catch (err) {
        console.warn("[ServerVoice] answer failed:", err);
      }
    };

    const onAnswer = async ({ channelId, fromUserId, answer } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId || !answer) return;
      const peer = pcMapRef.current.get(fromUserId);
      if (!peer || peer.pc.signalingState !== "have-local-offer") return;
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(peer.pc, fromUserId);
      } catch (err) {
        console.warn("[ServerVoice] setRemote answer failed:", err);
      }
    };

    const onIce = async ({ channelId, fromUserId, candidate } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId || !candidate) return;
      const peer = pcMapRef.current.get(fromUserId);
      if (!peer) {
        // Early ICE — stash when PC appears via offer/answer path isn't ready
        return;
      }
      if (!peer.pc.remoteDescription) {
        peer.pendingIce.push(candidate);
        return;
      }
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore */
      }
    };

    const onMediaState = ({
      channelId,
      fromUserId,
      muted: isMuted,
      serverMuted: sMuted,
      cameraOn,
    } = {}) => {
      if (!channelId || !fromUserId) return;
      if (channelId === activeChannelIdRef.current) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === fromUserId
              ? {
                  ...p,
                  muted: Boolean(isMuted),
                  serverMuted: Boolean(sMuted),
                  cameraOn: cameraOn !== undefined ? Boolean(cameraOn) : p.cameraOn,
                }
              : p
          )
        );
      }
    };

    const onForceDisconnected = ({ serverId, channelId } = {}) => {
      const ch = channelId || activeChannelIdRef.current;
      const meId = myIdRef.current;
      if (ch && meId) removeUserFromVoiceStates(ch, meId, serverId || activeServerIdRef.current);
      if (ch && ch === activeChannelIdRef.current) {
        cleanupAll();
      } else if (ch) {
        // Already cleaned locally but still clear any leftover roster
        setParticipants((prev) => prev.filter((p) => String(p.id) !== String(meId)));
      }
      setError("You were disconnected from the voice channel.");
    };

    const onForceMoved = ({ fromChannelId, toChannelId, channelName: name, channelType: type, serverId } = {}) => {
      if (!toChannelId) return;
      if (fromChannelId && fromChannelId !== activeChannelIdRef.current) return;
      cleanupAll();
      // Rejoin destination after brief cleanup
      window.setTimeout(() => {
        joinRef.current?.(serverId, { id: toChannelId, name: name || "Voice", type: type || "voice" });
      }, 80);
    };

    const onForceMute = ({ channelId, muted: isMuted } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current) return;
      if (isMuted) {
        applyLocalMute(true, { forced: true });
      } else {
        setServerMuted(false);
        serverMutedRef.current = false;
      }
    };

    const onChannelState = ({ serverId, channelId, members, memberCount } = {}) => {
      if (!serverId || !channelId) return;
      const list = Array.isArray(members) ? members : [];
      setVoiceStatesByServer((prev) => ({
        ...prev,
        [serverId]: {
          ...(prev[serverId] || {}),
          [channelId]: { members: list, memberCount: memberCount ?? list.length },
        },
      }));
      // Keep in-call roster in sync when server authoritatively drops someone
      if (channelId === activeChannelIdRef.current) {
        const ids = new Set(list.map((m) => String(m?.id)));
        setParticipants((prev) => {
          const next = prev.filter((p) => ids.has(String(p.id)));
          return next.length === prev.length ? prev : next;
        });
        for (const peerId of [...pcMapRef.current.keys()]) {
          if (!ids.has(String(peerId))) cleanupPeer(peerId);
        }
      }
    };

    const onStates = ({ serverId, states } = {}) => {
      if (!serverId) return;
      const map = {};
      for (const s of states || []) {
        map[s.channelId] = { members: s.members || [], memberCount: s.memberCount || 0 };
      }
      setVoiceStatesByServer((prev) => ({ ...prev, [serverId]: map }));
    };

    const onError = ({ message, code } = {}) => {
      if (message) setError(message);
      // Moderation / permission errors should not kick you from voice
      if (code === "MISSING_PERMISSION" || code === "NOT_MEMBER") return;
      if (activeChannelIdRef.current && /join|microphone|connect/i.test(message || "")) {
        cleanupAll();
      }
    };

    const onLeft = ({ channelId } = {}) => {
      if (channelId && channelId === activeChannelIdRef.current) cleanupAll();
    };

    const onScreenStarted = ({ channelId, fromUserId, fromUser } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId) return;
      if (fromUserId === myIdRef.current) return;
      const peer = pcMapRef.current.get(fromUserId);
      if (peer) peer.expectScreenShare = true;
      setParticipants((prev) => {
        if (prev.find((p) => p.id === fromUserId)) {
          return prev.map((p) =>
            p.id === fromUserId ? { ...p, ...fromUser, isScreenSharing: true } : p
          );
        }
        return [...prev, { ...(fromUser || { id: fromUserId }), isScreenSharing: true }];
      });
    };

    const onScreenStopped = ({ channelId, fromUserId } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId) return;
      const peer = pcMapRef.current.get(fromUserId);
      if (peer) peer.expectScreenShare = false;
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === fromUserId ? { ...p, isScreenSharing: false, screenStream: null } : p
        )
      );
    };

    const onCameraStarted = ({ channelId, fromUserId, fromUser } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId) return;
      if (fromUserId === myIdRef.current) return;
      setParticipants((prev) => {
        if (prev.find((p) => p.id === fromUserId)) {
          return prev.map((p) =>
            p.id === fromUserId ? { ...p, ...fromUser, cameraOn: true } : p
          );
        }
        return [...prev, { ...(fromUser || { id: fromUserId }), cameraOn: true }];
      });
    };

    const onCameraStopped = ({ channelId, fromUserId } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId) return;
      setParticipants((prev) =>
        prev.map((p) => (p.id === fromUserId ? { ...p, cameraOn: false, cameraStream: null } : p))
      );
    };

    const onStageState = ({ channelId, userId, requestedToSpeak: requested, stageRole: role } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !userId) return;
      if (userId === myIdRef.current) {
        if (requested !== undefined) setRequestedToSpeak(Boolean(requested));
        if (role) {
          stageRoleRef.current = role;
          setStageRole(role);
          const nextCanSpeak = role === "speaker";
          canSpeakRef.current = nextCanSpeak;
          setCanSpeak(nextCanSpeak);
        }
      }
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === userId
            ? {
                ...p,
                requestedToSpeak: requested !== undefined ? Boolean(requested) : p.requestedToSpeak,
                stageRole: role || p.stageRole,
              }
            : p
        )
      );
    };

    const onStageRole = ({ channelId, stageRole: role } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !role) return;
      stageRoleRef.current = role;
      setStageRole(role);
      setRequestedToSpeak(false);
      const nextCanSpeak = role === "speaker";
      canSpeakRef.current = nextCanSpeak;
      setCanSpeak(nextCanSpeak);
      setServerMuted(false);
      serverMutedRef.current = false;
      if (!nextCanSpeak) {
        applyLocalMute(true);
        stopCameraRef.current?.();
        stopScreenShareRef.current?.();
      }
      if (liveKitRoomRef.current) {
        const stream = localStreamRef.current || new MediaStream();
        getLiveKitToken(channelId)
          .then(async (tokenData) => {
            disconnectLiveKit();
            if (tokenData?.enabled) await connectLiveKitRoom(channelId, tokenData, stream);
          })
          .catch((err) => console.warn("[ServerVoice] stage LiveKit refresh failed:", err));
      }
    };

    socket.on("server:voice:joined", onJoined);
    socket.on("server:voice:member-joined", onMemberJoined);
    socket.on("server:voice:member-left", onMemberLeft);
    socket.on("server:voice:offer", onOffer);
    socket.on("server:voice:answer", onAnswer);
    socket.on("server:voice:ice", onIce);
    socket.on("server:voice:media-state", onMediaState);
    socket.on("server:voice:channel-state", onChannelState);
    socket.on("server:voice:states", onStates);
    socket.on("server:voice:error", onError);
    socket.on("server:voice:left", onLeft);
    socket.on("server:voice:force-disconnected", onForceDisconnected);
    socket.on("server:voice:force-moved", onForceMoved);
    socket.on("server:voice:force-mute", onForceMute);
    socket.on("server:voice:screen:started", onScreenStarted);
    socket.on("server:voice:screen:stopped", onScreenStopped);
    socket.on("server:voice:camera:started", onCameraStarted);
    socket.on("server:voice:camera:stopped", onCameraStopped);
    socket.on("server:voice:stage-state", onStageState);
    socket.on("server:voice:stage-role", onStageRole);

    return () => {
      socket.off("server:voice:joined", onJoined);
      socket.off("server:voice:member-joined", onMemberJoined);
      socket.off("server:voice:member-left", onMemberLeft);
      socket.off("server:voice:offer", onOffer);
      socket.off("server:voice:answer", onAnswer);
      socket.off("server:voice:ice", onIce);
      socket.off("server:voice:media-state", onMediaState);
      socket.off("server:voice:channel-state", onChannelState);
      socket.off("server:voice:states", onStates);
      socket.off("server:voice:error", onError);
      socket.off("server:voice:left", onLeft);
      socket.off("server:voice:force-disconnected", onForceDisconnected);
      socket.off("server:voice:force-moved", onForceMoved);
      socket.off("server:voice:force-mute", onForceMute);
      socket.off("server:voice:screen:started", onScreenStarted);
      socket.off("server:voice:screen:stopped", onScreenStopped);
      socket.off("server:voice:camera:started", onCameraStarted);
      socket.off("server:voice:camera:stopped", onCameraStopped);
      socket.off("server:voice:stage-state", onStageState);
      socket.off("server:voice:stage-role", onStageRole);
    };
  }, [
    applyLocalMute,
    cleanupAll,
    cleanupPeer,
    connectLiveKitRoom,
    disconnectLiveKit,
    getLiveKitToken,
    offerToPeer,
    removeUserFromVoiceStates,
    setupPc,
    socket,
  ]);

  useEffect(() => {
    joinRef.current = join;
  }, [join]);

  useEffect(() => () => cleanupAll(), [cleanupAll]);

  const remoteStreams = useMemo(() => {
    void remoteStreamsVersion;
    return new Map(remoteStreamMapRef.current);
  }, [remoteStreamsVersion]);

  return {
    isInVoice: Boolean(activeChannelId),
    activeChannelId,
    activeServerId,
    channelName,
    participants,
    muted,
    serverMuted,
    connecting,
    error,
    voiceStatesByServer,
    localStream,
    remoteStreams,
    isScreenSharing,
    screenStream,
    isCameraOn,
    cameraStream,
    channelType,
    stageRole,
    requestedToSpeak,
    canRequestToSpeak,
    canSpeak,
    canStream,
    mediaMode,
    myUserId: myIdRef.current,
    join,
    leave,
    toggleMute,
    toggleCamera,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    requestToSpeak,
    subscribeServer,
    checkChannel,
    disconnectMember,
    moveMember,
    serverMute,
    setStageParticipantRole,
  };
}

export default useServerVoice;

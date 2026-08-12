import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getIceServers, preloadIceServers } from "../lib/iceConfig";
import { getUser } from "../lib/storage";
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
  const screenQuality = GROUP_SCREEN_DEFAULT_QUALITY;

  useEffect(() => {
    preloadIceServers().catch(() => {});
  }, []);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

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

  const cleanupAll = useCallback(() => {
    for (const userId of [...pcMapRef.current.keys()]) cleanupPeer(userId);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamMapRef.current = new Map();
    setLocalStream(null);
    setRemoteStreamsVersion((v) => v + 1);
    setActiveChannelId(null);
    setActiveServerId(null);
    setChannelName("");
    setParticipants([]);
    setMuted(false);
    setServerMuted(false);
    serverMutedRef.current = false;
    setConnecting(false);
  }, [cleanupPeer]);

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
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // If we are already screen sharing, attach those tracks to new peers
      if (screenStreamRef.current) {
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
    [attachRemoteAudio, cleanupPeer, socket]
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
        const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
        setActiveChannelId(channel.id);
        setActiveServerId(serverId);
        setChannelName(channel.name || "");
        setParticipants([]);
        setMuted(false);
        socket.emit("server:voice:join", { serverId, channelId: channel.id });
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
    [cleanupAll, leave, socket]
  );

  const toggleMute = useCallback(() => {
    if (serverMutedRef.current) return;
    const track = localStreamRef.current?.getAudioTracks()?.[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const nextMuted = !track.enabled;
    setMuted(nextMuted);
    const channelId = activeChannelIdRef.current;
    if (channelId && socket?.connected) {
      socket.emit("server:voice:media-state", { channelId, muted: nextMuted });
    }
  }, [socket]);

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

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing && !screenStreamRef.current) return;
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
  }, [isScreenSharing, renegotiateWithPeer, screenQuality, socket]);

  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

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
      participants: others,
      canSpeak,
      serverMuted: forcedMute,
    } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current) return;
      setActiveServerId(serverId || null);
      if (name) setChannelName(name);
      setParticipants(Array.isArray(others) ? others.map((u) => ({ ...u, hasAudio: true })) : []);
      if (forcedMute || canSpeak === false) {
        applyLocalMute(true, { forced: true });
        const ch = activeChannelIdRef.current;
        if (ch && socket?.connected) {
          socket.emit("server:voice:media-state", { channelId: ch, muted: true });
        }
      }
    };

    const onMemberJoined = ({ channelId, user } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !user?.id) return;
      if (user.id === myIdRef.current) return;
      // We are already in the room — offer to the new joiner
      offerToPeer(user, channelId);
    };

    const onMemberLeft = ({ channelId, userId } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !userId) return;
      cleanupPeer(userId);
      setParticipants((prev) => prev.filter((p) => p.id !== userId));
    };

    const onOffer = async ({ channelId, fromUserId, fromUser, offer } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current || !fromUserId || !offer) return;
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

    const onMediaState = ({ channelId, fromUserId, muted: isMuted, serverMuted: sMuted } = {}) => {
      if (!channelId || !fromUserId) return;
      if (channelId === activeChannelIdRef.current) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === fromUserId
              ? { ...p, muted: Boolean(isMuted), serverMuted: Boolean(sMuted) }
              : p
          )
        );
      }
    };

    const onForceDisconnected = ({ channelId } = {}) => {
      if (!channelId || channelId !== activeChannelIdRef.current) return;
      cleanupAll();
      setError("You were disconnected from the voice channel.");
    };

    const onForceMoved = ({ fromChannelId, toChannelId, channelName: name, serverId } = {}) => {
      if (!toChannelId) return;
      if (fromChannelId && fromChannelId !== activeChannelIdRef.current) return;
      cleanupAll();
      // Rejoin destination after brief cleanup
      window.setTimeout(() => {
        joinRef.current?.(serverId, { id: toChannelId, name: name || "Voice" });
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
      setVoiceStatesByServer((prev) => ({
        ...prev,
        [serverId]: {
          ...(prev[serverId] || {}),
          [channelId]: { members: members || [], memberCount: memberCount || 0 },
        },
      }));
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
    };
  }, [applyLocalMute, cleanupAll, cleanupPeer, offerToPeer, setupPc, socket]);

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
    myUserId: myIdRef.current,
    join,
    leave,
    toggleMute,
    startScreenShare,
    stopScreenShare,
    subscribeServer,
    checkChannel,
    disconnectMember,
    moveMember,
    serverMute,
  };
}

export default useServerVoice;

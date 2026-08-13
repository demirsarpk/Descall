import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Mic, Smile,
  Plus, Gift, Image, FileText, X, StopCircle, Loader2, Reply, Dice5, HelpCircle, Wallet, Trophy, CalendarDays,
  Info, UserRound, ImageIcon, Pencil, BarChart3, Timer
} from "lucide-react";
import GiphyPicker from "./GiphyPicker";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";
import { encodeVoiceContent, pickRecorderMime, extensionForMime } from "../../lib/voiceMessage";
import { useT } from "../../context/LocaleContext";
import { getSlashCommandsForSurface } from "../../lib/slashCommands";
import { serverHasPermission } from "../../lib/serverPermissions";

const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"] },
  { name: "Gestures", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","💋","🩸"] },
  { name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❣️","💕","💞","💓","💗","💖","💘","💝","💟"] },
];

const SLASH_ICONS = {
  bj: Dice5,
  daily: CalendarDays,
  help: HelpCircle,
  credits: Wallet,
  top: Trophy,
  server: Info,
  user: UserRound,
  avatar: ImageIcon,
  nick: Pencil,
  poll: BarChart3,
  timeout: Timer,
};

function formatSlowmode(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!n) return "";
  if (n >= 3600) return `${Math.round(n / 3600)}h`;
  if (n >= 60) return `${Math.round(n / 60)}m`;
  return `${n}s`;
}

export default function MessageComposer({
  onSend,
  disabled = false,
  activeDmUser,
  activeGroup,
  activeChannel = null,
  activeServer = null,
  onTypingDmStart,
  onTypingDmStop,
  onTypingGroupStart,
  onTypingGroupStop,
  onTypingChannelStart,
  onTypingChannelStop,
  replyTo = null,
  onClearReply,
}) {
  const t = useT();
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveBars, setWaveBars] = useState(() => Array(24).fill(0.15));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pendingAttach, setPendingAttach] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sendFlash, setSendFlash] = useState(false);
  const [slowmodeUntil, setSlowmodeUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const slowmodeSeconds = Math.max(0, Math.floor(Number(activeChannel?.slowmodeSeconds) || 0));
  const slowmodeLabel = formatSlowmode(slowmodeSeconds);
  const bypassSlowmode =
    Boolean(activeServer) &&
    (serverHasPermission(activeServer, "MANAGE_MESSAGES") ||
      serverHasPermission(activeServer, "ADMINISTRATOR"));
  const slowmodeRemaining = Math.max(0, Math.ceil((slowmodeUntil - nowTick) / 1000));
  const slowmodeBlocked = Boolean(activeChannel?.id) && !bypassSlowmode && slowmodeRemaining > 0;
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimeRef = useRef(0);
  const timerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const attachBtnRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    // Autofocus on mobile opens the iOS keyboard and often leaves the shell
    // stuck elevated after dismiss — only autofocus desktop / large screens.
    const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    if (isNarrow) return;
    inputRef.current?.focus();
  }, [activeDmUser?.id, activeGroup?.id, replyTo?.id]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const onBlur = () => {
      // After keyboard dismiss animation (~280ms) — avoid mid-slide scroll jumps.
      window.setTimeout(() => {
        try {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        } catch { /* ignore */ }
      }, 280);
    };
    el.addEventListener("blur", onBlur);
    return () => el.removeEventListener("blur", onBlur);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest(".emoji-picker") && !e.target.closest(".composer-action-btn")) {
        setShowEmojiPicker(false);
      }
      if (!e.target.closest(".attachment-menu") && !e.target.closest(".composer-action-btn")) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const emitTypingStop = useCallback(() => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    if (activeDmUser) onTypingDmStop?.(activeDmUser.id);
    else if (activeGroup) onTypingGroupStop?.(activeGroup.id);
    else if (activeChannel?.id) onTypingChannelStop?.(activeChannel.id);
  }, [
    activeDmUser,
    activeGroup,
    activeChannel?.id,
    onTypingDmStop,
    onTypingGroupStop,
    onTypingChannelStop,
  ]);

  const emitTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (activeDmUser) onTypingDmStart?.(activeDmUser.id);
      else if (activeGroup) onTypingGroupStart?.(activeGroup.id);
      else if (activeChannel?.id) onTypingChannelStart?.(activeChannel.id);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(emitTypingStop, 3000);
  }, [
    activeDmUser,
    activeGroup,
    activeChannel?.id,
    onTypingDmStart,
    onTypingGroupStart,
    onTypingChannelStart,
    emitTypingStop,
  ]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      emitTypingStop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDmUser?.id, activeGroup?.id, activeChannel?.id]);

  const slashCommands = useMemo(
    () =>
      getSlashCommandsForSurface({
        activeChannel,
        activeGroup,
        permissionFlags: activeServer?.myPermissions?.flags || {},
        isOwner: Boolean(activeServer?.isOwner),
      }).map((cmd) => ({
        ...cmd,
        Icon: SLASH_ICONS[cmd.name] || HelpCircle,
      })),
    [activeChannel, activeGroup, activeServer?.isOwner, activeServer?.myPermissions?.flags]
  );

  const slashMatches = useMemo(() => {
    if (!slashCommands.length) return [];
    const raw = message;
    // Only while composing a leading slash token (no spaces yet, or "/bj " still editing command)
    if (!raw.startsWith("/")) return [];
    const firstToken = raw.split(/\s/)[0] || "";
    if (raw.includes(" ") && firstToken.length > 1) {
      // Already chose a command with args — hide picker
      return [];
    }
    const q = firstToken.toLowerCase();
    return slashCommands.filter((cmd) => {
      return cmd.command.startsWith(q) || q === "/";
    });
  }, [message, slashCommands]);

  useEffect(() => {
    setSlashIndex(0);
  }, [slashMatches.length, message]);

  const applySlashCommand = useCallback((cmd) => {
    if (!cmd) return;
    setMessage(cmd.insert);
    setSlashIndex(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = cmd.insert.length;
      el.selectionStart = el.selectionEnd = pos;
    });
  }, []);

  const withReply = (payload) => {
    if (!replyTo) return payload;
    const replyMeta = {
      id: replyTo.id,
      text: replyTo.text || "",
      mediaType: replyTo.mediaType,
      from: replyTo.from || { username: replyTo.username },
    };
    if (typeof payload === "string") {
      return { type: "text", text: payload, replyTo: replyMeta };
    }
    return { ...payload, replyTo: replyMeta };
  };

  useEffect(() => {
    setSlowmodeUntil(0);
  }, [activeChannel?.id, slowmodeSeconds]);

  useEffect(() => {
    if (!slowmodeUntil) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [slowmodeUntil]);

  useEffect(() => {
    const onSlowmode = (event) => {
      const detail = event?.detail || {};
      if (!activeChannel?.id || String(detail.channelId) !== String(activeChannel.id)) return;
      const wait = Math.max(1, Math.ceil(Number(detail.retryAfterSeconds) || 1));
      setSlowmodeUntil(Date.now() + wait * 1000);
      setNowTick(Date.now());
    };
    window.addEventListener("descall:slowmode", onSlowmode);
    return () => window.removeEventListener("descall:slowmode", onSlowmode);
  }, [activeChannel?.id]);

  const armLocalSlowmode = () => {
    if (!activeChannel?.id || !slowmodeSeconds || bypassSlowmode) return;
    setSlowmodeUntil(Date.now() + slowmodeSeconds * 1000);
    setNowTick(Date.now());
  };

  const handleSend = () => {
    if (disabled || slowmodeBlocked) return;
    clearTimeout(typingTimerRef.current);
    emitTypingStop();

    const flash = () => {
      setSendFlash(true);
      window.setTimeout(() => setSendFlash(false), 480);
    };

    if (pendingAttach) {
      onSend?.(withReply({ ...pendingAttach }));
      setPendingAttach(null);
      if (pendingAttach.previewUrl) URL.revokeObjectURL(pendingAttach.previewUrl);
      onClearReply?.();
      armLocalSlowmode();
      flash();
      return;
    }

    if (!message.trim()) return;
    onSend?.(withReply(message.trim()));
    setMessage("");
    onClearReply?.();
    armLocalSlowmode();
    flash();
  };

  const handleKeyDown = (e) => {
    if (slashMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applySlashCommand(slashMatches[slashIndex] || slashMatches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMessage("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyTo) {
      onClearReply?.();
    }
  };

  const stageFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const previewUrl =
        data.mediaType === "image" || file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null;
      setPendingAttach({
        type: "media",
        mediaUrl: data.url,
        mediaType: data.mediaType,
        originalName: data.originalName || file.name,
        mimeType: data.mimeType || file.type,
        size: data.size || file.size,
        previewUrl,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(err.message);
      setTimeout(() => setUploadError(""), 4000);
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    await stageFile(file);
    e.target.value = "";
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await stageFile(file);
  };

  const startWaveform = (stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / 24));
        const bars = [];
        for (let i = 0; i < 24; i += 1) {
          bars.push(Math.max(0.12, (data[i * step] || 0) / 255));
        }
        setWaveBars(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* ignore */
    }
  };

  const stopWaveform = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setWaveBars(Array(24).fill(0.15));
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const actualMime = recorder.mimeType || mimeType || "audio/webm";
      audioChunksRef.current = [];
      recordingTimeRef.current = 0;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopWaveform();
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        if (!blob.size) {
          setUploadError(t("Empty recording — try again."));
          setTimeout(() => setUploadError(""), 4000);
          return;
        }
        const durationSec = Math.max(1, recordingTimeRef.current || 1);
        setUploading(true);
        try {
          const formData = new FormData();
          const ext = extensionForMime(actualMime);
          formData.append("file", blob, `voice-${Date.now()}.${ext}`);
          const res = await fetch(`${API_BASE_URL}/api/media/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Voice upload failed");
          onSend?.(withReply({
            type: "media",
            mediaUrl: data.url,
            mediaType: "voice",
            mimeType: actualMime,
            originalName: data.originalName || `voice.${ext}`,
            size: data.size || blob.size,
            duration: durationSec,
            text: encodeVoiceContent(durationSec),
          }));
          onClearReply?.();
        } catch (err) {
          setUploadError(err.message);
          setTimeout(() => setUploadError(""), 4000);
        } finally {
          setUploading(false);
        }
      };
      recorder.onerror = () => {
        stopWaveform();
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        setUploadError(t("Recording failed."));
        setTimeout(() => setUploadError(""), 4000);
      };
      // timeslice helps finalize duration metadata on some browsers
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      startWaveform(stream);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          const next = t + 1;
          recordingTimeRef.current = next;
          if (next >= 120) {
            // auto-stop at 2 minutes
            try {
              mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
            } catch {
              /* ignore */
            }
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Recording failed:", err);
      setUploadError(t("Microphone access denied."));
      setTimeout(() => setUploadError(""), 4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSend, replyTo, onClearReply]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.requestData?.();
      } catch {
        /* ignore */
      }
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setIsRecording(false);
  }, []);

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (!el) { setMessage((m) => m + emoji); return; }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const before = message.slice(0, start);
    const after = message.slice(end);
    const next = before + emoji + after;
    setMessage(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    });
  };

  const handleGifSelect = (gif) => {
    onSend?.(withReply({ type: "gif", mediaUrl: gif.url, mediaType: "gif", title: gif.title }));
    setShowGiphy(false);
    onClearReply?.();
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const canSend = Boolean(message.trim() || pendingAttach) && !slowmodeBlocked;

  return (
    <div
      className={`message-composer${dragOver ? " is-dragover" : ""}${sendFlash ? " is-sending" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <GiphyPicker
        isOpen={showGiphy}
        onClose={() => setShowGiphy(false)}
        onSelectGif={handleGifSelect}
        anchorRef={attachBtnRef}
      />

      <AnimatePresence>
        {slowmodeLabel && !replyTo && (
          <motion.div
            className="composer-slowmode-hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Timer size={13} />
            <span>
              {slowmodeBlocked
                ? t("Slowmode: wait {time}", { time: `${slowmodeRemaining}s` })
                : t("Slowmode is on: {time} between messages", { time: slowmodeLabel })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {replyTo && (
          <motion.div
            className="composer-reply-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Reply size={14} />
            <div className="composer-reply-meta">
              <strong>{t("Replying to")} {replyTo.from?.displayName || replyTo.from?.display_name || replyTo.from?.username || t("message")}</strong>
              <span>
                {replyTo.text
                  ? String(replyTo.text).slice(0, 100)
                  : replyTo.mediaType
                  ? `📎 ${replyTo.mediaType}`
                  : t("Message")}
              </span>
            </div>
            <button type="button" className="composer-reply-clear" onClick={() => onClearReply?.()} aria-label={t("Cancel reply")}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingAttach && (
          <motion.div
            className="composer-attach-preview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            {pendingAttach.previewUrl ? (
              <img src={pendingAttach.previewUrl} alt="" className="composer-attach-thumb" />
            ) : (
              <div className="composer-attach-file">
                <FileText size={18} />
              </div>
            )}
            <div className="composer-attach-meta">
              <strong>{pendingAttach.originalName || t("Attachment")}</strong>
              <span>{pendingAttach.mediaType}</span>
            </div>
            <button
              type="button"
              className="composer-reply-clear"
              onClick={() => {
                if (pendingAttach.previewUrl) URL.revokeObjectURL(pendingAttach.previewUrl);
                setPendingAttach(null);
              }}
              aria-label={t("Remove attachment")}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {slashMatches.length > 0 && (
          <motion.div
            className="slash-command-menu"
            role="listbox"
            aria-label={t("Slash commands")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.14 }}
          >
            <div className="slash-command-header">{t("Commands")}</div>
            {slashMatches.map((cmd, idx) => {
              const Icon = cmd.Icon;
              const active = idx === slashIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`slash-command-item ${active ? "active" : ""}`}
                  onMouseEnter={() => setSlashIndex(idx)}
                  onClick={() => applySlashCommand(cmd)}
                >
                  <span className="slash-command-ico"><Icon size={18} /></span>
                  <span className="slash-command-copy">
                    <strong>{cmd.command}</strong>
                    <span>{t(cmd.hint)}</span>
                  </span>
                  <span className="slash-command-label">{t(cmd.label)}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAttachmentMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="attachment-menu"
          >
            <button className="attachment-item" onClick={() => { imageInputRef.current?.click(); setShowAttachmentMenu(false); }}>
              <div className="attachment-icon"><Image size={24} /></div>
              <span className="attachment-label">{t("Upload Image")}</span>
            </button>
            <button className="attachment-item" onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }}>
              <div className="attachment-icon"><FileText size={24} /></div>
              <span className="attachment-label">{t("Upload File")}</span>
            </button>
            <button className="attachment-item" onClick={() => { setShowGiphy(true); setShowAttachmentMenu(false); }}>
              <div className="attachment-icon"><Gift size={24} /></div>
              <span className="attachment-label">{t("Send GIF")}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="emoji-picker"
          >
            <div className="emoji-picker-header">
              <span>{t("Emojis")}</span>
              <button className="emoji-picker-close" onClick={() => setShowEmojiPicker(false)}><X size={14} /></button>
            </div>
            <div className="emoji-picker-body">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.name} className="emoji-category">
                  <span className="emoji-category-name">{t(cat.name)}</span>
                  <div className="emoji-grid">
                    {cat.emojis.map((em) => (
                      <button key={em} className="emoji-btn" onClick={() => insertEmoji(em)}>{em}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" style={{ display: "none" }} onChange={uploadFile} />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.json" style={{ display: "none" }} onChange={uploadFile} />

      <div className="composer-left">
        <motion.button
          ref={attachBtnRef}
          className="composer-action-btn"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={t("Add Attachment")}
        >
          <Plus size={24} />
        </motion.button>
      </div>

      <div className="composer-input-wrapper">
        {uploading ? (
          <div className="recording-bar">
            <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            <span className="recording-label">{t("Uploading file…")}</span>
          </div>
        ) : isRecording ? (
          <div className="recording-bar recording-wave">
            <div className="recording-pulse" />
            <div className="composer-waveform" aria-hidden="true">
              {waveBars.map((v, i) => (
                <span key={i} style={{ height: `${Math.round(8 + v * 22)}px` }} />
              ))}
            </div>
            <span className="recording-label">{formatTime(recordingTime)}</span>
          </div>
        ) : uploadError ? (
          <div className="recording-bar" style={{ color: "var(--danger)" }}>
            <X size={14} />
            <span className="recording-label">{uploadError}</span>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => { setMessage(e.target.value); if (e.target.value) emitTypingStart(); else emitTypingStop(); }}
            onKeyDown={handleKeyDown}
            placeholder={dragOver ? t("Drop file to attach…") : t("Message…")}
            className="composer-input"
            rows={1}
            style={{ minHeight: "44px", maxHeight: "120px", resize: "none" }}
          />
        )}
      </div>

      <div className="composer-right">
        <motion.button className="composer-action-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title={t("Emoji")}>
          <Smile size={24} />
        </motion.button>

        {isRecording ? (
          <motion.button className="composer-action-btn recording" onClick={stopRecording} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title={t("Stop Recording")}>
            <StopCircle size={24} color="#f23f43" />
          </motion.button>
        ) : (
          <motion.button className="composer-action-btn" onClick={startRecording} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title={t("Voice Message")}>
            <Mic size={24} />
          </motion.button>
        )}

        <motion.button
          className={`composer-send-btn ${canSend ? "active" : ""}${sendFlash ? " is-flashing" : ""}`}
          onClick={handleSend}
          disabled={!canSend || disabled}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={t("Send Message")}
        >
          <span className="composer-send-flash" aria-hidden />
          <Send size={20} />
        </motion.button>
      </div>
    </div>
  );
}

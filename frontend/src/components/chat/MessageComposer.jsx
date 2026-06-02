import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Paperclip, Mic, Smile,
  Plus, Gift, Image, FileText, X, StopCircle, Loader2
} from "lucide-react";
import GiphyPicker from "./GiphyPicker";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"] },
  { name: "Gestures", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","💋","🩸"] },
  { name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿","🅿️","🈳","🈂️","🛂","🛃","🛄","🛅","🛗","🛹","🛺","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🚛","🚜","🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴","🚏","🛣️","🛤️","🛢️","⛽","🚨","🚥","🚦","🛑","🚧"] },
];

export default function MessageComposer({
  onSend,
  disabled = false,
  activeDmUser,
  activeGroup,
  onTypingDmStart,
  onTypingDmStop,
  onTypingGroupStart,
  onTypingGroupStop,
}) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Close popups on outside click */
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
  }, [activeDmUser, activeGroup, onTypingDmStop, onTypingGroupStop]);

  const emitTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (activeDmUser) onTypingDmStart?.(activeDmUser.id);
      else if (activeGroup) onTypingGroupStart?.(activeGroup.id);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(emitTypingStop, 3000);
  }, [activeDmUser, activeGroup, onTypingDmStart, onTypingGroupStart, emitTypingStop]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      emitTypingStop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDmUser?.id, activeGroup?.id]);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    clearTimeout(typingTimerRef.current);
    emitTypingStop();
    onSend?.(message.trim());
    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
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
      onSend?.({
        type: "media",
        mediaUrl: data.url,
        mediaType: data.mediaType,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(err.message);
      setTimeout(() => setUploadError(""), 4000);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  /* Voice recording with MediaRecorder */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", blob, `voice-${Date.now()}.webm`);
          const res = await fetch(`${API_BASE_URL}/api/media/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Voice upload failed");
          onSend?.({
            type: "media",
            mediaUrl: data.url,
            mediaType: "audio",
            originalName: data.originalName,
            size: data.size,
          });
        } catch (err) {
          setUploadError(err.message);
          setTimeout(() => setUploadError(""), 4000);
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error("Recording failed:", err);
      setUploadError("Microphone access denied.");
      setTimeout(() => setUploadError(""), 4000);
    }
  }, [onSend]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingTime(0);
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
    onSend?.({ type: "gif", mediaUrl: gif.url, mediaType: "gif", title: gif.title });
    setShowGiphy(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="message-composer">
      <GiphyPicker isOpen={showGiphy} onClose={() => setShowGiphy(false)} onSelectGif={handleGifSelect} />

      {/* Attachment Menu */}
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
              <span className="attachment-label">Upload Image</span>
            </button>
            <button className="attachment-item" onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }}>
              <div className="attachment-icon"><FileText size={24} /></div>
              <span className="attachment-label">Upload File</span>
            </button>
            <button className="attachment-item" onClick={() => { setShowGiphy(true); setShowAttachmentMenu(false); }}>
              <div className="attachment-icon"><Gift size={24} /></div>
              <span className="attachment-label">Send GIF</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="emoji-picker"
          >
            <div className="emoji-picker-header">
              <span>Emojis</span>
              <button className="emoji-picker-close" onClick={() => setShowEmojiPicker(false)}><X size={14} /></button>
            </div>
            <div className="emoji-picker-body">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.name} className="emoji-category">
                  <span className="emoji-category-name">{cat.name}</span>
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

      {/* Left Actions */}
      <div className="composer-left">
        <motion.button className="composer-action-btn" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Add Attachment">
          <Plus size={24} />
        </motion.button>
      </div>

      {/* Input Field */}
      <div className="composer-input-wrapper">
        {uploading ? (
          <div className="recording-bar">
            <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            <span className="recording-label">Uploading file…</span>
          </div>
        ) : isRecording ? (
          <div className="recording-bar">
            <div className="recording-pulse" />
            <span className="recording-label">Recording… {formatTime(recordingTime)}</span>
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
            placeholder="Message #general"
            className="composer-input"
            rows={1}
            style={{ minHeight: "44px", maxHeight: "120px", resize: "none" }}
          />
        )}
      </div>

      {/* Right Actions */}
      <div className="composer-right">
        <motion.button className="composer-action-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Emoji">
          <Smile size={24} />
        </motion.button>

        {isRecording ? (
          <motion.button className="composer-action-btn recording" onClick={stopRecording} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Stop Recording">
            <StopCircle size={24} color="#f23f43" />
          </motion.button>
        ) : (
          <motion.button className="composer-action-btn" onClick={startRecording} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Voice Message">
            <Mic size={24} />
          </motion.button>
        )}

        <motion.button className={`composer-send-btn ${message.trim() ? "active" : ""}`} onClick={handleSend} disabled={!message.trim()} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Send Message">
          <Send size={20} />
        </motion.button>
      </div>
    </div>
  );
}

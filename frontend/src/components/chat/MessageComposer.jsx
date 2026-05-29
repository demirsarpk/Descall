import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Paperclip, Mic, Smile,
  Plus, Gift, Image, FileText, X, StopCircle
} from "lucide-react";
import GiphyPicker from "./GiphyPicker";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"] },
  { name: "Gestures", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","💋","🩸"] },
  { name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿","🅿️","🈳","🈂️","🛂","🛃","🛄","🛅","🛗","🛹","🛺","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🚛","🚜","🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴","🚏","🛣️","🛤️","🛢️","⛽","🚨","🚥","🚦","🛑","🚧"] },
];

export default function MessageComposer({ onSend, disabled = false }) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

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

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSend?.(message.trim());
    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      if (data.url) {
        onSend?.(`[File: ${file.name}](${data.url})`);
      }
    } catch (err) { console.error("Upload failed:", err); }
    e.target.value = "";
  };

  /* Voice recording with MediaRecorder */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        onSend?.(`[Voice Message](${url})`);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) { console.error("Recording failed:", err); }
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
    onSend?.(`[GIF: ${gif.title}](${gif.url})`);
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
            <button className="attachment-item" onClick={() => { fileInputRef.current?.click(); setShowAttachmentMenu(false); }}>
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

      <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Left Actions */}
      <div className="composer-left">
        <motion.button className="composer-action-btn" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Add Attachment">
          <Plus size={24} />
        </motion.button>
      </div>

      {/* Input Field */}
      <div className="composer-input-wrapper">
        {isRecording ? (
          <div className="recording-bar">
            <div className="recording-pulse" />
            <span className="recording-label">Recording… {formatTime(recordingTime)}</span>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
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

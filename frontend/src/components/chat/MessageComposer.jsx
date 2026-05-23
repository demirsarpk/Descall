import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, Paperclip, Mic, Smile, 
  Plus, Gift, Image, FileText
} from "lucide-react";

/**
 * COMPLETELY REBUILT MESSAGE COMPOSER
 * Discord-style message input
 * No old layout remnants
 */
export default function MessageComposer() {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!message.trim()) return;
    // Send message logic here
    console.log("Sending message:", message);
    setMessage("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Handle file upload
      console.log("File selected:", file);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    // Start voice recording logic
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Stop and send voice message
  };

  return (
    <div className="message-composer">
      {/* Attachment Menu */}
      <AnimatePresence>
        {showAttachmentMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="attachment-menu"
          >
            <button 
              className="attachment-item"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="attachment-icon">
                <Image size={24} />
              </div>
              <span className="attachment-label">Upload Image</span>
            </button>
            <button className="attachment-item">
              <div className="attachment-icon">
                <FileText size={24} />
              </div>
              <span className="attachment-label">Upload File</span>
            </button>
            <button className="attachment-item">
              <div className="attachment-icon">
                <Gift size={24} />
              </div>
              <span className="attachment-label">Send GIF</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* Left Actions */}
      <div className="composer-left">
        <motion.button
          className="composer-action-btn"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Add Attachment"
        >
          <Plus size={24} />
        </motion.button>
      </div>

      {/* Input Field */}
      <div className="composer-input-wrapper">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Message #general"
          className="composer-input"
          rows={1}
          style={{
            minHeight: "44px",
            maxHeight: "120px",
            resize: "none"
          }}
        />
      </div>

      {/* Right Actions */}
      <div className="composer-right">
        <motion.button
          className="composer-action-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Emoji"
        >
          <Smile size={24} />
        </motion.button>

        {isRecording ? (
          <motion.button
            className="composer-action-btn recording"
            onClick={stopRecording}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Stop Recording"
          >
            <div className="recording-indicator" />
          </motion.button>
        ) : (
          <motion.button
            className="composer-action-btn"
            onClick={startRecording}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Voice Message"
          >
            <Mic size={24} />
          </motion.button>
        )}

        <motion.button
          className={`composer-send-btn ${message.trim() ? "active" : ""}`}
          onClick={handleSend}
          disabled={!message.trim()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Send Message"
        >
          <Send size={20} />
        </motion.button>
      </div>
    </div>
  );
}

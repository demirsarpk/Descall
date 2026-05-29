import { useState, useRef } from "react";
import { getToken } from "../../lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, X, Send, Image, AlertTriangle, 
  Star, CheckCircle, Flag, Loader2, Paperclip
} from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { API_BASE_URL } from "../../config/api";

const CATEGORIES = [
  { id: "bug", label: "Bug Report", icon: AlertTriangle, color: "#f23f43" },
  { id: "feature", label: "Feature Request", icon: Star, color: "#6678ff" },
  { id: "improvement", label: "Improvement", icon: CheckCircle, color: "#23a55a" },
  { id: "security", label: "Security Issue", icon: Flag, color: "#f0b232" },
  { id: "other", label: "Other", icon: MessageSquare, color: "#9da5b5" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#23a55a" },
  { id: "medium", label: "Medium", color: "#6678ff" },
  { id: "high", label: "High", color: "#f0b232" },
  { id: "critical", label: "Critical", color: "#f23f43" },
];

export default function UserFeedbackButton({ socket, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      alert("Maximum 5 attachments allowed");
      return;
    }
    setAttachments(prev => [...prev, ...files].slice(0, 5));
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const token = getToken();
    
    if (!message.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log("[FRONTEND] Entering try block");
      // Upload attachments first
      const attachmentUrls = [];
      // Use correct token key
      const token = localStorage.getItem("descall_token");
      console.log("[FRONTEND] Using token from 'descall_token':", !!token);
      
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        
        console.log("[Feedback] Uploading file:", file.name, "size:", file.size);
        
        const res = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
          headers: { 
            "Authorization": `Bearer ${token}`,
          },
        });
        
        console.log("[Feedback] Upload response status:", res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log("[Feedback] Upload response data:", data);
          
          // Handle different response formats
          const url = data.url || data.fileUrl || data.path || (data[0] && data[0].url);
          
          if (url) {
            console.log("[Feedback] Upload success, URL:", url);
            attachmentUrls.push(url);
          } else {
            console.error("[Feedback] Upload response missing URL:", data);
          }
        } else {
          const errorText = await res.text();
          console.error("[Feedback] Upload failed:", errorText);
          throw new Error(`Failed to upload ${file.name}: ${res.status}`);
        }
      }
      
      console.log("[Feedback] Submitting with attachments:", attachmentUrls);
      
      // Submit feedback
      const submitToken = localStorage.getItem("descall_token");
      console.log("[FRONTEND] Submit token:", !!submitToken);
      
      console.log("[FRONTEND] Using endpoint:", `${API_BASE_URL}/api/feedback/submit`);
      const res = await fetch(`${API_BASE_URL}/api/feedback/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${submitToken}`,
        },
        body: JSON.stringify({
          category,
          priority,
          message,
          attachments: attachmentUrls,
        }),
      });
      
      console.log("[Feedback] Response status:", res.status, res.statusText);
      console.log("[Feedback] Response headers:", Object.fromEntries(res.headers.entries()));
      
      const responseText = await res.text();
      console.log("[Feedback] Raw response length:", responseText.length);
      console.log("[Feedback] Raw response preview:", responseText.slice(0, 500));
      
      if (!responseText) {
        console.error("[Feedback] EMPTY RESPONSE from server!");
        throw new Error("Server returned empty response");
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("[Feedback] JSON parse FAILED");
        console.error("[Feedback] First 200 chars of response:", responseText.slice(0, 200));
        console.error("[Feedback] Full response:", responseText);
        throw new Error(`Server returned invalid JSON: ${parseErr.message}`);
      }
      
      if (res.ok) {
        console.log("[Feedback] Submit success:", data);
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
          setStep(1);
          setCategory("");
          setPriority("medium");
          setMessage("");
          setAttachments([]);
        }, 2000);
      } else {
        console.error("[Feedback] Submit failed:", data);
        throw new Error(data.error || data.details || `HTTP ${res.status}: ${responseText.slice(0, 100)}`);
      }
    } catch (err) {
      console.error("[Feedback] Failed to submit feedback:", err);
      alert("Failed to submit feedback: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <motion.button
        className="user-feedback-float-btn"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <MessageSquare size={24} />
        <span>Feedback</span>
      </motion.button>

      {/* Feedback Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="feedback-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && setIsOpen(false)}
          >
            <motion.div
              className="feedback-modal"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              {submitted ? (
                <div className="feedback-success">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <CheckCircle size={64} color="#23a55a" />
                  </motion.div>
                  <h3>Thank You!</h3>
                  <p>Your feedback has been submitted successfully.</p>
                </div>
              ) : (
                <>
                  <div className="feedback-header">
                    <h3>
                      {step === 1 && "Select Category"}
                      {step === 2 && "Describe the Issue"}
                      {step === 3 && "Set Priority"}
                    </h3>
                    <button 
                      onClick={() => !isSubmitting && setIsOpen(false)}
                      disabled={isSubmitting}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="feedback-progress">
                    {[1, 2, 3].map(s => (
                      <div key={s} className={`progress-dot ${s === step ? "active" : ""} ${s < step ? "completed" : ""}`} />
                    ))}
                  </div>

                  <div className="feedback-content">
                    {step === 1 && (
                      <div className="category-grid">
                        {CATEGORIES.map(cat => (
                          <motion.button
                            key={cat.id}
                            className={`category-btn ${category === cat.id ? "selected" : ""}`}
                            onClick={() => setCategory(cat.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{ borderColor: category === cat.id ? cat.color : undefined }}
                          >
                            <cat.icon size={24} color={cat.color} />
                            <span>{cat.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="feedback-form">
                        <textarea
                          placeholder="Please describe your feedback in detail..."
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          rows={5}
                          maxLength={2000}
                        />
                        <div className="char-count">{message.length}/2000</div>
                        
                        {/* Attachments */}
                        <div className="attachments-section">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            accept="image/*"
                            style={{ display: "none" }}
                          />
                          <RippleButton 
                            onClick={() => fileInputRef.current?.click()}
                            className="attach-btn"
                            disabled={attachments.length >= 5}
                          >
                            <Image size={16} />
                            Attach Screenshot {attachments.length > 0 && `(${attachments.length}/5)`}
                          </RippleButton>
                          
                          {attachments.length > 0 && (
                            <div className="attachment-preview-list">
                              {attachments.map((file, i) => (
                                <div key={i} className="attachment-chip">
                                  {file.name}
                                  <button onClick={() => removeAttachment(i)}>
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="priority-selection">
                        <p>How urgent is this issue?</p>
                        <div className="priority-grid">
                          {PRIORITIES.map(p => (
                            <motion.button
                              key={p.id}
                              className={`priority-btn ${priority === p.id ? "selected" : ""}`}
                              onClick={() => setPriority(p.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              style={{ 
                                borderColor: priority === p.id ? p.color : undefined,
                                background: priority === p.id ? p.color + "20" : undefined
                              }}
                            >
                              <div 
                                className="priority-indicator" 
                                style={{ background: p.color }}
                              />
                              <span>{p.label}</span>
                            </motion.button>
                          ))}
                        </div>
                        
                        <div className="feedback-summary">
                          <h4>Summary</h4>
                          <p><strong>Category:</strong> {CATEGORIES.find(c => c.id === category)?.label}</p>
                          <p><strong>Message:</strong> {message.slice(0, 100)}{message.length > 100 ? "..." : ""}</p>
                          <p><strong>Priority:</strong> {PRIORITIES.find(p => p.id === priority)?.label}</p>
                          {attachments.length > 0 && (
                            <p><strong>Attachments:</strong> {attachments.length} file(s)</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="feedback-footer">
                    {step > 1 && (
                      <RippleButton 
                        onClick={() => setStep(s => s - 1)} 
                        disabled={isSubmitting}
                        className="secondary"
                      >
                        Back
                      </RippleButton>
                    )}
                    
                    {step < 3 ? (
                      <RippleButton 
                        onClick={() => setStep(s => s + 1)}
                        disabled={step === 1 && !category}
                        className="primary"
                      >
                        Next
                      </RippleButton>
                    ) : (
                      <RippleButton 
                        onClick={handleSubmit}
                        disabled={!message.trim() || isSubmitting}
                        className="primary"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={16} className="spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Submit Feedback
                          </>
                        )}
                      </RippleButton>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

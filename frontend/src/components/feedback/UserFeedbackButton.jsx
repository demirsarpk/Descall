import { useState, useRef } from "react";
import { getToken } from "../../lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, X, Send, Image, AlertTriangle,
  Star, CheckCircle, Flag, Loader2, Paperclip, AlertCircle
} from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { API_BASE_URL } from "../../config/api";
import { useT } from "../../context/LocaleContext";

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
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      setError(t("Maximum 5 attachments allowed"));
      setTimeout(() => setError(""), 3000);
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
      // Upload attachments first
      const attachmentUrls = [];
      
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
          headers: { 
            "Authorization": `Bearer ${token}`,
          },
        });
        
        if (res.ok) {
          const data = await res.json();
          
          // Handle different response formats
          const url = data.url || data.fileUrl || data.path || (data[0] && data[0].url);
          
          if (url) {
            attachmentUrls.push(url);
          } else {
          }
        } else {
          const errorText = await res.text();
          throw new Error(t("Failed to upload {name}: {status}", { name: file.name, status: res.status }));
        }
      }
      
      // Submit feedback
      const submitToken = localStorage.getItem("descall_token");
      
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
      
      const responseText = await res.text();
      
      if (!responseText) {
        throw new Error(t("Server returned empty response"));
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(t("Server returned invalid JSON: {message}", { message: parseErr.message }));
      }
      
      if (res.ok) {
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
        throw new Error(data.error || data.details || t("HTTP {status}: {detail}", { status: res.status, detail: responseText.slice(0, 100) }));
      }
    } catch (err) {
      setError(t("Failed to submit feedback: {message}", { message: err.message }));
      setTimeout(() => setError(""), 5000);
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
        <span>{t("Feedback")}</span>
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
              onClick={(e) => e.stopPropagation()}
            >
              {/* Error Display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="feedback-error-banner"
                  >
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {submitted ? (
                <div className="feedback-success">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <CheckCircle size={64} color="#23a55a" />
                  </motion.div>
                  <h3>{t("Thank You!")}</h3>
                  <p>{t("Your feedback has been submitted successfully.")}</p>
                </div>
              ) : (
                <>
                  <div className="feedback-header">
                    <h3>
                      {step === 1 && t("Select Category")}
                      {step === 2 && t("Describe the Issue")}
                      {step === 3 && t("Set Priority")}
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
                            <span>{t(cat.label)}</span>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="feedback-form">
                        <textarea
                          placeholder={t("Please describe your feedback in detail...")}
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
                            {t("Attach screenshots ({count}/5)", { count: attachments.length })}
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
                        <p>{t("How urgent is this issue?")}</p>
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
                              <span>{t(p.label)}</span>
                            </motion.button>
                          ))}
                        </div>
                        
                        <div className="feedback-summary">
                          <h4>{t("Summary")}</h4>
                          <p><strong>{t("Category:")}</strong> {t(CATEGORIES.find(c => c.id === category)?.label || "")}</p>
                          <p><strong>{t("Message:")}</strong> {message.slice(0, 100)}{message.length > 100 ? "..." : ""}</p>
                          <p><strong>{t("Priority:")}</strong> {t(PRIORITIES.find(p => p.id === priority)?.label || "")}</p>
                          {attachments.length > 0 && (
                            <p><strong>{t("Attachments:")}</strong> {t("{count} file(s)", { count: attachments.length })}</p>
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
                        {t("Back")}
                      </RippleButton>
                    )}
                    
                    {step < 3 ? (
                      <RippleButton 
                        onClick={() => setStep(s => s + 1)}
                        disabled={step === 1 && !category}
                        className="primary"
                      >
                        {t("Next")}
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
                            {t("Submitting...")}
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            {t("Submit Feedback")}
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

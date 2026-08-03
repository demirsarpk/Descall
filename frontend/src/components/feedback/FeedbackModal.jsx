import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, X, Send, Image, AlertTriangle, 
  Star, CheckCircle, Flag, Loader2, ChevronRight, ChevronLeft
} from "lucide-react";
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

export default function FeedbackModal({ isOpen, onClose }) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setStep(1);
    setCategory("");
    setPriority("medium");
    setMessage("");
    setAttachments([]);
    setIsSubmitted(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      setError(t("Maximum 5 attachments allowed"));
      return;
    }
    setAttachments(prev => [...prev, ...files].slice(0, 5));
    setError(null);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError(t("Please enter a message"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("descall_token");
      if (!token) {
        throw new Error(t("Please login to submit feedback"));
      }

      // Upload attachments first
      const attachmentUrls = [];
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            attachmentUrls.push(uploadData.url);
          }
        }
      }

      // Submit feedback
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          priority,
          message: message.trim(),
          attachments: attachmentUrls,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || t("Failed to submit feedback"));
      }

      setIsSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.message || t("Failed to submit feedback"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a1d24] border border-[#2a2e38] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2a2e38]">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare size={20} className="text-[#6678ff]" />
              {t("Send Feedback")}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-[#2a2e38] transition-colors text-[#9da5b5] hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {isSubmitted ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-[#23a55a]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-[#23a55a]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{t("Thank You!")}</h3>
                <p className="text-[#9da5b5]">{t("Your feedback has been submitted successfully.")}</p>
              </motion.div>
            ) : (
              <>
                {/* Step 1: Category */}
                {step === 1 && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                  >
                    <p className="text-[#9da5b5] mb-4 text-sm">{t("Select a category:")}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => { setCategory(cat.id); setStep(2); }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            category === cat.id
                              ? "border-[#6678ff] bg-[#6678ff]/10"
                              : "border-[#2a2e38] hover:border-[#6678ff]/50 hover:bg-[#2a2e38]/50"
                          }`}
                        >
                          <cat.icon size={20} style={{ color: cat.color }} />
                          <span className="text-white text-sm font-medium">{t(cat.label)}</span>
                          <ChevronRight size={16} className="ml-auto text-[#9da5b5]" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Priority */}
                {step === 2 && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                  >
                    <p className="text-[#9da5b5] mb-4 text-sm">{t("Select priority:")}</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {PRIORITIES.map((prio) => (
                        <button
                          key={prio.id}
                          onClick={() => setPriority(prio.id)}
                          className={`p-3 rounded-xl border transition-all ${
                            priority === prio.id
                              ? "border-[#6678ff] bg-[#6678ff]/10"
                              : "border-[#2a2e38] hover:border-[#6678ff]/50 hover:bg-[#2a2e38]/50"
                          }`}
                        >
                          <span className="text-white text-sm font-medium">{t(prio.label)}</span>
                          <div
                            className="w-2 h-2 rounded-full mt-2 mx-auto"
                            style={{ backgroundColor: prio.color }}
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setStep(3)}
                      className="w-full p-3 bg-[#6678ff] hover:bg-[#7a89ff] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {t("Continue")}
                      <ChevronRight size={18} />
                    </button>
                    <button
                      onClick={() => setStep(1)}
                      className="w-full mt-2 p-3 text-[#9da5b5] hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={18} />
                      {t("Back")}
                    </button>
                  </motion.div>
                )}

                {/* Step 3: Message */}
                {step === 3 && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                  >
                    <div className="mb-3">
                      <span className="text-xs text-[#9da5b5] uppercase tracking-wider">{t("Category")}</span>
                      <p className="text-white text-sm font-medium">
                        {t(CATEGORIES.find(c => c.id === category)?.label || "Other")}
                      </p>
                    </div>
                    <div className="mb-4">
                      <span className="text-xs text-[#9da5b5] uppercase tracking-wider">{t("Priority")}</span>
                      <p className="text-white text-sm font-medium">
                        {t(PRIORITIES.find((p) => p.id === priority)?.label || "Medium")}
                      </p>
                    </div>

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("Describe your feedback in detail...")}
                      className="w-full h-32 p-3 bg-[#0f1115] border border-[#2a2e38] rounded-xl text-white text-sm placeholder-[#9da5b5] focus:outline-none focus:border-[#6678ff] resize-none mb-3"
                    />

                    {/* Attachments */}
                    <div className="mb-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 text-[#9da5b5] hover:text-white text-sm transition-colors"
                      >
                        <Image size={16} />
                        {t("Attach screenshots ({count}/5)", { count: attachments.length })}
                      </button>
                      {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {attachments.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1 px-2 py-1 bg-[#2a2e38] rounded-lg text-xs text-white"
                            >
                              <span className="truncate max-w-[100px]">{file.name}</span>
                              <button
                                onClick={() => removeAttachment(index)}
                                className="text-[#f23f43] hover:text-white"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="p-3 bg-[#f23f43]/10 border border-[#f23f43]/30 rounded-xl text-[#f23f43] text-sm mb-3">
                        {error}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !message.trim()}
                      className="w-full p-3 bg-[#6678ff] hover:bg-[#7a89ff] disabled:bg-[#6678ff]/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          {t("Sending...")}
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          {t("Submit Feedback")}
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setStep(2)}
                      className="w-full mt-2 p-3 text-[#9da5b5] hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={18} />
                      {t("Back")}
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* Progress dots */}
          {!isSubmitted && (
            <div className="flex justify-center gap-2 pb-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === step ? "bg-[#6678ff]" : "bg-[#2a2e38]"
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

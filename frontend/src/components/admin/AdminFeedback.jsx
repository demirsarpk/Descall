import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, X, Image, Paperclip, Send, CheckCircle, AlertTriangle,
  Clock, User, MessageSquare, Filter, Search, Download, Eye,
  Reply, Trash2, Star, Flag, Check, ChevronDown, MoreHorizontal,
  RefreshCw, Archive, Mail, MailOpen, Paperclip as PaperclipIcon,
  Maximize2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertCircle
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import RippleButton from "../ui/RippleButton";
import { Avatar } from "../ui/Avatar";

const CATEGORIES = [
  { id: "bug", label: "Bug Report", color: "#f23f43", icon: AlertTriangle },
  { id: "feature", label: "Feature / Suggestion", color: "#6678ff", icon: Star },
  { id: "improvement", label: "Improvement / Praise", color: "#23a55a", icon: CheckCircle },
  { id: "security", label: "Security Issue", color: "#f0b232", icon: Flag },
  { id: "general", label: "General", color: "#9da5b5", icon: MessageSquare },
  { id: "other", label: "Other", color: "#9da5b5", icon: MessageSquare },
];

const PRIORITIES = [
  { id: "critical", label: "Critical", color: "#f23f43" },
  { id: "high", label: "High", color: "#f0b232" },
  { id: "medium", label: "Medium", color: "#6678ff" },
  { id: "low", label: "Low", color: "#23a55a" },
];

const STATUSES = [
  { id: "new", label: "New", color: "#f23f43" },
  { id: "in_progress", label: "In Progress", color: "#f0b232" },
  { id: "resolved", label: "Resolved", color: "#23a55a" },
  { id: "closed", label: "Closed", color: "#9da5b5" },
];

export default function AdminFeedback({ socket }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [error, setError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState({ category: "all", priority: "all", status: "all" });
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [imageModal, setImageModal] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [newFeedbackIds, setNewFeedbackIds] = useState(new Set());
  const fileInputRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const [replyAttachments, setReplyAttachments] = useState([]);

  const loadFeedbacks = useCallback(async () => {
    try {
      setLoading(true);
      console.log("[AdminFeedback] Loading feedbacks...");
      
      const params = new URLSearchParams();
      if (filter.category !== "all") params.append("category", filter.category);
      if (filter.priority !== "all") params.append("priority", filter.priority);
      if (filter.status !== "all") params.append("status", filter.status);
      if (searchQ) params.append("q", searchQ);
      params.append("sort", sortBy);
      
      console.log("[AdminFeedback] Fetching from /admin/feedback?" + params.toString());
      
      const d = await adminFetch(`/feedback?${params}`);
      console.log("[AdminFeedback] Response:", d);
      
      if (!d || typeof d !== 'object') {
        throw new Error("Invalid response from server");
      }
      
      setFeedbacks(d.feedbacks || []);
      setStats(d.stats || null);
      
      // Track new feedbacks
      const newIds = new Set();
      d.feedbacks?.forEach(f => {
        if (f.status === "new" && !f.viewed) newIds.add(f.id);
      });
      setNewFeedbackIds(newIds);
      
      console.log("[AdminFeedback] Loaded", d.feedbacks?.length || 0, "feedbacks");
    } catch (e) {
      console.error("[AdminFeedback] Failed to load feedbacks:", e);
      setError("Failed to load feedbacks: " + e.message);
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQ, sortBy]);

  const loadStats = useCallback(async () => {
    try {
      console.log("[AdminFeedback] Loading stats...");
      const d = await adminFetch("/feedback/stats");
      console.log("[AdminFeedback] Stats response:", d);
      setStats(d);
    } catch (e) {
      console.error("[AdminFeedback] Failed to load stats:", e);
    }
  }, []);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  useEffect(() => {
    if (!socket) return;
    
    const onNewFeedback = (data) => {
      setFeedbacks(prev => [data, ...prev]);
      setNewFeedbackIds(prev => new Set([...prev, data.id]));
      setStats(prev => prev ? {
        ...prev,
        total: prev.total + 1,
        byStatus: { ...prev.byStatus, new: (prev.byStatus?.new || 0) + 1 }
      } : null);
    };
    
    socket.on("feedback:new", onNewFeedback);
    return () => socket.off("feedback:new", onNewFeedback);
  }, [socket]);

  const updateFeedback = async (id, updates) => {
    try {
      await adminFetch(`/feedback/${id}`, { method: "PATCH", body: updates });
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(prev => ({ ...prev, ...updates }));
      }
    } catch (e) {
      console.error("Failed to update feedback:", e);
    }
  };

  const deleteFeedback = async (id) => {
    if (!confirm("Delete this feedback permanently?")) return;
    try {
      await adminFetch(`/feedback/${id}`, { method: "DELETE" });
      setFeedbacks(prev => prev.filter(f => f.id !== id));
      if (selectedFeedback?.id === id) setSelectedFeedback(null);
    } catch (e) {
      console.error("Failed to delete feedback:", e);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() && replyAttachments.length === 0) return;
    if (!selectedFeedback) return;
    
    try {
      const formData = new FormData();
      formData.append("text", replyText);
      replyAttachments.forEach(file => formData.append("attachments", file));
      
      await adminFetch(`/feedback/${selectedFeedback.id}/reply`, {
        method: "POST",
        body: formData,
        headers: {},
      });
      
      setReplyText("");
      setReplyAttachments([]);
      loadFeedbacks();
    } catch (e) {
      console.error("Failed to send reply:", e);
    }
  };

  const markAsViewed = async (id) => {
    if (!newFeedbackIds.has(id)) return;
    try {
      await adminFetch(`/feedback/${id}/view`, { method: "POST" });
      setNewFeedbackIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.error("Failed to mark as viewed:", e);
    }
  };

  const handleSelectFeedback = (f) => {
    setSelectedFeedback(f);
    markAsViewed(f.id);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setReplyAttachments(prev => [...prev, ...files].slice(0, 5));
  };

  const openImageModal = (images, index) => {
    setImageModal(images);
    setCurrentImageIndex(index);
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    if (searchQ && !f.message?.toLowerCase().includes(searchQ.toLowerCase()) && 
        !f.user?.username?.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="admin-feedback-container">
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="admin-feedback-error-banner"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <motion.div className="admin-stat-card" whileHover={{ scale: 1.02 }}>
          <div className="stat-icon" style={{ background: "#6678ff20" }}>
            <Bell size={24} color="#6678ff" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats?.total || 0}</span>
            <span className="stat-label">Total Feedback</span>
          </div>
        </motion.div>
        
        <motion.div className="admin-stat-card" whileHover={{ scale: 1.02 }}>
          <div className="stat-icon" style={{ background: "#f23f4320" }}>
            <AlertTriangle size={24} color="#f23f43" />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: "#f23f43" }}>
              {stats?.byStatus?.new || 0}
            </span>
            <span className="stat-label">New</span>
          </div>
        </motion.div>
        
        <motion.div className="admin-stat-card" whileHover={{ scale: 1.02 }}>
          <div className="stat-icon" style={{ background: "#f0b23220" }}>
            <Clock size={24} color="#f0b232" />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: "#f0b232" }}>
              {stats?.byStatus?.in_progress || 0}
            </span>
            <span className="stat-label">In Progress</span>
          </div>
        </motion.div>
        
        <motion.div className="admin-stat-card" whileHover={{ scale: 1.02 }}>
          <div className="stat-icon" style={{ background: "#23a55a20" }}>
            <CheckCircle size={24} color="#23a55a" />
          </div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: "#23a55a" }}>
              {stats?.byStatus?.resolved || 0}
            </span>
            <span className="stat-label">Resolved</span>
          </div>
        </motion.div>
      </div>

      {/* Filters & Search */}
      <div className="admin-feedback-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search feedback..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          
          <select value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        
        <RippleButton onClick={loadFeedbacks} className="refresh-btn">
          <RefreshCw size={18} />
        </RippleButton>
      </div>

      {/* Feedback List */}
      <div className="admin-feedback-content">
        <div className="feedback-list">
          {loading ? (
            <div className="loading-state">Loading feedback...</div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="empty-state">No feedback found</div>
          ) : (
            filteredFeedbacks.map(f => {
              const category = CATEGORIES.find(c => c.id === f.category) || CATEGORIES[4];
              const priority = PRIORITIES.find(p => p.id === f.priority) || PRIORITIES[2];
              const status = STATUSES.find(s => s.id === f.status) || STATUSES[0];
              const isNew = newFeedbackIds.has(f.id);
              
              return (
                <motion.div
                  key={f.id}
                  className={`feedback-item ${selectedFeedback?.id === f.id ? "selected" : ""} ${isNew ? "new" : ""}`}
                  onClick={() => handleSelectFeedback(f)}
                  whileHover={{ x: 4 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="feedback-header">
                    <div className="feedback-badges">
                      <span className="badge" style={{ background: category.color + "30", color: category.color }}>
                        <category.icon size={12} />
                        {category.label}
                      </span>
                      <span className="badge" style={{ background: priority.color + "30", color: priority.color }}>
                        {priority.label}
                      </span>
                      <span className="badge" style={{ background: status.color + "30", color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                    {isNew && <span className="new-indicator">NEW</span>}
                  </div>
                  
                  <div className="feedback-user">
                    <div className="user-avatar">
                      <Avatar user={f.user} name={f.user?.username || "?"} size={28} />
                    </div>
                    <span className="username">{f.user?.username || "Unknown"}</span>
                    <span className="timestamp">{new Date(f.created_at).toLocaleString()}</span>
                  </div>
                  
                  <p className="feedback-preview">{f.message?.slice(0, 120)}{f.message?.length > 120 ? "..." : ""}</p>
                  
                  {f.attachments?.length > 0 && (
                    <div className="attachment-preview">
                      <PaperclipIcon size={14} />
                      {f.attachments.length} attachment{f.attachments.length > 1 ? "s" : ""}
                    </div>
                  )}
                  
                  {f.replies?.length > 0 && (
                    <div className="reply-count">
                      <MessageSquare size={14} />
                      {f.replies.length} reply{f.replies.length > 1 ? "ies" : ""}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        <div className="feedback-detail">
          {selectedFeedback ? (
            <>
              <div className="detail-header">
                <div className="detail-badges">
                  {CATEGORIES.find(c => c.id === selectedFeedback.category) && (
                    <span className="badge category">
                      {CATEGORIES.find(c => c.id === selectedFeedback.category).label}
                    </span>
                  )}
                  <select
                    value={selectedFeedback.priority}
                    onChange={e => updateFeedback(selectedFeedback.id, { priority: e.target.value })}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    value={selectedFeedback.status}
                    onChange={e => updateFeedback(selectedFeedback.id, { status: e.target.value })}
                  >
                    {STATUSES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="detail-actions">
                  <RippleButton onClick={() => deleteFeedback(selectedFeedback.id)} className="danger">
                    <Trash2 size={16} />
                  </RippleButton>
                  <RippleButton onClick={() => setSelectedFeedback(null)}>
                    <X size={16} />
                  </RippleButton>
                </div>
              </div>

              <div className="detail-user-info">
                <div className="user-avatar large">
                  <Avatar user={selectedFeedback.user} name={selectedFeedback.user?.username || "?"} size={48} />
                </div>
                <div className="user-details">
                  <span className="username">{selectedFeedback.user?.username || "Unknown"}</span>
                  <span className="user-id">ID: {selectedFeedback.user?.id}</span>
                  <span className="timestamp">
                    {new Date(selectedFeedback.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="detail-message">
                <p>{selectedFeedback.message}</p>
              </div>

              {selectedFeedback.attachments?.length > 0 && (
                <div className="detail-attachments">
                  <h4>Attachments</h4>
                  <div className="attachment-grid">
                    {selectedFeedback.attachments.map((url, i) => (
                      <motion.div
                        key={i}
                        className="attachment-item"
                        onClick={() => openImageModal(selectedFeedback.attachments, i)}
                        whileHover={{ scale: 1.05 }}
                      >
                        {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={url} alt={`Attachment ${i + 1}`} />
                        ) : (
                          <div className="file-icon">
                            <PaperclipIcon size={32} />
                            <span>File {i + 1}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Replies */}
              {selectedFeedback.replies?.length > 0 && (
                <div className="detail-replies">
                  <h4>Replies</h4>
                  {selectedFeedback.replies.map((reply, i) => (
                    <div key={i} className={`reply-item ${reply.isAdmin ? "admin" : ""}`}>
                      <div className="reply-avatar">
                        <Avatar user={reply.user} name={reply.user?.username || "?"} size={28} />
                      </div>
                      <div className="reply-content">
                        <div className="reply-header">
                          <span className="username">{reply.user?.username || "Unknown"}</span>
                          {reply.isAdmin && <span className="admin-badge">ADMIN</span>}
                          <span className="timestamp">{new Date(reply.created_at).toLocaleString()}</span>
                        </div>
                        <p>{reply.text}</p>
                        {reply.attachments?.length > 0 && (
                          <div className="reply-attachments">
                            {reply.attachments.map((url, j) => (
                              <img key={j} src={url} alt="" onClick={() => openImageModal(reply.attachments, j)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              <div className="reply-input-area">
                <textarea
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={3}
                />
                <div className="reply-toolbar">
                  <div className="reply-attachments-preview">
                    {replyAttachments.map((file, i) => (
                      <div key={i} className="attachment-chip">
                        <span>{file.name}</span>
                        <button onClick={() => setReplyAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="reply-actions">
                    <input
                      type="file"
                      ref={replyFileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      accept="image/*"
                      style={{ display: "none" }}
                    />
                    <RippleButton 
                      onClick={() => replyFileInputRef.current?.click()}
                      className="attach-btn"
                      disabled={replyAttachments.length >= 5}
                    >
                      <Paperclip size={16} />
                      Attach
                    </RippleButton>
                    <RippleButton onClick={sendReply} className="primary" disabled={!replyText.trim() && replyAttachments.length === 0}>
                      <Send size={16} />
                      Reply
                    </RippleButton>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-detail">
              <MessageSquare size={48} opacity={0.3} />
              <p>Select a feedback to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {imageModal && (
          <motion.div
            className="image-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setImageModal(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setImageModal(null)}>
                <X size={24} />
              </button>
              
              <div className="image-container">
                <img src={imageModal[currentImageIndex]} alt="" />
              </div>
              
              {imageModal.length > 1 && (
                <>
                  <button 
                    className="nav-btn prev"
                    onClick={() => setCurrentImageIndex(i => (i - 1 + imageModal.length) % imageModal.length)}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    className="nav-btn next"
                    onClick={() => setCurrentImageIndex(i => (i + 1) % imageModal.length)}
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div className="image-counter">
                    {currentImageIndex + 1} / {imageModal.length}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

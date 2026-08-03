import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, MessageSquare, Check, UserMinus } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { API_BASE_URL } from "../../config/api";
import { getToken } from "../../lib/storage";
import { getPresenceStatus } from "../../lib/presence";

function formatMemberSince(iso) {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

function generateBannerGradient(username) {
  const hues = [220, 260, 280, 200, 340, 180, 30];
  let h = 0;
  for (let i = 0; i < (username || "").length; i++) {
    h = (Math.imul(31, h) + username.charCodeAt(i)) | 0;
  }
  const hue = hues[Math.abs(h) % hues.length];
  return `linear-gradient(135deg, hsl(${hue}, 65%, 28%) 0%, hsl(${(hue + 40) % 360}, 55%, 18%) 100%)`;
}

const STATUS_LABEL = { online: "Online", offline: "Offline", idle: "Idle", dnd: "Do Not Disturb" };
const STATUS_COLOR = { online: "#23a55a", offline: "#80848e", idle: "#f0b232", dnd: "#f23f43" };

export default function UserProfileModal({
  open,
  onClose,
  userId,
  username,
  avatarUrl,
  me,
  friends = [],
  onlineUsers = [],
  onStartDm,
  onFriendSent,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [friendState, setFriendState] = useState("none"); // "none" | "friend" | "sent"
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [mutualFriends, setMutualFriends] = useState([]);

  const isSelf = me?.id === userId;
  const status = getPresenceStatus(onlineUsers, userId);

  const fetchProfile = useCallback(async () => {
    if (!userId || !open) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setProfile(data.user);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [userId, open]);

  const fetchMutualFriends = useCallback(async () => {
    if (!username || isSelf) return;
    try {
      const res = await fetch(`${API_BASE_URL}/friends/mutual/${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMutualFriends(data.mutualFriends || []);
    } catch {
      setMutualFriends([]);
    }
  }, [username, isSelf]);

  useEffect(() => {
    if (!open) return;
    fetchProfile();
    fetchMutualFriends();

    const alreadyFriend = friends.some((f) => f.id === userId);
    setFriendState(alreadyFriend ? "friend" : "none");
    setFriendError("");
    setMutualFriends([]);
  }, [open, userId, friends, fetchProfile, fetchMutualFriends]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleAddFriend = async () => {
    if (friendLoading || friendState !== "none") return;
    setFriendLoading(true);
    setFriendError("");
    try {
      const res = await fetch(`${API_BASE_URL}/friends/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ username: profile?.username || username }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to send request");
      setFriendState("sent");
      onFriendSent?.();
    } catch (err) {
      setFriendError(err.message);
      setTimeout(() => setFriendError(""), 3000);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (friendLoading || friendState !== "friend") return;
    setFriendLoading(true);
    setFriendError("");
    try {
      const res = await fetch(`${API_BASE_URL}/friends/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ friendId: userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to remove friend");
      setFriendState("none");
      onFriendSent?.();
    } catch (err) {
      setFriendError(err.message);
      setTimeout(() => setFriendError(""), 3000);
    } finally {
      setFriendLoading(false);
    }
  };

  const displayUsername = profile?.username || username || "Unknown";
  const displayName =
    profile?.displayName || profile?.display_name || displayUsername;
  const displayAvatar = profile?.avatarUrl ?? avatarUrl ?? null;
  const bannerGradient = generateBannerGradient(displayUsername);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 360 }}
            style={{
              width: 300,
              background: "var(--surface-1)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
              border: "1px solid var(--border-3)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 10,
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: "rgba(0,0,0,0.35)",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.6)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.35)")}
            >
              <X size={14} />
            </button>

            {/* Banner */}
            <div
              style={{
                height: 80,
                background: bannerGradient,
                flexShrink: 0,
              }}
            />

            {/* Avatar overlapping banner */}
            <div style={{ position: "relative", padding: "0 16px" }}>
              <div
                style={{
                  position: "absolute",
                  top: -36,
                  left: 16,
                  padding: 3,
                  background: "var(--surface-1)",
                  borderRadius: "50%",
                  display: "inline-flex",
                }}
              >
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Avatar name={displayName} size={72} user={profile || { avatarUrl: displayAvatar, username: displayUsername, displayName }} />
                  <div style={{ position: "absolute", bottom: 3, right: 3 }}>
                    <StatusBadge status={status} size={14} />
                  </div>
                </div>
              </div>

              {/* Spacer for avatar overlap */}
              <div style={{ height: 44 }} />

              {/* Display name + @username + status */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-0)", lineHeight: 1.2 }}>
                  {displayName}
                </div>
                {displayName !== displayUsername && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    @{displayUsername}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 12,
                    color: STATUS_COLOR[status] || STATUS_COLOR.offline,
                    fontWeight: 500,
                    marginTop: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: STATUS_COLOR[status] || STATUS_COLOR.offline,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {STATUS_LABEL[status] || STATUS_LABEL.offline}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "var(--border-2)", margin: "0 -16px 12px" }} />

              {/* Member since */}
              {loading ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Loading…</div>
              ) : profile?.createdAt ? (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      color: "var(--text-muted)",
                      marginBottom: 3,
                    }}
                  >
                    Member Since
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>
                    {formatMemberSince(profile.createdAt)}
                  </div>
                </div>
              ) : null}

              {/* Mutual friends */}
              {!isSelf && mutualFriends.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      color: "var(--text-muted)",
                      marginBottom: 6,
                    }}
                  >
                    Mutual Friends
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex" }}>
                      {mutualFriends.slice(0, 4).map((f, i) => (
                        <div
                          key={f.id}
                          title={f.username}
                          style={{
                            marginLeft: i === 0 ? 0 : -8,
                            zIndex: 4 - i,
                            position: "relative",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            border: "2px solid var(--surface-1)",
                            overflow: "hidden",
                            background: "var(--surface-3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--text-1)",
                          }}
                        >
                          <Avatar name={f.username} size={24} user={f} />
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>
                      {mutualFriends.length === 1
                        ? `${mutualFriends[0].username}`
                        : `${mutualFriends[0].username} and ${mutualFriends.length - 1} other${mutualFriends.length - 1 > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Action buttons (skip for self) */}
              {!isSelf && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {/* Add / Remove Friend button */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={friendState === "friend" ? handleRemoveFriend : handleAddFriend}
                    disabled={friendLoading || friendState === "sent"}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "none",
                      cursor: (friendLoading || friendState === "sent") ? "default" : "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      transition: "all 0.15s",
                      background:
                        friendState === "friend"
                          ? "var(--surface-3)"
                          : friendState === "sent"
                          ? "rgba(35,165,90,0.15)"
                          : "var(--primary)",
                      color:
                        friendState === "friend"
                          ? "var(--text-1)"
                          : friendState === "sent"
                          ? "#23a55a"
                          : "white",
                    }}
                    onMouseEnter={(e) => {
                      if (friendState === "friend") {
                        e.currentTarget.style.background = "rgba(242,63,67,0.15)";
                        e.currentTarget.style.color = "var(--danger)";
                      } else if (friendState === "none") {
                        e.currentTarget.style.filter = "brightness(1.12)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "";
                      if (friendState === "friend") {
                        e.currentTarget.style.background = "var(--surface-3)";
                        e.currentTarget.style.color = "var(--text-1)";
                      }
                    }}
                  >
                    {friendState === "friend" ? (
                      <><UserMinus size={15} /> {friendLoading ? "Removing…" : "Friends"}</>
                    ) : friendState === "sent" ? (
                      <><Check size={15} /> Sent</>
                    ) : (
                      <><UserPlus size={15} /> {friendLoading ? "Sending…" : "Add Friend"}</>
                    )}
                  </motion.button>

                  {/* Message button */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { onStartDm?.({ id: userId, username: displayUsername, avatarUrl: displayAvatar }); onClose(); }}
                    style={{
                      width: 38,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "9px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      background: "var(--surface-3)",
                      color: "var(--text-1)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text-0)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-1)"; }}
                    title="Send Message"
                  >
                    <MessageSquare size={16} />
                  </motion.button>
                </div>
              )}

              {/* Friend error */}
              {friendError && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "7px 10px",
                    borderRadius: 6,
                    background: "var(--danger-soft)",
                    color: "var(--danger)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {friendError}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

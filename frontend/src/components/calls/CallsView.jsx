import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { fetchCallHistory } from "../../api/calls";
import {
  loadCachedCalls,
  saveCachedCalls,
  upsertCachedCall,
  formatCallDuration,
  formatCallWhen,
} from "../../lib/callHistoryCache";
import { resolveDisplayName } from "../../lib/userProfile";
import { getPresenceStatus } from "../../lib/presence";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "missed", label: "Missed" },
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
];

function statusMeta(call) {
  if (call.status === "missed") {
    return { label: "Missed", Icon: PhoneMissed, tone: "danger" };
  }
  if (call.status === "declined") {
    return { label: "Declined", Icon: PhoneOff, tone: "danger" };
  }
  if (call.status === "cancelled") {
    return { label: "Cancelled", Icon: PhoneOff, tone: "muted" };
  }
  if (call.direction === "incoming") {
    return { label: "Incoming", Icon: PhoneIncoming, tone: "ok" };
  }
  return { label: "Outgoing", Icon: PhoneOutgoing, tone: "ok" };
}

function normalizeServerCall(raw, meId) {
  if (!raw) return null;
  if (raw.peer) return raw;
  // Socket payload from finalizeCall may lack peer/direction
  const iAmCaller = raw.callerId === meId;
  return {
    id: raw.id,
    direction: iAmCaller ? "outgoing" : "incoming",
    callType: raw.callType || "voice",
    status: raw.status,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    durationSeconds: raw.durationSeconds,
    createdAt: raw.createdAt || raw.endedAt,
    peer: {
      id: iAmCaller ? raw.calleeId : raw.callerId,
      username: "Unknown",
      displayName: null,
      avatarUrl: null,
    },
  };
}

export default function CallsView({
  me,
  friends = [],
  onlineUsers = [],
  socket,
  onStartCall,
  onOpenChat,
  compact = false,
}) {
  const meId = me?.id;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [calls, setCalls] = useState(() => loadCachedCalls(meId));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ soft = false } = {}) => {
    if (!meId) return;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetchCallHistory({ limit: 60 });
      const list = Array.isArray(res?.calls) ? res.calls : [];
      setCalls(list);
      saveCachedCalls(meId, list);
    } catch (err) {
      setError(err?.message || "Could not load call history");
      setCalls(loadCachedCalls(meId));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [meId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !meId) return;
    const onUpdated = ({ call } = {}) => {
      const normalized = normalizeServerCall(call, meId);
      if (!normalized?.id) {
        refresh({ soft: true });
        return;
      }
      // Enrich peer from friends if username unknown
      if (!normalized.peer?.username || normalized.peer.username === "Unknown") {
        const friend = friends.find((f) => f.id === normalized.peer?.id);
        if (friend) {
          normalized.peer = {
            id: friend.id,
            username: friend.username,
            displayName: friend.displayName || friend.display_name || null,
            avatarUrl: friend.avatarUrl || friend.avatar_url || null,
            updated_at: friend.updated_at || friend.avatarVersion || null,
          };
        }
      }
      upsertCachedCall(meId, normalized);
      setCalls((prev) => {
        const rest = (prev || []).filter((c) => c.id !== normalized.id);
        return [normalized, ...rest].slice(0, 80);
      });
    };
    socket.on("calls:updated", onUpdated);
    return () => socket.off("calls:updated", onUpdated);
  }, [socket, meId, friends, refresh]);

  const onlineFriends = useMemo(() => {
    const list = Array.isArray(friends) ? friends : [];
    return list
      .filter((f) => {
        const st = getPresenceStatus(onlineUsers, f.id);
        return st && st !== "offline" && st !== "invisible";
      })
      .slice(0, 12);
  }, [friends, onlineUsers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (calls || []).filter((c) => {
      if (filter === "missed" && c.status !== "missed" && c.status !== "declined") return false;
      if (filter === "incoming" && c.direction !== "incoming") return false;
      if (filter === "outgoing" && c.direction !== "outgoing") return false;
      if (!q) return true;
      const name = resolveDisplayName(c.peer).toLowerCase();
      return name.includes(q) || (c.peer?.username || "").toLowerCase().includes(q);
    });
  }, [calls, filter, query]);

  const missedCount = useMemo(
    () => (calls || []).filter((c) => c.status === "missed" || c.status === "declined").length,
    [calls]
  );

  return (
    <div className={`calls-view ${compact ? "is-compact" : ""}`}>
      {!compact && (
        <div className="calls-hero">
          <div className="calls-hero-copy">
            <h2>Calls</h2>
            <p>Quick-dial friends or jump back into recent voice & video calls.</p>
          </div>
          <button
            type="button"
            className="calls-refresh-btn"
            onClick={() => refresh({ soft: true })}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? "spin-refresh" : ""} />
            Refresh
          </button>
        </div>
      )}

      {onlineFriends.length > 0 && (
        <section className="calls-section">
          <div className="calls-section-head">
            <Users size={14} />
            <span>Quick dial</span>
            <em>{onlineFriends.length} online</em>
          </div>
          <div className="calls-quick-dial">
            {onlineFriends.map((friend) => {
              const status = getPresenceStatus(onlineUsers, friend.id);
              return (
                <motion.div
                  key={friend.id}
                  className="calls-quick-card"
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    type="button"
                    className="calls-quick-avatar"
                    onClick={() => onOpenChat?.(friend)}
                    title={`Open chat with ${resolveDisplayName(friend)}`}
                  >
                    <Avatar name={resolveDisplayName(friend)} size={compact ? 40 : 48} user={friend} />
                    <StatusBadge status={status || "online"} />
                  </button>
                  <span className="calls-quick-name">{resolveDisplayName(friend)}</span>
                  <div className="calls-quick-actions">
                    <button
                      type="button"
                      className="calls-icon-btn"
                      title="Voice call"
                      onClick={() => onStartCall?.(friend, "voice")}
                    >
                      <Phone size={15} />
                    </button>
                    <button
                      type="button"
                      className="calls-icon-btn is-video"
                      title="Video call"
                      onClick={() => onStartCall?.(friend, "video")}
                    >
                      <Video size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      <section className="calls-section calls-history-section">
        <div className="calls-section-head">
          <Phone size={14} />
          <span>Recent</span>
          {missedCount > 0 && <em className="is-missed">{missedCount} missed</em>}
        </div>

        <div className="calls-toolbar">
          <div className="calls-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`calls-filter-chip ${filter === f.id ? "active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="calls-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calls"
            />
          </div>
        </div>

        {error && <div className="calls-error">{error}</div>}

        {loading ? (
          <div className="calls-empty">Loading call history…</div>
        ) : filtered.length === 0 ? (
          <div className="calls-empty">
            <Phone size={28} />
            <strong>{filter === "missed" ? "No missed calls" : "No calls yet"}</strong>
            <span>Start a voice or video call from Quick dial or any chat.</span>
          </div>
        ) : (
          <div className="calls-list">
            <AnimatePresence initial={false}>
              {filtered.map((call) => {
                const meta = statusMeta(call);
                const Icon = meta.Icon;
                const TypeIcon = call.callType === "video" ? Video : Phone;
                const duration = formatCallDuration(call.durationSeconds);
                const when = formatCallWhen(call.endedAt || call.createdAt);
                const peerStatus = getPresenceStatus(onlineUsers, call.peer?.id);
                return (
                  <motion.div
                    key={call.id}
                    className={`calls-row tone-${meta.tone}`}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    <button
                      type="button"
                      className="calls-row-main"
                      onClick={() => onOpenChat?.(call.peer)}
                    >
                      <div className="calls-row-avatar">
                        <Avatar
                          name={resolveDisplayName(call.peer)}
                          size={40}
                          user={call.peer}
                        />
                        {peerStatus && peerStatus !== "offline" && (
                          <StatusBadge status={peerStatus} />
                        )}
                      </div>
                      <div className="calls-row-meta">
                        <div className="calls-row-top">
                          <strong>{resolveDisplayName(call.peer)}</strong>
                          <span>{when}</span>
                        </div>
                        <div className="calls-row-sub">
                          <Icon size={13} />
                          <TypeIcon size={13} />
                          <span>
                            {meta.label}
                            {duration ? ` · ${duration}` : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="calls-row-actions">
                      <button
                        type="button"
                        className="calls-icon-btn"
                        title="Call back"
                        onClick={() => onStartCall?.(call.peer, call.callType === "video" ? "video" : "voice")}
                      >
                        <Phone size={15} />
                      </button>
                      <button
                        type="button"
                        className="calls-icon-btn is-video"
                        title="Video call"
                        onClick={() => onStartCall?.(call.peer, "video")}
                      >
                        <Video size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}

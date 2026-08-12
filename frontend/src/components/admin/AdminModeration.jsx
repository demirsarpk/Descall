import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ban, Clock, Shield, Search, RefreshCw, Gavel, UserX, History,
  AlertTriangle, MessageSquare, X, CheckCircle2, Timer,
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import { API_BASE_URL } from "../../config/api";
import { Avatar } from "../ui/Avatar";
import RippleButton from "../ui/RippleButton";
import { useT } from "../../context/LocaleContext";

const ACTION_TABS = [
  { id: "timeout", label: "Timeout", icon: Timer, tone: "amber" },
  { id: "ban", label: "Ban", icon: Ban, tone: "red" },
  { id: "kick", label: "Kick", icon: UserX, tone: "slate" },
];

function formatUntil(iso) {
  if (!iso) return "Permanent";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function remainingLabel(iso) {
  if (!iso) return "∞";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

export default function AdminModeration({ users = [], onRefreshUsers }) {
  const t = useT();
  const [meta, setMeta] = useState({ categories: [], timeoutPresets: [], banPresets: [] });
  const [active, setActive] = useState({ bans: [], timeouts: [] });
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [panel, setPanel] = useState("issue"); // issue | active | history

  const [action, setAction] = useState("timeout");
  const [userQuery, setUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [category, setCategory] = useState("harassment");
  const [otherText, setOtherText] = useState("");
  const [message, setMessage] = useState("");
  const [presetId, setPresetId] = useState("1h");
  const [customMinutes, setCustomMinutes] = useState("");

  const loadAll = useCallback(async () => {
    const [m, a, h] = await Promise.all([
      adminFetch("/moderation/meta"),
      adminFetch("/moderation/active"),
      adminFetch("/moderation/history?limit=80"),
    ]);
    setMeta(m || { categories: [], timeoutPresets: [], banPresets: [] });
    setActive({ bans: a?.bans || [], timeouts: a?.timeouts || [] });
    setHistory(h?.history || []);
  }, []);

  useEffect(() => {
    loadAll().catch((e) => setErr(e.message || "Failed to load moderation"));
  }, [loadAll]);

  useEffect(() => {
    if (action === "timeout") setPresetId("1h");
    else if (action === "ban") setPresetId("permanent");
  }, [action]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return (users || []).slice(0, 40);
    return (users || [])
      .filter((u) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.display_name || u.displayName || "").toLowerCase().includes(q) ||
        (u.id || "").toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [users, userQuery]);

  const presets = action === "ban" ? meta.banPresets : meta.timeoutPresets;
  const categoryGroups = useMemo(() => {
    const map = new Map();
    for (const c of meta.categories || []) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group).push(c);
    }
    return [...map.entries()];
  }, [meta.categories]);

  const act = async (fn) => {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submitSanction = () =>
    act(async () => {
      if (!selectedUser?.id) throw new Error(t("Select a user first"));
      if (category === "other" && !otherText.trim()) {
        throw new Error(t("Describe the reason for Other"));
      }
      const durationSeconds =
        presetId === "custom" && customMinutes
          ? Math.max(1, Math.floor(Number(customMinutes) * 60))
          : undefined;
      const body = {
        category,
        otherText: otherText.trim() || undefined,
        message: message.trim() || undefined,
        presetId: presetId === "custom" ? undefined : presetId,
        durationSeconds,
      };
      const path =
        action === "ban"
          ? `/users/${selectedUser.id}/ban`
          : action === "timeout"
            ? `/users/${selectedUser.id}/timeout`
            : `/users/${selectedUser.id}/kick`;
      await adminFetch(path, { method: "POST", body: JSON.stringify(body) });
      setOk(
        action === "ban"
          ? t("User banned")
          : action === "timeout"
            ? t("User timed out")
            : t("User kicked")
      );
      setMessage("");
      setOtherText("");
      await loadAll();
      onRefreshUsers?.();
    });

  const revoke = (row) =>
    act(async () => {
      const path =
        row.type === "ban"
          ? `/users/${row.userId}/unban`
          : `/users/${row.userId}/untimeout`;
      await adminFetch(path, { method: "POST", body: JSON.stringify({}) });
      setOk(row.type === "ban" ? t("User unbanned") : t("Timeout removed"));
      await loadAll();
      onRefreshUsers?.();
    });

  return (
    <section className="admin-section mod-suite">
      <div className="mod-suite-head">
        <div>
          <h2>{t("Ban & Timeout Control")}</h2>
          <p className="muted">
            {t("Issue category-based bans and app timeouts with a message the user will see.")}
          </p>
        </div>
        <RippleButton type="button" onClick={() => act(loadAll)} disabled={busy} className="refresh-btn">
          <RefreshCw size={16} className={busy ? "spin" : ""} />
          {t("Refresh")}
        </RippleButton>
      </div>

      <div className="mod-panel-tabs">
        {[
          { id: "issue", label: t("Issue action"), icon: Gavel },
          { id: "active", label: t("Active sanctions"), icon: Shield },
          { id: "history", label: t("History"), icon: History },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            className={`mod-panel-tab ${panel === p.id ? "active" : ""}`}
            onClick={() => setPanel(p.id)}
          >
            <p.icon size={15} />
            {p.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {err && (
          <motion.div className="admin-error-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AlertTriangle size={16} /> {err}
          </motion.div>
        )}
        {ok && (
          <motion.div className="admin-success-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CheckCircle2 size={16} /> {ok}
          </motion.div>
        )}
      </AnimatePresence>

      {panel === "issue" && (
        <div className="mod-issue-grid">
          <div className="mod-card">
            <h3>{t("1. Select user")}</h3>
            <div className="mod-search">
              <Search size={16} />
              <input
                className="admin-input"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder={t("Search username or ID…")}
              />
            </div>
            <div className="mod-user-list">
              {filteredUsers.length === 0 ? (
                <p className="muted">{t("No users match")}</p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`mod-user-row ${selectedUser?.id === u.id ? "selected" : ""}`}
                    onClick={() => setSelectedUser(u)}
                  >
                    <Avatar name={u.username} size={32} user={u} />
                    <div className="mod-user-meta">
                      <strong>{u.display_name || u.displayName || u.username}</strong>
                      <span>@{u.username}</span>
                    </div>
                    {u.isOnline && <span className="admin-badge online">{t("Online")}</span>}
                  </button>
                ))
              )}
            </div>
            {selectedUser && (
              <div className="mod-selected-chip">
                <Avatar name={selectedUser.username} size={28} user={selectedUser} />
                <span>@{selectedUser.username}</span>
                <button type="button" onClick={() => setSelectedUser(null)} aria-label={t("Clear")}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="mod-card">
            <h3>{t("2. Action type")}</h3>
            <div className="mod-action-tabs">
              {ACTION_TABS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`mod-action-tab tone-${a.tone} ${action === a.id ? "active" : ""}`}
                  onClick={() => setAction(a.id)}
                >
                  <a.icon size={16} />
                  {t(a.label)}
                </button>
              ))}
            </div>

            {action !== "kick" && (
              <>
                <h4>{t("Duration")}</h4>
                <div className="mod-preset-grid">
                  {(presets || []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`mod-preset ${presetId === p.id ? "active" : ""}`}
                      onClick={() => setPresetId(p.id)}
                    >
                      {t(p.label)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`mod-preset ${presetId === "custom" ? "active" : ""}`}
                    onClick={() => setPresetId("custom")}
                  >
                    {t("Custom")}
                  </button>
                </div>
                {presetId === "custom" && (
                  <label className="mod-field">
                    {t("Minutes")}
                    <input
                      className="admin-input"
                      type="number"
                      min={1}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="60"
                    />
                  </label>
                )}
              </>
            )}

            <h4>{t("3. Category")}</h4>
            <div className="mod-category-scroll">
              {categoryGroups.map(([group, items]) => (
                <div key={group} className="mod-cat-group">
                  <div className="mod-cat-group-label">{t(group)}</div>
                  <div className="mod-cat-chips">
                    {items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`mod-cat-chip ${category === c.id ? "active" : ""}`}
                        onClick={() => setCategory(c.id)}
                      >
                        {t(c.label)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {category === "other" && (
              <label className="mod-field">
                {t("Other reason")}
                <input
                  className="admin-input"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder={t("Describe the reason…")}
                  maxLength={200}
                />
              </label>
            )}

            <label className="mod-field">
              <span>
                <MessageSquare size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                {t("Message shown to user")}
              </span>
              <textarea
                className="admin-input mod-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("Optional note the user will see…")}
                rows={3}
                maxLength={500}
              />
            </label>

            <RippleButton
              type="button"
              className={`mod-submit tone-${ACTION_TABS.find((a) => a.id === action)?.tone || "red"}`}
              disabled={busy || !selectedUser}
              onClick={submitSanction}
            >
              {action === "ban" && <Ban size={16} />}
              {action === "timeout" && <Clock size={16} />}
              {action === "kick" && <UserX size={16} />}
              {action === "ban"
                ? t("Ban user")
                : action === "timeout"
                  ? t("Apply timeout")
                  : t("Kick user")}
            </RippleButton>
          </div>
        </div>
      )}

      {panel === "active" && (
        <div className="mod-active-grid">
          <div className="mod-card">
            <h3>
              <Ban size={16} /> {t("Active bans")} ({active.bans.length})
            </h3>
            {active.bans.length === 0 ? (
              <p className="muted">{t("No banned users")}</p>
            ) : (
              active.bans.map((b) => (
                <div key={`ban-${b.userId}`} className="mod-sanction-row">
                  <Avatar name={b.username} size={34} user={{ username: b.username, avatar_url: b.avatarUrl }} />
                  <div className="mod-sanction-body">
                    <strong>@{b.username}</strong>
                    <span className="mod-pill red">{b.categoryLabel || b.category}</span>
                    {b.message && <p className="mod-sanction-msg">“{b.message}”</p>}
                    <small>
                      {b.expiresAt ? `${formatUntil(b.expiresAt)} · ${remainingLabel(b.expiresAt)}` : t("Permanent")}
                    </small>
                  </div>
                  <RippleButton type="button" className="small admin-btn-green" disabled={busy} onClick={() => revoke(b)}>
                    {t("Unban")}
                  </RippleButton>
                </div>
              ))
            )}
          </div>

          <div className="mod-card">
            <h3>
              <Clock size={16} /> {t("Active timeouts")} ({active.timeouts.length})
            </h3>
            {active.timeouts.length === 0 ? (
              <p className="muted">{t("No active timeouts")}</p>
            ) : (
              active.timeouts.map((row) => (
                <div key={`to-${row.userId}`} className="mod-sanction-row">
                  <Avatar name={row.username} size={34} user={{ username: row.username, avatar_url: row.avatarUrl }} />
                  <div className="mod-sanction-body">
                    <strong>@{row.username}</strong>
                    <span className="mod-pill amber">{row.categoryLabel || row.category}</span>
                    {row.message && <p className="mod-sanction-msg">“{row.message}”</p>}
                    <small>
                      {formatUntil(row.until)} · {remainingLabel(row.until)}
                    </small>
                  </div>
                  <RippleButton type="button" className="small" disabled={busy} onClick={() => revoke(row)}>
                    {t("Remove timeout")}
                  </RippleButton>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {panel === "history" && (
        <div className="mod-card">
          <h3>
            <History size={16} /> {t("Moderation history")}
          </h3>
          <div className="mod-history-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("When")}</th>
                  <th>{t("Action")}</th>
                  <th>{t("Target")}</th>
                  <th>{t("Category")}</th>
                  <th>{t("Message")}</th>
                  <th>{t("By")}</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "rgba(244,246,251,0.45)", padding: 24 }}>
                      {t("No moderation actions yet")}
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12 }}>{formatUntil(h.created_at)}</td>
                      <td>
                        <span className={`mod-pill ${h.action_type === "ban" ? "red" : h.action_type === "timeout" ? "amber" : "slate"}`}>
                          {h.action_type}
                        </span>
                      </td>
                      <td>@{h.targetUsername || h.target_user_id?.slice(0, 8)}</td>
                      <td>{h.categoryLabel || h.category || "—"}</td>
                      <td style={{ maxWidth: 220, fontSize: 12 }}>{h.message || h.reason || "—"}</td>
                      <td>@{h.actorUsername || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            API: {API_BASE_URL}/admin/moderation/*
          </p>
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  MoreHorizontal,
  LogOut,
  Trash2,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";

/**
 * Servers list + in-server channel shell (Step 2).
 * Channel CRUD / messaging comes in later steps — channels are read-only here.
 */
export default function ServersSidebar({
  servers = [],
  serversLoaded = false,
  activeServer = null,
  ownedCount = 0,
  maxOwned = 10,
  onSelectServer,
  onBackToList,
  onCreateServer,
  onLeaveServer,
  onDeleteServer,
  onRefresh,
  onMobileClose,
  isMobile = false,
}) {
  const t = useT();
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { mode: 'leave'|'delete', server }
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState({});

  const canCreate = ownedCount < maxOwned;

  const channelTree = useMemo(() => buildChannelTree(activeServer?.channels || []), [activeServer?.channels]);

  useEffect(() => {
    setMenuOpen(false);
    setCollapsedCats({});
  }, [activeServer?.id]);

  const openConfirm = (mode) => {
    if (!activeServer) return;
    setMenuOpen(false);
    setConfirm({ mode, server: activeServer });
  };

  const runLeaveOrDelete = async (mode, server, confirmName) => {
    if (mode === "delete") await onDeleteServer?.(server.id, confirmName);
    else await onLeaveServer?.(server.id, confirmName);
  };

  if (activeServer) {
    return (
      <aside className="sidebar-secondary servers-sidebar">
        <div className="sidebar-inner">
          <div className="server-shell-header">
            <button
              type="button"
              className="icon-btn server-back-btn"
              title={t("Back to servers")}
              onClick={() => onBackToList?.()}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="server-shell-title-wrap">
              <h2 className="sidebar-title server-shell-title">{activeServer.name}</h2>
              <span className="server-shell-meta">
                {t("{count} members", { count: activeServer.memberCount || 1 })}
                {activeServer.isOwner ? ` · ${t("Owner")}` : ""}
              </span>
            </div>
            <div className="sidebar-actions">
              {onMobileClose && (
                <button type="button" className="icon-btn mobile-sidebar-close" onClick={onMobileClose} title={t("Close")}>
                  <X size={18} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                title={t("Server menu")}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="server-dropdown"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {activeServer.isOwner ? (
                  <button type="button" className="server-dropdown-item danger" onClick={() => openConfirm("delete")}>
                    <Trash2 size={15} />
                    {t("Delete server")}
                  </button>
                ) : (
                  <button type="button" className="server-dropdown-item danger" onClick={() => openConfirm("leave")}>
                    <LogOut size={15} />
                    {t("Leave server")}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="sidebar-content server-channels-scroll">
            {channelTree.map((node) => {
              if (node.type === "category") {
                const closed = Boolean(collapsedCats[node.id]);
                return (
                  <div key={node.id} className="server-channel-cat">
                    <button
                      type="button"
                      className="server-channel-cat-btn"
                      onClick={() =>
                        setCollapsedCats((prev) => ({ ...prev, [node.id]: !prev[node.id] }))
                      }
                    >
                      {closed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      <span>{node.name}</span>
                    </button>
                    {!closed &&
                      node.children.map((ch) => (
                        <ChannelRow key={ch.id} channel={ch} disabled />
                      ))}
                  </div>
                );
              }
              return <ChannelRow key={node.id} channel={node} disabled />;
            })}
            {channelTree.length === 0 && (
              <p className="server-empty-hint">{t("No channels yet.")}</p>
            )}
            <p className="server-step-hint">
              {t("Text chat and voice connect land in the next steps. Channels are preview-only for now.")}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {confirm && (
            confirm.mode === "delete" || confirm.server.isOwner ? (
              <ConfirmNameDialog
                mode={confirm.mode === "delete" || confirm.server.isOwner ? "delete" : "leave"}
                serverName={confirm.server.name}
                onCancel={() => setConfirm(null)}
                onConfirm={async (confirmName) => {
                  const server = confirm.server;
                  const mode = confirm.mode;
                  setConfirm(null);
                  await runLeaveOrDelete(mode, server, confirmName);
                }}
              />
            ) : (
              <ConfirmLeaveDialog
                serverName={confirm.server.name}
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                  const server = confirm.server;
                  setConfirm(null);
                  await onLeaveServer?.(server.id);
                }}
              />
            )
          )}
        </AnimatePresence>
      </aside>
    );
  }

  return (
    <aside className="sidebar-secondary servers-sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-header">
          <h2 className="sidebar-title">{t("Servers")}</h2>
          <div className="sidebar-actions">
            {onMobileClose && (
              <button type="button" className="icon-btn mobile-sidebar-close" onClick={onMobileClose} title={t("Close")}>
                <X size={18} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              title={t("Refresh")}
              onClick={async () => {
                setRefreshing(true);
                await onRefresh?.();
                setTimeout(() => setRefreshing(false), 600);
              }}
            >
              <RefreshCw size={18} className={refreshing ? "spin-refresh" : ""} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={canCreate ? t("Create server") : t("Own limit reached ({max})", { max: maxOwned })}
              disabled={!canCreate}
              onClick={() => canCreate && setShowCreate(true)}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="server-owned-banner">
          {t("Owned {owned} / {max}", { owned: ownedCount, max: maxOwned })}
        </div>

        <div className="sidebar-content">
          {!serversLoaded ? (
            <p className="server-empty-hint">{t("Loading…")}</p>
          ) : servers.length === 0 ? (
            <div className="server-empty-state">
              <Server size={36} strokeWidth={1.5} />
              <h3>{t("No servers yet")}</h3>
              <p>{t("Create a server to start building channels, roles, and voice — Discord-style.")}</p>
              <button
                type="button"
                className="server-primary-btn"
                disabled={!canCreate}
                onClick={() => setShowCreate(true)}
              >
                <Plus size={16} />
                {t("Create server")}
              </button>
            </div>
          ) : (
            <ul className="server-list">
              {servers.map((server) => (
                <li key={server.id}>
                  <button
                    type="button"
                    className="server-list-item"
                    onClick={() => {
                      onSelectServer?.(server);
                      if (isMobile) onMobileClose?.();
                    }}
                  >
                    <ServerAvatar server={server} />
                    <div className="server-list-copy">
                      <span className="server-list-name">{server.name}</span>
                      <span className="server-list-sub">
                        {t("{count} members", { count: server.memberCount || 1 })}
                        {server.isOwner ? ` · ${t("Owner")}` : ""}
                      </span>
                    </div>
                    {/* Unread / mention badges arrive in a later step */}
                    <span className="server-list-badge-slot" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateServerModal
            canCreate={canCreate}
            maxOwned={maxOwned}
            onClose={() => setShowCreate(false)}
            onCreate={async (payload) => {
              await onCreateServer?.(payload);
              setShowCreate(false);
            }}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}

function ServerAvatar({ server }) {
  const initials = String(server.name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (server.iconUrl) {
    return <img className="server-list-icon" src={server.iconUrl} alt="" />;
  }
  return <div className="server-list-icon server-list-icon-fallback">{initials}</div>;
}

function ChannelRow({ channel, disabled }) {
  const Icon = channel.type === "voice" ? Volume2 : Hash;
  return (
    <button type="button" className="server-channel-row" disabled={disabled} title={channel.name}>
      <Icon size={16} />
      <span>{channel.name}</span>
    </button>
  );
}

function buildChannelTree(channels) {
  const cats = channels.filter((c) => c.type === "category").sort((a, b) => a.position - b.position);
  const rest = channels.filter((c) => c.type !== "category").sort((a, b) => a.position - b.position);
  const used = new Set();
  const tree = [];
  for (const cat of cats) {
    const children = rest.filter((c) => c.parentId === cat.id);
    children.forEach((c) => used.add(c.id));
    tree.push({ ...cat, children });
  }
  for (const ch of rest) {
    if (!used.has(ch.id)) tree.push({ ...ch, children: [] });
  }
  return tree;
}

function CreateServerModal({ onClose, onCreate, canCreate, maxOwned }) {
  const t = useT();
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!canCreate) {
      setError(t("You can own at most {max} servers.", { max: maxOwned }));
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t("Server name must be at least 2 characters."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate({
        name: trimmed,
        iconUrl: iconUrl.trim() || undefined,
      });
    } catch (err) {
      setError(err?.message || t("Failed to create server."));
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className="server-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3>{t("Create a server")}</h3>
        <p className="server-modal-lead">
          {t("Your server is where you and your friends hang out. Make yours and start talking.")}
        </p>
        <label className="server-field">
          <span>{t("Server name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder={t("My server")}
            autoFocus
            required
          />
        </label>
        <label className="server-field">
          <span>{t("Icon URL (optional)")}</span>
          <input
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            maxLength={500}
            placeholder="https://"
          />
        </label>
        {error && <p className="server-modal-error">{error}</p>}
        <div className="server-modal-actions">
          <button type="button" className="server-ghost-btn" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </button>
          <button type="submit" className="server-primary-btn" disabled={busy || name.trim().length < 2}>
            {busy ? t("Please wait...") : t("Create")}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function ConfirmLeaveDialog({ serverName, onConfirm, onCancel }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="server-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t("Leave server")}</h3>
        <p className="server-modal-lead">
          {t("Are you sure you want to leave {name}?", { name: serverName })}
        </p>
        {error && <p className="server-modal-error">{error}</p>}
        <div className="server-modal-actions">
          <button type="button" className="server-ghost-btn" onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="server-danger-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm();
              } catch (err) {
                setError(err?.message || t("Something went wrong."));
                setBusy(false);
              }
            }}
          >
            {busy ? t("Please wait...") : t("Leave server")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConfirmNameDialog({ mode, serverName, onConfirm, onCancel }) {
  const t = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const match = value.trim().toLowerCase() === String(serverName || "").toLowerCase();

  const title = mode === "delete" ? t("Delete server") : t("Leave server");
  const message =
    mode === "delete"
      ? t("This will permanently delete {name} for everyone. Type the server name to confirm.", {
          name: serverName,
        })
      : t("Leaving as owner deletes {name} for everyone. Type the server name to confirm.", {
          name: serverName,
        });

  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="server-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <p className="server-modal-lead">{message}</p>
        <label className="server-field">
          <span>{t("Server name")}</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={serverName}
            autoFocus
          />
        </label>
        {error && <p className="server-modal-error">{error}</p>}
        <div className="server-modal-actions">
          <button type="button" className="server-ghost-btn" onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="server-danger-btn"
            disabled={!match || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm(value.trim());
              } catch (err) {
                setError(err?.message || t("Something went wrong."));
                setBusy(false);
              }
            }}
          >
            {busy ? t("Please wait...") : mode === "delete" ? t("Delete server") : t("Leave server")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

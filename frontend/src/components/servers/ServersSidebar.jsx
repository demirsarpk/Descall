import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Hash,
  Volume2,
  Folder,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  MoreHorizontal,
  LogOut,
  Trash2,
  RefreshCw,
  Server,
  X,
  Pencil,
  Settings2,
  Shield,
  Link2,
  LogIn,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";
import ServerRolesModal from "./ServerRolesModal";
import ServerInviteModal from "./ServerInviteModal";
import JoinServerModal from "./JoinServerModal";
import { ServerListSkeleton } from "../ui/Skeleton";

/**
 * Servers list + in-server channel shell (Steps 2–3).
 * Channel messaging / voice connect land in later steps.
 */
export default function ServersSidebar({
  servers = [],
  serversLoaded = false,
  activeServer = null,
  activeChannel = null,
  ownedCount = 0,
  maxOwned = 10,
  onSelectServer,
  onSelectChannel,
  onBackToList,
  onCreateServer,
  onLeaveServer,
  onDeleteServer,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onRolesChanged,
  onRefresh,
  onJoinServer,
  onServerUpdated,
  onMobileClose,
  isMobile = false,
}) {
  const t = useT();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { mode: 'leave'|'delete', server }
  const [channelModal, setChannelModal] = useState(null); // { mode, channel?, defaultType?, parentId? }
  const [showRoles, setShowRoles] = useState(false);
  const [channelMenuId, setChannelMenuId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState({});

  const canCreate = ownedCount < maxOwned;
  const permFlags = activeServer?.myPermissions?.flags || {};
  const canManageChannels = Boolean(
    activeServer?.isOwner || permFlags.MANAGE_CHANNELS || permFlags.ADMINISTRATOR
  );
  const canManageRoles = Boolean(
    activeServer?.isOwner || permFlags.MANAGE_ROLES || permFlags.ADMINISTRATOR
  );
  const canCreateInvite = Boolean(
    activeServer?.isOwner || permFlags.CREATE_INSTANT_INVITE || permFlags.ADMINISTRATOR
  );
  const categories = useMemo(
    () => (activeServer?.channels || []).filter((c) => c.type === "category").sort((a, b) => a.position - b.position),
    [activeServer?.channels]
  );
  const channelTree = useMemo(() => buildChannelTree(activeServer?.channels || []), [activeServer?.channels]);

  useEffect(() => {
    setMenuOpen(false);
    setChannelMenuId(null);
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
              {canManageChannels && (
                <button
                  type="button"
                  className="icon-btn"
                  title={t("Create channel")}
                  onClick={() => {
                    setMenuOpen(false);
                    setChannelModal({ mode: "create", defaultType: "text" });
                  }}
                >
                  <Plus size={18} />
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
                {canManageChannels && (
                  <>
                    <button
                      type="button"
                      className="server-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        setChannelModal({ mode: "create", defaultType: "text" });
                      }}
                    >
                      <Hash size={15} />
                      {t("Create channel")}
                    </button>
                    <button
                      type="button"
                      className="server-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        setChannelModal({ mode: "create", defaultType: "category" });
                      }}
                    >
                      <Folder size={15} />
                      {t("Create category")}
                    </button>
                  </>
                )}
                {canManageRoles && (
                    <button
                      type="button"
                      className="server-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowRoles(true);
                      }}
                    >
                      <Shield size={15} />
                      {t("Roles")}
                    </button>
                )}
                {canCreateInvite && (
                  <button
                    type="button"
                    className="server-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowInvite(true);
                    }}
                  >
                    <Link2 size={15} />
                    {t("Invite people")}
                  </button>
                )}
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
                    <div className="server-channel-cat-row">
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
                      {canManageChannels && (
                        <div className="server-channel-cat-actions">
                          <button
                            type="button"
                            className="icon-btn server-channel-mini-btn"
                            title={t("Create channel")}
                            onClick={() =>
                              setChannelModal({ mode: "create", defaultType: "text", parentId: node.id })
                            }
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn server-channel-mini-btn"
                            title={t("Edit category")}
                            onClick={() => setChannelModal({ mode: "edit", channel: node })}
                          >
                            <Settings2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn server-channel-mini-btn"
                            title={t("Delete category")}
                            onClick={() => setChannelModal({ mode: "delete", channel: node })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {!closed &&
                      node.children.map((ch) => (
                        <ChannelRow
                          key={ch.id}
                          channel={ch}
                          active={activeChannel?.id === ch.id}
                          canManage={canManageChannels}
                          menuOpen={channelMenuId === ch.id}
                          onOpenMenu={() => setChannelMenuId((id) => (id === ch.id ? null : ch.id))}
                          onCloseMenu={() => setChannelMenuId(null)}
                          onSelect={() => {
                            onSelectChannel?.(ch);
                            if (isMobile) onMobileClose?.();
                          }}
                          onEdit={() => {
                            setChannelMenuId(null);
                            setChannelModal({ mode: "edit", channel: ch });
                          }}
                          onDelete={() => {
                            setChannelMenuId(null);
                            setChannelModal({ mode: "delete", channel: ch });
                          }}
                        />
                      ))}
                  </div>
                );
              }
              return (
                <ChannelRow
                  key={node.id}
                  channel={node}
                  active={activeChannel?.id === node.id}
                  canManage={canManageChannels}
                  menuOpen={channelMenuId === node.id}
                  onOpenMenu={() => setChannelMenuId((id) => (id === node.id ? null : node.id))}
                  onCloseMenu={() => setChannelMenuId(null)}
                  onSelect={() => {
                    onSelectChannel?.(node);
                    if (isMobile) onMobileClose?.();
                  }}
                  onEdit={() => {
                    setChannelMenuId(null);
                    setChannelModal({ mode: "edit", channel: node });
                  }}
                  onDelete={() => {
                    setChannelMenuId(null);
                    setChannelModal({ mode: "delete", channel: node });
                  }}
                />
              );
            })}
            {channelTree.length === 0 && (
              <p className="server-empty-hint">{t("No channels yet.")}</p>
            )}
            <p className="server-step-hint">
              {t("Open a text channel to chat. Voice connect arrives in a later step.")}
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

        <AnimatePresence>
          {channelModal?.mode === "create" && (
            <ChannelFormModal
              mode="create"
              defaultType={channelModal.defaultType || "text"}
              parentId={channelModal.parentId || null}
              categories={categories}
              onClose={() => setChannelModal(null)}
              onSubmit={async (payload) => {
                await onCreateChannel?.(payload);
                setChannelModal(null);
              }}
            />
          )}
          {channelModal?.mode === "edit" && channelModal.channel && (
            <ChannelFormModal
              mode="edit"
              channel={channelModal.channel}
              categories={categories}
              onClose={() => setChannelModal(null)}
              onSubmit={async (payload) => {
                await onUpdateChannel?.(channelModal.channel.id, payload);
                setChannelModal(null);
              }}
            />
          )}
          {channelModal?.mode === "delete" && channelModal.channel && (
            <ConfirmDeleteChannelDialog
              channel={channelModal.channel}
              onCancel={() => setChannelModal(null)}
              onConfirm={async () => {
                await onDeleteChannel?.(channelModal.channel.id);
                setChannelModal(null);
              }}
            />
          )}
          {showRoles && (
            <ServerRolesModal
              server={activeServer}
              onClose={() => setShowRoles(false)}
              onRolesChanged={(roles) => onRolesChanged?.(roles)}
            />
          )}
          {showInvite && (
            <ServerInviteModal
              server={activeServer}
              onClose={() => setShowInvite(false)}
              onServerUpdated={(updated) => onServerUpdated?.(updated)}
            />
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
              title={t("Join Server")}
              onClick={() => setShowJoin(true)}
            >
              <LogIn size={18} />
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
            <ServerListSkeleton count={6} label={t("Loading servers")} />
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
              <button
                type="button"
                className="server-ghost-btn"
                onClick={() => setShowJoin(true)}
              >
                <LogIn size={16} />
                {t("Join Server")}
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
        {showJoin && (
          <JoinServerModal
            onClose={() => setShowJoin(false)}
            onJoined={(server) => {
              onJoinServer?.(server);
              setShowJoin(false);
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

function ChannelRow({
  channel,
  active,
  canManage,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onSelect,
  onEdit,
  onDelete,
}) {
  const t = useT();
  const Icon = channel.type === "voice" ? Volume2 : Hash;
  return (
    <div className={`server-channel-row-wrap ${active ? "active" : ""}`}>
      <button
        type="button"
        className={`server-channel-row ${active ? "active" : ""}`}
        title={channel.name}
        onClick={onSelect}
      >
        <Icon size={16} />
        <span>{channel.name}</span>
      </button>
      {canManage && (
        <div className="server-channel-row-actions">
          <button
            type="button"
            className="icon-btn server-channel-mini-btn"
            title={t("Channel settings")}
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu?.();
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="server-channel-menu"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                onMouseLeave={onCloseMenu}
              >
                <button type="button" className="server-dropdown-item" onClick={onEdit}>
                  <Pencil size={14} />
                  {t("Edit channel")}
                </button>
                <button type="button" className="server-dropdown-item danger" onClick={onDelete}>
                  <Trash2 size={14} />
                  {t("Delete channel")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
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

function ChannelFormModal({ mode, channel, defaultType = "text", parentId = null, categories = [], onClose, onSubmit }) {
  const t = useT();
  const isEdit = mode === "edit";
  const initialType = isEdit ? channel.type : defaultType;
  const [type, setType] = useState(initialType);
  const [name, setName] = useState(isEdit ? channel.name : "");
  const [topic, setTopic] = useState(isEdit ? channel.topic || "" : "");
  const [selectedParent, setSelectedParent] = useState(
    isEdit ? channel.parentId || "" : parentId || ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const typeLocked = isEdit;
  const showParent = type !== "category";
  const showTopic = type === "text";

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Channel name is required."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: trimmed,
        type,
        parentId: showParent && selectedParent ? selectedParent : null,
      };
      if (showTopic) payload.topic = topic.trim() || null;
      if (isEdit) {
        await onSubmit({
          name: payload.name,
          topic: showTopic ? payload.topic : undefined,
          parentId: showParent ? payload.parentId : undefined,
        });
      } else {
        await onSubmit(payload);
      }
    } catch (err) {
      setError(err?.message || t("Something went wrong."));
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const title = isEdit
    ? channel.type === "category"
      ? t("Edit category")
      : t("Edit channel")
    : type === "category"
      ? t("Create category")
      : t("Create channel");

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
        <h3>{title}</h3>
        <p className="server-modal-lead">
          {type === "category"
            ? t("Categories group channels in the sidebar.")
            : t("Text and voice channels only — more types later.")}
        </p>

        {!typeLocked && (
          <div className="server-type-toggle" role="group" aria-label={t("Channel type")}>
            {[
              { id: "text", label: t("Text"), Icon: Hash },
              { id: "voice", label: t("Voice"), Icon: Volume2 },
              { id: "category", label: t("Category"), Icon: Folder },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`server-type-btn ${type === id ? "active" : ""}`}
                onClick={() => setType(id)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        )}

        <label className="server-field">
          <span>{type === "category" ? t("Category name") : t("Channel name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder={type === "text" ? "general" : type === "voice" ? t("General") : t("Text Channels")}
            autoFocus
            required
          />
        </label>

        {showParent && (
          <label className="server-field">
            <span>{t("Category (optional)")}</span>
            <select value={selectedParent} onChange={(e) => setSelectedParent(e.target.value)}>
              <option value="">{t("No category")}</option>
              {categories
                .filter((c) => !isEdit || c.id !== channel?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        {showTopic && (
          <label className="server-field">
            <span>{t("Topic (optional)")}</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={1024}
              placeholder={t("What's this channel about?")}
            />
          </label>
        )}

        {error && <p className="server-modal-error">{error}</p>}
        <div className="server-modal-actions">
          <button type="button" className="server-ghost-btn" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </button>
          <button type="submit" className="server-primary-btn" disabled={busy || !name.trim()}>
            {busy ? t("Please wait...") : isEdit ? t("Save") : t("Create")}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function ConfirmDeleteChannelDialog({ channel, onConfirm, onCancel }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isCategory = channel.type === "category";
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
        <h3>{isCategory ? t("Delete category") : t("Delete channel")}</h3>
        <p className="server-modal-lead">
          {isCategory
            ? t("Delete {name}? Channels inside stay, but leave this category.", { name: channel.name })
            : t("Delete #{name}? This cannot be undone.", { name: channel.name })}
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
            {busy ? t("Please wait...") : isCategory ? t("Delete category") : t("Delete channel")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
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

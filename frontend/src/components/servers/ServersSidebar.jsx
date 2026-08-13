import { useEffect, useMemo, useRef, useState } from "react";
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
  Ban,
  ScrollText,
  MicOff,
  BellOff,
  Bell,
  BellRing,
  Lock,
  PhoneOff,
  ArrowRightLeft,
  Radio,
  ShieldCheck,
  Check,
  Gamepad2,
  Crosshair,
  Users,
  Megaphone,
  GraduationCap,
  Sparkles,
  Layers,
  Camera,
  Upload,
  ImagePlus,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { resolveDisplayName } from "../../lib/userProfile";
import { Avatar } from "../ui/Avatar";
import ImageCropModal from "../ui/ImageCropModal";
import useSpeaking from "../../hooks/useSpeaking";
import { isChannelMuted, toggleChannelMute } from "../../lib/serverChannelMutes";
import { serverHasPermission } from "../../lib/serverPermissions";
import { updateServerNotificationLevel, updateServer } from "../../api/servers";
import { uploadFile } from "../../api/media";
import { readFileAsDataUrl } from "../../lib/cropImage";
import { BLANK_TEMPLATE, SERVER_TEMPLATES, getTemplateCard } from "../../lib/serverTemplatesCatalog";
import ServerRolesModal from "./ServerRolesModal";
import ServerInviteModal from "./ServerInviteModal";
import JoinServerModal from "./JoinServerModal";
import ServerModerationModal from "./ServerModerationModal";
import ChannelPermissionsModal from "./ChannelPermissionsModal";
import ServerCommunityModal from "./ServerCommunityModal";
import ServerRulesModal from "./ServerRulesModal";
import ServerSettingsModal from "./ServerSettingsModal";
import { ServerListSkeleton } from "../ui/Skeleton";

const TEMPLATE_ICONS = {
  Gamepad2,
  Crosshair,
  Users,
  Megaphone,
  GraduationCap,
  Radio,
  Sparkles,
  Server,
};

const NOTIF_LEVELS = [
  { value: "all", label: "All Messages", icon: BellRing },
  { value: "mentions", label: "Only @mentions", icon: Bell },
  { value: "muted", label: "Nothing", icon: BellOff },
];

/**
 * Servers list + in-server channel shell (Steps 2–3).
 * Channel messaging / voice connect land in later steps.
 */
export default function ServersSidebar({
  servers = [],
  serversLoaded = false,
  activeServer = null,
  activeChannel = null,
  channelUnread = {},
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
  onReorderServers,
  serverVoice = null,
  onMobileClose,
  isMobile = false,
}) {
  const t = useT();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModeration, setShowModeration] = useState(null); // 'bans' | 'audit' | null
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragChannelId, setDragChannelId] = useState(null);
  const [dragOverChannelId, setDragOverChannelId] = useState(null);
  const [dragServerId, setDragServerId] = useState(null);
  const [dragOverServerId, setDragOverServerId] = useState(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // { mode: 'leave'|'delete', server }
  const [channelModal, setChannelModal] = useState(null); // { mode, channel?, defaultType?, parentId? }
  const [showRoles, setShowRoles] = useState(false);
  const [channelMenuId, setChannelMenuId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState({});
  const [mutedChannelTick, setMutedChannelTick] = useState(0);
  const [serverIconCropSrc, setServerIconCropSrc] = useState("");
  const [serverIconBusy, setServerIconBusy] = useState(false);
  const serverIconFileRef = useRef(null);

  const canCreate = ownedCount < maxOwned;
  const canManageGuild = serverHasPermission(activeServer, "MANAGE_GUILD");
  const notifLevel = ["all", "mentions", "muted"].includes(activeServer?.notificationLevel)
    ? activeServer.notificationLevel
    : "all";
  const needsRulesAccept = Boolean(
    activeServer?.communityEnabled &&
      activeServer?.rulesText &&
      !activeServer?.rulesAcceptedAt &&
      !activeServer?.isOwner
  );
  const canManageChannels = serverHasPermission(activeServer, "MANAGE_CHANNELS");

  const reorderServerDrop = async (targetServer) => {
    if (!dragServerId || !targetServer?.id || !Array.isArray(servers)) return;
    if (dragServerId === targetServer.id) {
      setDragServerId(null);
      setDragOverServerId(null);
      return;
    }
    const dragged = servers.find((s) => s.id === dragServerId);
    if (!dragged) {
      setDragServerId(null);
      setDragOverServerId(null);
      return;
    }
    const without = servers.filter((s) => s.id !== dragged.id);
    const targetIdx = without.findIndex((s) => s.id === targetServer.id);
    if (targetIdx < 0) {
      setDragServerId(null);
      setDragOverServerId(null);
      return;
    }
    without.splice(targetIdx, 0, dragged);
    const next = without.map((s, index) => ({ ...s, listPosition: index }));
    setDragServerId(null);
    setDragOverServerId(null);
    try {
      await onReorderServers?.(next);
    } catch (err) {
      toast(err?.message || t("Failed to reorder servers."), "error");
    }
  };

  const reorderChannelDrop = async (targetChannel) => {
    if (!canManageChannels || !dragChannelId || !targetChannel?.id) return;
    if (dragChannelId === targetChannel.id) {
      setDragChannelId(null);
      setDragOverChannelId(null);
      return;
    }
    const channels = activeServer?.channels || [];
    const dragged = channels.find((c) => c.id === dragChannelId);
    if (!dragged || dragged.type === "category") {
      setDragChannelId(null);
      setDragOverChannelId(null);
      return;
    }
    const parentId = dragged.parentId || null;
    if ((targetChannel.parentId || null) !== parentId) {
      toast(t("Move channels within the same category."), "warning");
      setDragChannelId(null);
      setDragOverChannelId(null);
      return;
    }
    const siblings = channels
      .filter((c) => c.type !== "category" && (c.parentId || null) === parentId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const without = siblings.filter((c) => c.id !== dragged.id);
    const targetIdx = without.findIndex((c) => c.id === targetChannel.id);
    if (targetIdx < 0) {
      setDragChannelId(null);
      setDragOverChannelId(null);
      return;
    }
    without.splice(targetIdx, 0, dragged);
    setDragChannelId(null);
    setDragOverChannelId(null);
    try {
      await Promise.all(
        without.map((ch, index) =>
          ch.position === index ? Promise.resolve() : onUpdateChannel?.(ch.id, { position: index })
        )
      );
    } catch (err) {
      toast(err?.message || t("Failed to reorder channels."), "error");
    }
  };

  const pickServerIconFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeServer?.id) return;
    e.target.value = "";
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast(t("Icon must be JPG, PNG, WebP, or GIF."), "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast(t("Icon must be 8 MB or smaller."), "error");
      return;
    }
    try {
      setServerIconCropSrc(await readFileAsDataUrl(file));
    } catch {
      toast(t("Failed to read image."), "error");
    }
  };

  const saveServerIconCrop = async (file) => {
    if (!activeServer?.id) return;
    setServerIconBusy(true);
    try {
      const uploaded = await uploadFile(file);
      const url = uploaded?.url;
      if (!url) throw new Error(t("Upload failed"));
      const data = await updateServer(activeServer.id, { iconUrl: url });
      const next = data?.server || { ...activeServer, iconUrl: url };
      onServerUpdated?.(next);
      setServerIconCropSrc("");
      toast(t("Server icon updated"), "success");
    } catch (err) {
      toast(err?.message || t("Failed to update server icon."), "error");
    } finally {
      setServerIconBusy(false);
    }
  };

  const setNotificationLevel = async (level) => {
    if (!activeServer?.id || level === notifLevel || notifBusy) return;
    setNotifBusy(true);
    try {
      await updateServerNotificationLevel(activeServer.id, level);
      onServerUpdated?.({ ...activeServer, notificationLevel: level });
      toast(t("Notification settings updated"), "success");
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setNotifBusy(false);
      setMenuOpen(false);
    }
  };
  const canManageRoles = serverHasPermission(activeServer, "MANAGE_ROLES");
  const canCreateInvite = serverHasPermission(activeServer, "CREATE_INSTANT_INVITE");
  const canBanMembers = serverHasPermission(activeServer, "BAN_MEMBERS");
  const canViewAudit = serverHasPermission(activeServer, "VIEW_AUDIT_LOG");
  const canMoveMembers = serverHasPermission(activeServer, "MOVE_MEMBERS");
  const canMuteMembers = serverHasPermission(activeServer, "MUTE_MEMBERS");
  const [channelAccess, setChannelAccess] = useState(null); // channel
  const [voiceMenu, setVoiceMenu] = useState(null); // { user, channelId, x, y }
  const voiceStates = serverVoice?.voiceStatesByServer?.[activeServer?.id] || {};
  const participantStreams = serverVoice?.remoteStreams || null;
  const localVoiceStream = serverVoice?.localStream || null;
  const myVoiceUserId = serverVoice?.myUserId || null;
  const serverUnreadById = useMemo(() => {
    const map = {};
    for (const server of servers) {
      let sum = 0;
      for (const ch of server.channels || []) {
        if (ch.type !== "text") continue;
        sum += Number(channelUnread[ch.id]) || 0;
      }
      if (sum > 0) map[server.id] = sum;
    }
    return map;
  }, [servers, channelUnread]);
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

  const handleToggleChannelMute = (channelId) => {
    if (!channelId) return;
    toggleChannelMute(channelId);
    setMutedChannelTick((n) => n + 1);
    setChannelMenuId(null);
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
                {canManageGuild && (
                  <button
                    type="button"
                    className="server-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowSettings(true);
                    }}
                  >
                    <Settings2 size={15} />
                    {t("Server Settings")}
                  </button>
                )}
                {canManageGuild && (
                  <button
                    type="button"
                    className="server-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowCommunity(true);
                    }}
                  >
                    <ShieldCheck size={15} />
                    {t("Community & Discovery")}
                  </button>
                )}
                {canManageGuild && (
                  <button
                    type="button"
                    className="server-dropdown-item"
                    disabled={serverIconBusy}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Keep file dialog in the same user-gesture stack (iOS).
                      serverIconFileRef.current?.click();
                      setMenuOpen(false);
                    }}
                  >
                    <Camera size={15} />
                    {t("Change server icon")}
                  </button>
                )}
                <div className="server-dropdown-section">
                  <span className="server-dropdown-section-label">{t("Notification Settings")}</span>
                  {NOTIF_LEVELS.map((lvl) => {
                    const Icon = lvl.icon;
                    const active = notifLevel === lvl.value;
                    return (
                      <button
                        key={lvl.value}
                        type="button"
                        className={`server-dropdown-item${active ? " is-active" : ""}`}
                        disabled={notifBusy}
                        onClick={() => setNotificationLevel(lvl.value)}
                      >
                        <Icon size={15} />
                        <span>{t(lvl.label)}</span>
                        {active ? <Check size={14} className="server-dropdown-check" /> : null}
                      </button>
                    );
                  })}
                </div>
                {canBanMembers && (
                  <button
                    type="button"
                    className="server-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowModeration("bans");
                    }}
                  >
                    <Ban size={15} />
                    {t("Bans")}
                  </button>
                )}
                {canViewAudit && (
                  <button
                    type="button"
                    className="server-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowModeration("audit");
                    }}
                  >
                    <ScrollText size={15} />
                    {t("Audit log")}
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
                          voiceState={voiceStates[ch.id]}
                          joinedHere={serverVoice?.activeChannelId === ch.id}
                          participantStreams={participantStreams}
                          localStream={localVoiceStream}
                          myUserId={myVoiceUserId}
                          muted={ch.type === "text" ? isChannelMuted(ch.id) : false}
                          unread={ch.type === "text" ? channelUnread[ch.id] || 0 : 0}
                          muteTick={mutedChannelTick}
                          canManageRoles={canManageRoles}
                          canMoveMembers={canMoveMembers}
                          canMuteMembers={canMuteMembers}
                          voiceChannels={(activeServer?.channels || []).filter((c) => c.type === "voice" || c.type === "stage")}
                          serverVoice={serverVoice}
                          draggable={canManageChannels}
                          dragging={dragChannelId === ch.id}
                          dragOver={dragOverChannelId === ch.id}
                          onDragStartChannel={() => setDragChannelId(ch.id)}
                          onDragOverChannel={() => setDragOverChannelId(ch.id)}
                          onDragEndChannel={() => {
                            setDragChannelId(null);
                            setDragOverChannelId(null);
                          }}
                          onDropChannel={() => reorderChannelDrop(ch)}
                          onToggleMute={() => handleToggleChannelMute(ch.id)}
                          onOpenAccess={() => {
                            setChannelMenuId(null);
                            setChannelAccess(ch);
                          }}
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
                          onVoiceUserMenu={(user, channelId, event) => {
                            event?.preventDefault?.();
                            event?.stopPropagation?.();
                            setVoiceMenu({
                              user,
                              channelId,
                              x: event?.clientX || 0,
                              y: event?.clientY || 0,
                            });
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
                  draggable={canManageChannels}
                  dragging={dragChannelId === node.id}
                  dragOver={dragOverChannelId === node.id}
                  onDragStartChannel={() => setDragChannelId(node.id)}
                  onDragOverChannel={() => setDragOverChannelId(node.id)}
                  onDragEndChannel={() => {
                    setDragChannelId(null);
                    setDragOverChannelId(null);
                  }}
                  onDropChannel={() => reorderChannelDrop(node)}
                  voiceState={voiceStates[node.id]}
                  joinedHere={serverVoice?.activeChannelId === node.id}
                  participantStreams={participantStreams}
                  localStream={localVoiceStream}
                  myUserId={myVoiceUserId}
                  muted={node.type === "text" ? isChannelMuted(node.id) : false}
                  unread={node.type === "text" ? channelUnread[node.id] || 0 : 0}
                  muteTick={mutedChannelTick}
                  canManageRoles={canManageRoles}
                  canMoveMembers={canMoveMembers}
                  canMuteMembers={canMuteMembers}
                  voiceChannels={(activeServer?.channels || []).filter((c) => c.type === "voice" || c.type === "stage")}
                  serverVoice={serverVoice}
                  onToggleMute={() => handleToggleChannelMute(node.id)}
                  onOpenAccess={() => {
                    setChannelMenuId(null);
                    setChannelAccess(node);
                  }}
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
                  onVoiceUserMenu={(user, channelId, event) => {
                    event?.preventDefault?.();
                    event?.stopPropagation?.();
                    setVoiceMenu({
                      user,
                      channelId,
                      x: event?.clientX || 0,
                      y: event?.clientY || 0,
                    });
                  }}
                />
              );
            })}
            {channelTree.length === 0 && (
              <p className="server-empty-hint">{t("No channels yet.")}</p>
            )}
            <p className="server-step-hint">
              {t("Open a text channel to chat, or join a voice channel to hang out.")}
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
          {showCommunity && (
            <ServerCommunityModal
              server={activeServer}
              onClose={() => setShowCommunity(false)}
              onServerUpdated={(updated) => onServerUpdated?.(updated)}
            />
          )}
          {showSettings && (
            <ServerSettingsModal
              server={activeServer}
              onClose={() => setShowSettings(false)}
              onServerUpdated={(updated) => onServerUpdated?.(updated)}
            />
          )}
          {needsRulesAccept && (
            <ServerRulesModal
              server={activeServer}
              onAccepted={(rulesAcceptedAt) =>
                onServerUpdated?.({ ...activeServer, rulesAcceptedAt })
              }
            />
          )}
          {showModeration && (
            <ServerModerationModal
              server={activeServer}
              initialTab={showModeration}
              onClose={() => setShowModeration(null)}
            />
          )}
          {channelAccess && (
            <ChannelPermissionsModal
              server={activeServer}
              channel={channelAccess}
              onClose={() => setChannelAccess(null)}
            />
          )}
        </AnimatePresence>

        {voiceMenu && (canMoveMembers || canMuteMembers) && (
          <VoiceMemberContextMenu
            menu={voiceMenu}
            canMove={canMoveMembers}
            canMute={canMuteMembers}
            voiceChannels={(activeServer?.channels || []).filter((c) => c.type === "voice" || c.type === "stage")}
            serverId={activeServer?.id}
            serverVoice={serverVoice}
            onClose={() => setVoiceMenu(null)}
          />
        )}

        {/* Must live in the in-server tree — early return above skips the list-view inputs. */}
        <AnimatePresence>
          {serverIconCropSrc ? (
            <ImageCropModal
              key="edit-server-icon-crop-active"
              imageSrc={serverIconCropSrc}
              aspect={1}
              cropShape="rect"
              title={t("Adjust server icon")}
              confirmLabel={serverIconBusy ? t("Please wait...") : t("Save icon")}
              outputMimeType="image/jpeg"
              outputFileName="server-icon.jpg"
              maxOutputSize={512}
              onCancel={() => !serverIconBusy && setServerIconCropSrc("")}
              onConfirm={saveServerIconCrop}
            />
          ) : null}
        </AnimatePresence>
        <input
          ref={serverIconFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="server-hidden-file"
          tabIndex={-1}
          aria-hidden="true"
          onChange={pickServerIconFile}
        />
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
                <li
                  key={server.id}
                  className={`server-list-row-wrap${dragServerId === server.id ? " is-dragging" : ""}${
                    dragOverServerId === server.id ? " is-drag-over" : ""
                  }`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", server.id);
                    setDragServerId(server.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverServerId !== server.id) setDragOverServerId(server.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    reorderServerDrop(server);
                  }}
                  onDragEnd={() => {
                    setDragServerId(null);
                    setDragOverServerId(null);
                  }}
                >
                  <button
                    type="button"
                    className={`server-list-item${serverUnreadById[server.id] ? " has-unread" : ""}`}
                    onClick={() => {
                      if (dragServerId) return;
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
                    <span className="server-list-badge-slot">
                      <ServerUnreadBadge count={serverUnreadById[server.id] || 0} />
                    </span>
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
        {serverIconCropSrc ? (
          <ImageCropModal
            key="edit-server-icon-crop"
            imageSrc={serverIconCropSrc}
            aspect={1}
            cropShape="rect"
            title={t("Adjust server icon")}
            confirmLabel={serverIconBusy ? t("Please wait...") : t("Save icon")}
            outputMimeType="image/jpeg"
            outputFileName="server-icon.jpg"
            maxOutputSize={512}
            onCancel={() => !serverIconBusy && setServerIconCropSrc("")}
            onConfirm={saveServerIconCrop}
          />
        ) : null}
      </AnimatePresence>
      <input
        ref={serverIconFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="server-hidden-file"
        onChange={pickServerIconFile}
      />
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

function ServerUnreadBadge({ count }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  const label = n > 99 ? "99+" : String(n);
  return (
    <span className="server-unread-badge" aria-label={`${label} unread`}>
      {label}
    </span>
  );
}

function resolveMemberVoiceStream(member, { joinedHere, myUserId, localStream, participantStreams }) {
  if (!joinedHere || !member?.id) return null;
  const mid = String(member.id);
  if (myUserId != null && String(myUserId) === mid) return localStream || null;
  if (participantStreams?.get) {
    if (participantStreams.has(member.id)) return participantStreams.get(member.id);
    if (participantStreams.has(mid)) return participantStreams.get(mid);
    for (const [key, value] of participantStreams.entries()) {
      if (String(key) === mid) return value;
    }
  }
  return member.stream || null;
}

function ServerVoiceUserRow({ member, stream = null, size = 22, onContextMenu }) {
  const t = useT();
  const name = resolveDisplayName(member) || member?.username || "User";
  const speaking = useSpeaking(stream, {
    muted: Boolean(member?.muted || member?.serverMuted),
    threshold: 0.014,
    attackMs: 55,
    releaseMs: 260,
  });
  return (
    <li
      className={`server-voice-user${member?.muted || member?.serverMuted ? " is-muted" : ""}${speaking ? " is-speaking" : ""}`}
      title={member?.username || name}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        if (e.detail >= 2) onContextMenu?.(e);
      }}
    >
      <div className="server-voice-user-avatar-shell" aria-hidden={!speaking}>
        <div className={`server-voice-speak-ring ring-a${speaking ? " is-active" : ""}`} />
        <div className={`server-voice-speak-ring ring-b${speaking ? " is-active" : ""}`} />
        <Avatar
          name={name}
          size={size}
          user={member}
          animate="speaking"
          isSpeaking={speaking}
          className="server-voice-user-avatar"
        />
      </div>
      <span className="server-voice-user-name">{name}</span>
      {member?.stageRole === "speaker" ? (
        <span className="server-stage-speaker-badge">{t("Speaker")}</span>
      ) : null}
      {member?.requestedToSpeak ? (
        <span className="server-stage-request-badge">{t("Requested")}</span>
      ) : null}
      {member?.muted || member?.serverMuted ? (
        <MicOff size={12} className="server-voice-user-mic" aria-hidden />
      ) : null}
      {onContextMenu ? (
        <button
          type="button"
          className="icon-btn server-voice-user-more"
          title="…"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
        >
          <MoreHorizontal size={12} />
        </button>
      ) : null}
    </li>
  );
}

function VoiceMemberContextMenu({
  menu,
  canMove,
  canMute,
  voiceChannels = [],
  serverId,
  serverVoice,
  onClose,
}) {
  const t = useT();
  const { toast } = useToast();
  const [moveOpen, setMoveOpen] = useState(false);

  useEffect(() => {
    if (!menu?.user) return undefined;
    const onModError = (event) => {
      const message = event?.detail?.message;
      if (message) toast(message, "error");
    };
    window.addEventListener("descall:server-voice-mod-error", onModError);
    return () => window.removeEventListener("descall:server-voice-mod-error", onModError);
  }, [menu?.user, toast]);

  if (!menu?.user) return null;
  const user = menu.user;
  const channelId = menu.channelId;
  const currentChannel = voiceChannels.find((c) => c.id === channelId);
  const isStage = currentChannel?.type === "stage";
  const left = Math.min(menu.x || 12, (typeof window !== "undefined" ? window.innerWidth : 400) - 220);
  const top = Math.min(menu.y || 12, (typeof window !== "undefined" ? window.innerHeight : 400) - 280);

  return (
    <>
      <button type="button" className="server-voice-menu-backdrop" aria-label={t("Close")} onClick={onClose} />
      <div className="server-voice-member-menu" style={{ left, top }} role="menu">
        <div className="server-voice-member-menu-title">
          {resolveDisplayName(user) || user.username}
        </div>
        {canMute && (
          <button
            type="button"
            className="server-dropdown-item"
            onClick={() => {
              serverVoice?.serverMute?.(serverId, channelId, user.id, !user.serverMuted);
              onClose();
            }}
          >
            <MicOff size={14} />
            {user.serverMuted ? t("Server unmute") : t("Server mute")}
          </button>
        )}
        {canMove && isStage && (
          <button
            type="button"
            className="server-dropdown-item"
            onClick={() => {
              serverVoice?.setStageParticipantRole?.(
                serverId,
                channelId,
                user.id,
                user.stageRole === "speaker" ? "audience" : "speaker"
              );
              onClose();
            }}
          >
            <Radio size={14} />
            {user.stageRole === "speaker" ? t("Move to Audience") : t("Invite to Speak")}
          </button>
        )}
        {canMove && (
          <>
            <button
              type="button"
              className="server-dropdown-item danger"
              onClick={() => {
                serverVoice?.disconnectMember?.(serverId, channelId, user.id);
                onClose();
              }}
            >
              <PhoneOff size={14} />
              {t("Disconnect")}
            </button>
            <button
              type="button"
              className="server-dropdown-item"
              onClick={() => setMoveOpen((v) => !v)}
            >
              <ArrowRightLeft size={14} />
              {t("Move to…")}
            </button>
            {moveOpen &&
              voiceChannels
                .filter((c) => c.id !== channelId)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="server-dropdown-item nested"
                    onClick={() => {
                      serverVoice?.moveMember?.(serverId, user.id, channelId, c.id);
                      onClose();
                    }}
                  >
                    <Volume2 size={14} />
                    {c.name}
                  </button>
                ))}
          </>
        )}
      </div>
    </>
  );
}

function ChannelRow({
  channel,
  active,
  canManage,
  menuOpen,
  voiceState = null,
  joinedHere = false,
  participantStreams = null,
  localStream = null,
  myUserId = null,
  muted = false,
  unread = 0,
  muteTick = 0,
  canManageRoles = false,
  canMoveMembers = false,
  canMuteMembers = false,
  draggable = false,
  dragging = false,
  dragOver = false,
  onDragStartChannel,
  onDragOverChannel,
  onDragEndChannel,
  onDropChannel,
  onToggleMute,
  onOpenAccess,
  onOpenMenu,
  onCloseMenu,
  onSelect,
  onEdit,
  onDelete,
  onVoiceUserMenu,
}) {
  const t = useT();
  const isVoiceLike = channel.type === "voice" || channel.type === "stage";
  const Icon = channel.type === "stage" ? Radio : channel.type === "voice" ? Volume2 : Hash;
  const voiceMembers = isVoiceLike ? voiceState?.members || [] : [];
  const showMenu = canManage || canManageRoles || channel.type === "text";
  void muteTick;
  const unreadCount = Number(unread) || 0;
  const canModVoice = canMoveMembers || canMuteMembers;
  return (
    <div
      className={`server-channel-row-wrap ${active ? "active" : ""} ${joinedHere ? "is-joined-voice" : ""} ${muted ? "is-muted-channel" : ""} ${unreadCount > 0 ? "has-unread" : ""} ${dragging ? "is-dragging" : ""} ${dragOver ? "is-drag-over" : ""}`}
      draggable={Boolean(draggable)}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", channel.id);
        onDragStartChannel?.();
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverChannel?.();
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDropChannel?.();
      }}
      onDragEnd={() => onDragEndChannel?.()}
    >
      <button
        type="button"
        className={`server-channel-row ${active ? "active" : ""}`}
        title={channel.name}
        onClick={onSelect}
      >
        <Icon size={16} />
        <span>{channel.name}</span>
        {channel.nsfw ? (
          <span className="server-channel-nsfw" title={t("NSFW")} style={{ fontSize: 10, opacity: 0.75 }}>
            NSFW
          </span>
        ) : null}
        {muted ? <BellOff size={12} className="server-channel-mute-icon" aria-hidden /> : null}
        {isVoiceLike && voiceMembers.length > 0 && (
          <span className="server-voice-count">{voiceMembers.length}</span>
        )}
        {channel.type === "text" && unreadCount > 0 ? (
          <ServerUnreadBadge count={unreadCount} />
        ) : null}
      </button>
      {showMenu && (
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
                {channel.type === "text" && (
                  <button type="button" className="server-dropdown-item" onClick={onToggleMute}>
                    {muted ? <Bell size={14} /> : <BellOff size={14} />}
                    {muted ? t("Unmute channel") : t("Mute channel")}
                  </button>
                )}
                {canManageRoles && channel.type !== "category" && (
                  <button type="button" className="server-dropdown-item" onClick={onOpenAccess}>
                    <Lock size={14} />
                    {t("Channel access")}
                  </button>
                )}
                {canManage && (
                  <>
                    <button type="button" className="server-dropdown-item" onClick={onEdit}>
                      <Pencil size={14} />
                      {t("Edit channel")}
                    </button>
                    <button type="button" className="server-dropdown-item danger" onClick={onDelete}>
                      <Trash2 size={14} />
                      {t("Delete channel")}
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {isVoiceLike && voiceMembers.length > 0 && (
        <ul className="server-voice-user-list" aria-label={t("In this channel")}>
          {voiceMembers.slice(0, 12).map((m) => {
            const stream = resolveMemberVoiceStream(m, {
              joinedHere,
              myUserId,
              localStream,
              participantStreams,
            });
            return (
              <ServerVoiceUserRow
                key={m.id}
                member={m}
                stream={stream}
                onContextMenu={
                  canModVoice
                    ? (e) => onVoiceUserMenu?.(m, channel.id, e)
                    : undefined
                }
              />
            );
          })}
        </ul>
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
  const [slowmodeSeconds, setSlowmodeSeconds] = useState(
    isEdit ? Number(channel.slowmodeSeconds) || 0 : 0
  );
  const [nsfw, setNsfw] = useState(isEdit ? Boolean(channel.nsfw) : false);
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
      if (showTopic) payload.slowmodeSeconds = Math.max(0, Math.min(21600, Math.floor(Number(slowmodeSeconds) || 0)));
      if (showTopic) payload.nsfw = Boolean(nsfw);
      if (isEdit) {
        await onSubmit({
          name: payload.name,
          topic: showTopic ? payload.topic : undefined,
          parentId: showParent ? payload.parentId : undefined,
          slowmodeSeconds: showTopic ? payload.slowmodeSeconds : undefined,
          nsfw: showTopic ? payload.nsfw : undefined,
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
            : type === "stage"
              ? t("Stage channels are for one-to-many audio, video, and screenshare.")
              : t("Create text, voice, or stage channels for your server.")}
        </p>

        {!typeLocked && (
          <div className="server-type-toggle" role="group" aria-label={t("Channel type")}>
            {[
              { id: "text", label: t("Text"), Icon: Hash },
              { id: "voice", label: t("Voice"), Icon: Volume2 },
              { id: "stage", label: t("Stage"), Icon: Radio },
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
            placeholder={
              type === "text"
                ? "general"
                : type === "stage"
                  ? t("Town hall")
                  : type === "voice"
                    ? t("General")
                    : t("Text Channels")
            }
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
          <>
            <label className="server-field">
              <span>{t("Topic (optional)")}</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={1024}
                placeholder={t("What's this channel about?")}
              />
            </label>

            <label className="server-field">
              <span>{t("Slowmode")}</span>
              <input
                type="number"
                min="0"
                max="21600"
                step="1"
                value={Number(slowmodeSeconds) || 0}
                onChange={(e) => {
                  const next = Math.floor(Number(e.target.value));
                  setSlowmodeSeconds(Number.isFinite(next) ? Math.max(0, Math.min(21600, next)) : 0);
                }}
                placeholder="0"
              />
            </label>
            <p className="server-modal-sub" style={{ marginTop: -6, marginBottom: 10 }}>
              {Number(slowmodeSeconds) > 0
                ? t("Members must wait {time} between messages.", {
                    time:
                      Number(slowmodeSeconds) >= 3600
                        ? `${Math.round(Number(slowmodeSeconds) / 3600)}h`
                        : Number(slowmodeSeconds) >= 60
                          ? `${Math.round(Number(slowmodeSeconds) / 60)}m`
                          : `${Number(slowmodeSeconds)}s`,
                  })
                : t("Off — members can send freely.")}
            </p>
            <label className="server-check-row">
              <input
                type="checkbox"
                checked={Boolean(nsfw)}
                onChange={(e) => setNsfw(e.target.checked)}
              />
              <span>{t("Age-restricted (NSFW) channel")}</span>
            </label>
            <div className="server-slowmode-presets" role="group" aria-label={t("Slowmode presets")}>
              {[
                [0, t("Off")],
                [5, "5s"],
                [10, "10s"],
                [30, "30s"],
                [60, "1m"],
                [300, "5m"],
                [3600, "1h"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={Number(slowmodeSeconds) === value ? "active" : ""}
                  onClick={() => setSlowmodeSeconds(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
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

function TemplateIcon({ name, size = 22 }) {
  const Icon = TEMPLATE_ICONS[name] || Server;
  return <Icon size={size} strokeWidth={2.1} aria-hidden />;
}

function CreateServerModal({ onClose, onCreate, canCreate, maxOwned }) {
  const t = useT();
  /** path: choose → templates → details */
  const [step, setStep] = useState("choose");
  const [templateId, setTemplateId] = useState(null);
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [iconPreview, setIconPreview] = useState("");
  const [iconCropSrc, setIconCropSrc] = useState("");
  const [iconUploading, setIconUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const iconFileRef = useRef(null);

  const selected = getTemplateCard(templateId);

  const goDetails = (id) => {
    setTemplateId(id);
    setError("");
    setStep("details");
  };

  const onPickIconFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError(t("Icon must be JPG, PNG, WebP, or GIF."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(t("Icon must be 8 MB or smaller."));
      return;
    }
    setError("");
    try {
      // Still crop GIFs to a square icon (server icons are static).
      const dataUrl = await readFileAsDataUrl(file);
      setIconCropSrc(dataUrl);
    } catch {
      setError(t("Failed to read image."));
    }
  };

  const onCropIconConfirm = async (file) => {
    setIconUploading(true);
    setError("");
    try {
      const uploaded = await uploadFile(file);
      const url = uploaded?.url;
      if (!url) throw new Error(t("Upload failed"));
      setIconUrl(url);
      setIconPreview(url);
      setIconCropSrc("");
    } catch (err) {
      setError(err?.message || t("Upload failed"));
    } finally {
      setIconUploading(false);
    }
  };

  const clearIcon = () => {
    setIconUrl("");
    setIconPreview("");
  };

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
    if (!templateId) {
      setError(t("Pick a template or start from scratch."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate({
        name: trimmed,
        iconUrl: iconUrl.trim() || undefined,
        templateId,
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
      <motion.div
        className={`server-modal server-create-wizard${step === "templates" ? " is-wide" : ""}`}
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-server-title"
      >
        {step === "choose" && (
          <>
            <h3 id="create-server-title">{t("Create a server")}</h3>
            <p className="server-modal-lead">
              {t("Choose a ready-made advanced template, or start from scratch and build everything yourself.")}
            </p>
            <div className="server-create-path-grid">
              <button
                type="button"
                className="server-create-path"
                onClick={() => {
                  setError("");
                  setStep("templates");
                }}
              >
                <span className="server-create-path-icon" style={{ "--tpl-accent": "#38bdf8" }}>
                  <Layers size={22} />
                </span>
                <span className="server-create-path-body">
                  <strong>{t("Use a template")}</strong>
                  <span>
                    {t("Roles, text & voice channels, topics, slowmode, and permission overrides — fully prepared.")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="server-create-path"
                onClick={() => goDetails("blank")}
              >
                <span className="server-create-path-icon" style={{ "--tpl-accent": BLANK_TEMPLATE.accent }}>
                  <Sparkles size={22} />
                </span>
                <span className="server-create-path-body">
                  <strong>{t("Start from scratch")}</strong>
                  <span>{t("Empty server with only @everyone. Add channels and roles yourself.")}</span>
                </span>
              </button>
            </div>
            <div className="server-modal-actions">
              <button type="button" className="server-ghost-btn" onClick={onClose}>
                {t("Cancel")}
              </button>
            </div>
          </>
        )}

        {step === "templates" && (
          <>
            <div className="server-modal-head">
              <div>
                <h3 id="create-server-title">{t("Pick a template")}</h3>
                <p className="server-modal-sub">
                  {t("Each template includes roles, categories, text/voice channels, and staff permissions.")}
                </p>
              </div>
              <button type="button" className="server-icon-btn" onClick={onClose} aria-label={t("Close")}>
                <X size={18} />
              </button>
            </div>
            <div className="server-template-grid">
              {SERVER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="server-template-card"
                  style={{ "--tpl-accent": tpl.accent }}
                  onClick={() => goDetails(tpl.id)}
                >
                  <span className="server-template-card-icon">
                    <TemplateIcon name={tpl.icon} />
                  </span>
                  <span className="server-template-card-title">{t(tpl.name)}</span>
                  <span className="server-template-card-desc">{t(tpl.description)}</span>
                  <span className="server-template-card-meta">
                    <span>
                      <Shield size={12} /> {tpl.roleCount} {t("roles")}
                    </span>
                    <span>
                      <Hash size={12} /> {tpl.channelCount} {t("channels")}
                    </span>
                  </span>
                  <span className="server-template-card-tags">
                    {tpl.highlights.map((h) => (
                      <span key={h}>{t(h)}</span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
            <div className="server-modal-actions server-modal-actions-spread">
              <button type="button" className="server-ghost-btn" onClick={() => setStep("choose")}>
                {t("Back")}
              </button>
              <button type="button" className="server-ghost-btn" onClick={() => goDetails("blank")}>
                {t("Start from scratch")}
              </button>
            </div>
          </>
        )}

        {step === "details" && (
          <form onSubmit={submit}>
            <div className="server-modal-head">
              <div>
                <h3 id="create-server-title">{t("Customize your server")}</h3>
                <p className="server-modal-sub">
                  {selected
                    ? t("Template: {name}", { name: t(selected.name) })
                    : t("Start from scratch")}
                </p>
              </div>
              <button type="button" className="server-icon-btn" onClick={onClose} aria-label={t("Close")}>
                <X size={18} />
              </button>
            </div>
            {selected && selected.id !== "blank" && (
              <div className="server-template-selected" style={{ "--tpl-accent": selected.accent }}>
                <span className="server-template-card-icon">
                  <TemplateIcon name={selected.icon} />
                </span>
                <div>
                  <strong>{t(selected.name)}</strong>
                  <p>
                    {selected.roleCount} {t("roles")} · {selected.channelCount} {t("channels")} ·{" "}
                    {selected.categoryCount} {t("categories")}
                  </p>
                </div>
              </div>
            )}
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
            <div className="server-field">
              <span>{t("Server icon")}</span>
              <div className="server-icon-picker">
                <button
                  type="button"
                  className="server-icon-picker-preview"
                  onClick={() => !iconUploading && iconFileRef.current?.click()}
                  disabled={busy || iconUploading}
                  aria-label={t("Choose server icon")}
                >
                  {iconPreview || iconUrl ? (
                    <img src={iconPreview || iconUrl} alt="" />
                  ) : (
                    <ImagePlus size={22} />
                  )}
                  <span className="server-icon-picker-overlay">
                    {iconUploading ? <RefreshCw size={16} className="server-spin" /> : <Camera size={16} />}
                  </span>
                </button>
                <div className="server-icon-picker-actions">
                  <button
                    type="button"
                    className="server-primary-btn"
                    onClick={() => iconFileRef.current?.click()}
                    disabled={busy || iconUploading}
                  >
                    <Upload size={14} />
                    {iconUploading ? t("Uploading…") : t("Choose from gallery")}
                  </button>
                  {(iconPreview || iconUrl) && (
                    <button type="button" className="server-ghost-btn" onClick={clearIcon} disabled={busy || iconUploading}>
                      {t("Remove")}
                    </button>
                  )}
                  <span className="server-icon-picker-hint">
                    {t("Pick a photo, then zoom and crop. JPG, PNG, WebP or GIF · Max 8 MB")}
                  </span>
                </div>
                <input
                  ref={iconFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="server-hidden-file"
                  onChange={onPickIconFile}
                />
              </div>
            </div>
            {error && <p className="server-modal-error">{error}</p>}
            <div className="server-modal-actions server-modal-actions-spread">
              <button
                type="button"
                className="server-ghost-btn"
                onClick={() => setStep(templateId === "blank" ? "choose" : "templates")}
                disabled={busy || iconUploading}
              >
                {t("Back")}
              </button>
              <button
                type="submit"
                className="server-primary-btn"
                disabled={busy || iconUploading || name.trim().length < 2}
              >
                {busy ? t("Please wait...") : t("Create")}
              </button>
            </div>
          </form>
        )}
      </motion.div>
      <AnimatePresence>
        {iconCropSrc ? (
          <ImageCropModal
            key="server-icon-crop"
            imageSrc={iconCropSrc}
            aspect={1}
            cropShape="rect"
            title={t("Adjust server icon")}
            confirmLabel={t("Use photo")}
            outputMimeType="image/jpeg"
            outputFileName="server-icon.jpg"
            maxOutputSize={512}
            onCancel={() => setIconCropSrc("")}
            onConfirm={onCropIconConfirm}
          />
        ) : null}
      </AnimatePresence>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, MoreHorizontal, MessageSquare, User, Copy, Shield, UserX, Ban, Search, X, Pencil, Timer } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import AdminBadge from "../social/AdminBadge";
import { getPresenceStatus, STATUS_META, isVisiblyOnline } from "../../lib/presence";
import { resolveDisplayName } from "../../lib/userProfile";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import {
  getServerMembers,
  getServerRoles,
  assignMemberRole,
  removeMemberRole,
  kickServerMember,
  banServerMember,
  updateMemberNickname,
  timeoutServerMember,
  removeServerMemberTimeout,
} from "../../api/servers";
import { serverHasPermission } from "../../lib/serverPermissions";

function colorToHex(color) {
  const n = Math.max(0, Math.min(0xffffff, Number(color) || 0));
  if (!n) return null;
  return `#${n.toString(16).padStart(6, "0")}`;
}

function topRoleColor(member, roles) {
  const ids = new Set((member.roleIds || []).map(String));
  const colored = (roles || [])
    .filter((r) => !r.isEveryone && ids.has(String(r.id)) && Number(r.color) > 0)
    .sort((a, b) => (b.position || 0) - (a.position || 0));
  return colored[0] ? colorToHex(colored[0].color) : null;
}

/**
 * Discord-like server member list with search + context menu.
 */
export default function ServerMembersPanel({
  server,
  me,
  friends = [],
  onlineUsers,
  onClose,
  onOpenProfile,
  onStartDm,
}) {
  const t = useT();
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState(() => server?.roles || []);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(null); // { member, x, y }
  const [roleSubmenu, setRoleSubmenu] = useState(false);
  const [timeoutSubmenu, setTimeoutSubmenu] = useState(false);
  const [nickTarget, setNickTarget] = useState(null);
  const [nickDraft, setNickDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  const canManageRoles = serverHasPermission(server, "MANAGE_ROLES");
  const canKick = serverHasPermission(server, "KICK_MEMBERS");
  const canBan = serverHasPermission(server, "BAN_MEMBERS");
  const canTimeout = serverHasPermission(server, "MODERATE_MEMBERS");
  const canChangeOwnNick = serverHasPermission(server, "CHANGE_NICKNAME");
  const canManageNicknames = serverHasPermission(server, "MANAGE_NICKNAMES");
  const actorHighestPosition = Number(server?.myPermissions?.highestPosition) || 0;
  const assignableRoles = useMemo(
    () => roles.filter((r) => !r.isEveryone && (server?.isOwner || (Number(r.position) || 0) < actorHighestPosition)),
    [roles, server?.isOwner, actorHighestPosition]
  );
  const friendIds = useMemo(
    () => new Set((friends || []).map((f) => String(f.id))),
    [friends]
  );

  const load = async () => {
    if (!server?.id) return;
    setLoading(true);
    try {
      const [membersData, rolesData] = await Promise.all([
        getServerMembers(server.id),
        Array.isArray(server?.roles) && server.roles.length
          ? Promise.resolve({ roles: server.roles })
          : getServerRoles(server.id).catch(() => ({ roles: server?.roles || [] })),
      ]);
      setMembers(membersData?.members || []);
      setRoles(rolesData?.roles || server?.roles || []);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRoles(server?.roles || []);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id]);

  useEffect(() => {
    if (!server?.id) return undefined;
    const onRemoved = (e) => {
      const { serverId, userId } = e?.detail || {};
      if (!serverId || !userId) return;
      if (String(serverId) !== String(server.id)) return;
      setMembers((prev) => prev.filter((m) => String(m.userId) !== String(userId)));
      setMenu((prev) =>
        prev && String(prev.member?.userId) === String(userId) ? null : prev
      );
    };
    const onJoined = (e) => {
      const { serverId, member } = e?.detail || {};
      if (!serverId || !member?.userId) return;
      if (String(serverId) !== String(server.id)) return;
      setMembers((prev) => {
        if (prev.some((m) => String(m.userId) === String(member.userId))) return prev;
        return [...prev, member];
      });
    };
    const onUpdated = (e) => {
      const { serverId, member } = e?.detail || {};
      if (!serverId || !member?.userId) return;
      if (String(serverId) !== String(server.id)) return;
      setMembers((prev) =>
        prev.map((m) =>
          String(m.userId) === String(member.userId) ? { ...m, ...member } : m
        )
      );
    };
    const onRolesChanged = (e) => {
      const { serverId, userId, roleId, action } = e?.detail || {};
      if (!serverId || !userId || !roleId) return;
      if (String(serverId) !== String(server.id)) return;
      setMembers((prev) =>
        prev.map((m) => {
          if (String(m.userId) !== String(userId)) return m;
          const roleIds = Array.isArray(m.roleIds) ? m.roleIds.slice() : [];
          const rid = String(roleId);
          const has = roleIds.some((id) => String(id) === rid);
          if (action === "add" && !has) roleIds.push(roleId);
          if (action === "remove" && has) {
            return { ...m, roleIds: roleIds.filter((id) => String(id) !== rid) };
          }
          return { ...m, roleIds };
        })
      );
    };
    window.addEventListener("descall:server-member-removed", onRemoved);
    window.addEventListener("descall:server-member-joined", onJoined);
    window.addEventListener("descall:server-member-updated", onUpdated);
    window.addEventListener("descall:server-member-roles-changed", onRolesChanged);
    return () => {
      window.removeEventListener("descall:server-member-removed", onRemoved);
      window.removeEventListener("descall:server-member-joined", onJoined);
      window.removeEventListener("descall:server-member-updated", onUpdated);
      window.removeEventListener("descall:server-member-roles-changed", onRolesChanged);
    };
  }, [server?.id]);

  useEffect(() => {
    if (Array.isArray(server?.roles)) setRoles(server.roles);
  }, [server?.roles]);

  useEffect(() => {
    if (!menu) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenu(null);
        setRoleSubmenu(false);
        setTimeoutSubmenu(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenu(null);
        setRoleSubmenu(false);
        setTimeoutSubmenu(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const decorated = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members || [])
      .map((m) => {
        const user = {
          id: m.userId,
          username: m.username,
          displayName: m.nickname || m.displayName,
          display_name: m.nickname || m.displayName,
          avatarUrl: m.avatarUrl,
          avatar_url: m.avatarUrl,
        };
        const status = getPresenceStatus(onlineUsers, m.userId);
        return {
          ...m,
          user,
          _status: status,
          _online: isVisiblyOnline(onlineUsers, m.userId),
          _name: resolveDisplayName(user),
          _color: topRoleColor(m, roles),
        };
      })
      .filter((m) => {
        if (!q) return true;
        return (
          m._name.toLowerCase().includes(q) ||
          String(m.username || "").toLowerCase().includes(q)
        );
      });
  }, [members, onlineUsers, query, roles]);

  const hoistRoles = useMemo(
    () =>
      (roles || [])
        .filter((r) => r.hoist && !r.isEveryone)
        .sort((a, b) => (b.position || 0) - (a.position || 0)),
    [roles]
  );

  const memberSections = useMemo(() => {
    const sortMembers = (list) =>
      [...list].sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a._name.localeCompare(b._name));

    const onlineList = sortMembers(decorated.filter((m) => m._online));
    const offlineList = sortMembers(decorated.filter((m) => !m._online));

    const getHighestHoistRole = (member) => {
      const ids = new Set((member.roleIds || []).map(String));
      return hoistRoles.find((r) => ids.has(String(r.id))) || null;
    };

    const byRole = new Map();
    const noHoist = [];
    for (const m of onlineList) {
      const role = getHighestHoistRole(m);
      if (role) {
        if (!byRole.has(role.id)) byRole.set(role.id, []);
        byRole.get(role.id).push(m);
      } else {
        noHoist.push(m);
      }
    }

    const sections = [];
    const hasHoistGroups = hoistRoles.length > 0 && byRole.size > 0;

    if (!hasHoistGroups) {
      if (onlineList.length) {
        sections.push({
          key: "online",
          label: t("Online — {count}", { count: onlineList.length }),
          members: onlineList,
        });
      }
    } else {
      for (const role of hoistRoles) {
        const membersInRole = byRole.get(role.id);
        if (!membersInRole?.length) continue;
        sections.push({
          key: role.id,
          label: role.name,
          members: membersInRole,
          roleColor: colorToHex(role.color),
        });
      }
      if (noHoist.length) {
        sections.push({
          key: "online-no-hoist",
          label: t("Online — {count}", { count: noHoist.length }),
          members: noHoist,
        });
      }
    }

    return { sections, offline: offlineList };
  }, [decorated, hoistRoles, t]);

  const openMenu = (e, member) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setRoleSubmenu(false);
    setTimeoutSubmenu(false);
    setMenu({
      member,
      x: Math.min(rect.left, window.innerWidth - 220),
      y: Math.min(rect.bottom + 4, window.innerHeight - 360),
    });
  };

  const copyUsername = async (member) => {
    const text = member.username ? `@${member.username}` : member._name;
    try {
      await navigator.clipboard.writeText(text);
      toast(t("Copied"), "success");
    } catch {
      toast(t("Something went wrong."), "error");
    }
    setMenu(null);
  };

  const toggleRole = async (member, roleId, hasRole) => {
    if (!server?.id) return;
    setBusy(true);
    try {
      if (hasRole) await removeMemberRole(server.id, member.userId, roleId);
      else await assignMemberRole(server.id, member.userId, roleId);
      setMembers((prev) =>
        prev.map((m) => {
          if (String(m.userId) !== String(member.userId)) return m;
          const roleIds = new Set((m.roleIds || []).map(String));
          if (hasRole) roleIds.delete(String(roleId));
          else roleIds.add(String(roleId));
          const highestPosition = [...roleIds].reduce((top, id) => {
            const role = roles.find((r) => String(r.id) === String(id));
            return Math.max(top, Number(role?.position) || 0);
          }, 0);
          return { ...m, roleIds: [...roleIds], highestPosition };
        })
      );
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const canActOn = (member) => {
    if (!member || member.isOwner) return false;
    if (server?.isOwner) return true;
    return actorHighestPosition > (Number(member.highestPosition) || 0);
  };

  const openNicknameModal = (member) => {
    setNickTarget(member);
    setNickDraft(member.nickname || "");
    setMenu(null);
    setRoleSubmenu(false);
    setTimeoutSubmenu(false);
  };

  const saveNickname = async (e) => {
    e.preventDefault();
    if (!server?.id || !nickTarget) return;
    setBusy(true);
    try {
      const nickname = nickDraft.trim() || null;
      await updateMemberNickname(server.id, nickTarget.userId, nickname);
      setMembers((prev) =>
        prev.map((m) =>
          String(m.userId) === String(nickTarget.userId)
            ? { ...m, nickname, _name: nickname || m.displayName || m.username || m.userId }
            : m
        )
      );
      toast(nickname ? t("Nickname updated") : t("Nickname cleared"), "success");
      setNickTarget(null);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const timeoutMember = async (member, durationSeconds) => {
    if (!server?.id) return;
    const reason = window.prompt(t("Reason (optional)"), "");
    if (reason === null) return;
    setBusy(true);
    try {
      const { timeout } = await timeoutServerMember(server.id, member.userId, {
        durationSeconds,
        reason: reason.trim() || undefined,
      });
      setMembers((prev) =>
        prev.map((m) =>
          String(m.userId) === String(member.userId)
            ? { ...m, timeoutUntil: timeout.until, timeoutReason: timeout.reason || null }
            : m
        )
      );
      toast(t("Member timed out"), "success");
      setMenu(null);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const timeoutCustom = async (member) => {
    const raw = window.prompt(t("Timeout duration in seconds (1–2419200)"), "300");
    if (raw === null) return;
    const seconds = Math.max(1, Math.min(2419200, Math.floor(Number(raw) || 0)));
    if (!seconds) {
      toast(t("Invalid duration"), "error");
      return;
    }
    await timeoutMember(member, seconds);
  };

  const removeTimeout = async (member) => {
    if (!server?.id) return;
    setBusy(true);
    try {
      await removeServerMemberTimeout(server.id, member.userId);
      setMembers((prev) =>
        prev.map((m) =>
          String(m.userId) === String(member.userId)
            ? { ...m, timeoutUntil: null, timeoutReason: null }
            : m
        )
      );
      toast(t("Timeout removed"), "success");
      setMenu(null);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const kick = async (member) => {
    if (!server?.id) return;
    if (!window.confirm(t("Kick {name} from this server?", { name: member._name }))) return;
    setBusy(true);
    try {
      await kickServerMember(server.id, member.userId);
      setMembers((prev) => prev.filter((m) => String(m.userId) !== String(member.userId)));
      toast(t("Member kicked"), "success");
      setMenu(null);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const ban = async (member) => {
    if (!server?.id) return;
    const reason = window.prompt(
      t("Ban {name} from this server? Optional reason:", { name: member._name }),
      ""
    );
    if (reason === null) return;
    setBusy(true);
    try {
      await banServerMember(server.id, member.userId, reason.trim() || undefined);
      setMembers((prev) => prev.filter((m) => String(m.userId) !== String(member.userId)));
      toast(t("Member banned"), "success");
      setMenu(null);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (m) => (
    <button
      key={m.userId}
      type="button"
      className={`member-row server-member-row${m._online ? "" : " is-offline"}`}
      onClick={(e) => openMenu(e, m)}
      onContextMenu={(e) => openMenu(e, m)}
    >
      <div className="member-avatar-wrap">
        <Avatar name={m._name} size={36} user={m.user} />
        <StatusBadge status={m._status} />
      </div>
      <div className="member-meta">
        <div className="member-name-row">
          <span className="member-name" style={m._color ? { color: m._color } : undefined}>
            {m._name}
          </span>
          <AdminBadge user={m.user} variant="inline" />
          {m.isOwner && (
            <span className="member-owner-badge" title={t("Owner")}>
              <Crown size={11} strokeWidth={2.25} aria-hidden="true" />
              <span className="member-owner-text">{t("Owner")}</span>
            </span>
          )}
        </div>
        <span className="member-status-label">{t(STATUS_META[m._status]?.label || "Offline")}</span>
        {m.timeoutUntil && new Date(m.timeoutUntil) > new Date() && (
          <span className="member-timeout-label">{t("Timed out")}</span>
        )}
      </div>
      <MoreHorizontal size={16} className="server-member-row-more" aria-hidden />
    </button>
  );

  const menuMember = menu?.member;
  const isSelf = menuMember && me?.id && String(menuMember.userId) === String(me.id);
  const isFriend = menuMember && friendIds.has(String(menuMember.userId));
  const canModerateMenuMember = menuMember && !isSelf && canActOn(menuMember);
  const canEditMenuNick = menuMember && ((isSelf && canChangeOwnNick) || (!isSelf && canManageNicknames && canActOn(menuMember)));

  return (
    <>
      <div className="members-panel-header">
        <h4>
          {t("Members")}
          <span className="members-panel-count">{decorated.length}</span>
        </h4>
        <button type="button" className="icon-btn" onClick={onClose} title={t("Close")} aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>

      <div className="server-members-search">
        <Search size={14} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search members")}
          aria-label={t("Search members")}
        />
      </div>

      <div className="members-panel-scroll">
        {loading ? (
          <p className="members-empty">{t("Loading…")}</p>
        ) : (
          <>
            {memberSections.sections.map((section) => (
              <section key={section.key} className="members-section">
                <h5
                  className="members-section-label"
                  style={section.roleColor ? { color: section.roleColor } : undefined}
                >
                  {section.label}
                </h5>
                <div className="members-section-list">{section.members.map(renderRow)}</div>
              </section>
            ))}
            {memberSections.offline.length > 0 && (
              <section className="members-section">
                <h5 className="members-section-label">
                  {t("Offline — {count}", { count: memberSections.offline.length })}
                </h5>
                <div className="members-section-list">{memberSections.offline.map(renderRow)}</div>
              </section>
            )}
            {decorated.length === 0 && <p className="members-empty">{t("No members")}</p>}
          </>
        )}
      </div>

      {menuMember && (
        <div
          ref={menuRef}
          className="server-member-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            className="server-dropdown-item"
            onClick={() => {
              onOpenProfile?.(menuMember.user);
              setMenu(null);
            }}
          >
            <User size={14} />
            {t("View profile")}
          </button>
          {!isSelf && isFriend && (
            <button
              type="button"
              className="server-dropdown-item"
              onClick={() => {
                onStartDm?.(menuMember.user);
                setMenu(null);
                onClose?.();
              }}
            >
              <MessageSquare size={14} />
              {t("Message")}
            </button>
          )}
          <button type="button" className="server-dropdown-item" onClick={() => copyUsername(menuMember)}>
            <Copy size={14} />
            {t("Copy username")}
          </button>
          {canEditMenuNick && (
            <button type="button" className="server-dropdown-item" onClick={() => openNicknameModal(menuMember)}>
              <Pencil size={14} />
              {isSelf ? t("Change nickname") : t("Change member nickname")}
            </button>
          )}
          {canManageRoles && assignableRoles.length > 0 && canModerateMenuMember && (
            <>
              <button
                type="button"
                className="server-dropdown-item"
                onClick={() => setRoleSubmenu((v) => !v)}
              >
                <Shield size={14} />
                {t("Roles")}
              </button>
              {roleSubmenu && (
                <div className="server-member-role-submenu">
                  {assignableRoles.map((role) => {
                    const has = (menuMember.roleIds || []).map(String).includes(String(role.id));
                    return (
                      <button
                        key={role.id}
                        type="button"
                        className={`server-dropdown-item ${has ? "active" : ""}`}
                        disabled={busy}
                        onClick={() => toggleRole(menuMember, role.id, has)}
                      >
                        <span
                          className="server-role-dot"
                          style={{ background: colorToHex(role.color) || "var(--text-muted)" }}
                        />
                        {role.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {canTimeout && canModerateMenuMember && (
            <>
              <button
                type="button"
                className="server-dropdown-item"
                onClick={() => setTimeoutSubmenu((v) => !v)}
              >
                <Timer size={14} />
                {t("Timeout")}
              </button>
              {timeoutSubmenu && (
                <div className="server-member-role-submenu">
                  {[
                    [60, "60s"],
                    [300, "5m"],
                    [3600, "1h"],
                    [86400, "1d"],
                    [604800, "1w"],
                  ].map(([seconds, label]) => (
                    <button
                      key={seconds}
                      type="button"
                      className="server-dropdown-item"
                      disabled={busy}
                      onClick={() => timeoutMember(menuMember, seconds)}
                    >
                      {label}
                    </button>
                  ))}
                  <button type="button" className="server-dropdown-item" disabled={busy} onClick={() => timeoutCustom(menuMember)}>
                    {t("Custom…")}
                  </button>
                  {menuMember.timeoutUntil && (
                    <button type="button" className="server-dropdown-item" disabled={busy} onClick={() => removeTimeout(menuMember)}>
                      {t("Remove timeout")}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {canKick && canModerateMenuMember && (
            <button
              type="button"
              className="server-dropdown-item danger"
              disabled={busy}
              onClick={() => kick(menuMember)}
            >
              <UserX size={14} />
              {t("Kick")}
            </button>
          )}
          {canBan && canModerateMenuMember && (
            <button
              type="button"
              className="server-dropdown-item danger"
              disabled={busy}
              onClick={() => ban(menuMember)}
            >
              <Ban size={14} />
              {t("Ban")}
            </button>
          )}
        </div>
      )}
      {nickTarget && (
        <div className="server-modal-overlay" onClick={() => setNickTarget(null)}>
          <form className="server-modal server-nickname-modal" onSubmit={saveNickname} onClick={(e) => e.stopPropagation()}>
            <h3>{t("Change nickname")}</h3>
            <p className="server-modal-lead">
              {t("Set a server-specific display name for {name}. Leave blank to clear.", {
                name: nickTarget._name,
              })}
            </p>
            <label className="server-field">
              <span>{t("Nickname")}</span>
              <input
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                maxLength={32}
                autoFocus
                placeholder={nickTarget.displayName || nickTarget.username || ""}
              />
            </label>
            <div className="server-modal-actions">
              <button type="button" className="server-ghost-btn" disabled={busy} onClick={() => setNickTarget(null)}>
                {t("Cancel")}
              </button>
              <button type="submit" className="server-primary-btn" disabled={busy}>
                {busy ? t("Please wait...") : t("Save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

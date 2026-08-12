import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, MoreHorizontal, MessageSquare, User, Copy, Shield, UserX, Ban, Search, X } from "lucide-react";
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
} from "../../api/servers";

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
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  const flags = server?.myPermissions?.flags || {};
  const canManageRoles = Boolean(server?.isOwner || flags.MANAGE_ROLES || flags.ADMINISTRATOR);
  const canKick = Boolean(server?.isOwner || flags.KICK_MEMBERS || flags.ADMINISTRATOR);
  const canBan = Boolean(server?.isOwner || flags.BAN_MEMBERS || flags.ADMINISTRATOR);
  const assignableRoles = useMemo(() => roles.filter((r) => !r.isEveryone), [roles]);
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
    if (Array.isArray(server?.roles)) setRoles(server.roles);
  }, [server?.roles]);

  useEffect(() => {
    if (!menu) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenu(null);
        setRoleSubmenu(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenu(null);
        setRoleSubmenu(false);
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

  const online = decorated
    .filter((m) => m._online)
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a._name.localeCompare(b._name));
  const offline = decorated
    .filter((m) => !m._online)
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a._name.localeCompare(b._name));

  const openMenu = (e, member) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setRoleSubmenu(false);
    setMenu({
      member,
      x: Math.min(rect.left, window.innerWidth - 220),
      y: Math.min(rect.bottom + 4, window.innerHeight - 280),
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
          return { ...m, roleIds: [...roleIds] };
        })
      );
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
      </div>
      <MoreHorizontal size={16} className="server-member-row-more" aria-hidden />
    </button>
  );

  const menuMember = menu?.member;
  const isSelf = menuMember && me?.id && String(menuMember.userId) === String(me.id);
  const isFriend = menuMember && friendIds.has(String(menuMember.userId));

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
            {online.length > 0 && (
              <section className="members-section">
                <h5 className="members-section-label">
                  {t("Online — {count}", { count: online.length })}
                </h5>
                <div className="members-section-list">{online.map(renderRow)}</div>
              </section>
            )}
            {offline.length > 0 && (
              <section className="members-section">
                <h5 className="members-section-label">
                  {t("Offline — {count}", { count: offline.length })}
                </h5>
                <div className="members-section-list">{offline.map(renderRow)}</div>
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
          {canManageRoles && assignableRoles.length > 0 && !menuMember.isOwner && (
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
          {canKick && !isSelf && !menuMember.isOwner && (
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
          {canBan && !isSelf && !menuMember.isOwner && (
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
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Shield, Trash2, X, Users } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import {
  getServerRoles,
  createServerRole,
  updateServerRole,
  deleteServerRole,
  getServerMembers,
  assignMemberRole,
  removeMemberRole,
} from "../../api/servers";
import { permissionsToFlagMap } from "../../lib/serverPermissions";
import ServerMemberRoleAssign from "./ServerMemberRoleAssign";

const PRESET_COLORS = [
  0x5865f2, 0x57f287, 0xfee75c, 0xed4245, 0xeb459e, 0xf47b67, 0x3ba55d, 0x3498db, 0x9b59b6, 0x95a5a6,
];

const PERM_LABELS = {
  VIEW_CHANNEL: "View channels",
  SEND_MESSAGES: "Send messages",
  MANAGE_MESSAGES: "Manage messages",
  MANAGE_CHANNELS: "Manage channels",
  MANAGE_GUILD: "Manage server",
  MANAGE_ROLES: "Manage roles",
  USE_APPLICATION_COMMANDS: "Use app commands",
  KICK_MEMBERS: "Kick members",
  BAN_MEMBERS: "Ban members",
  MODERATE_MEMBERS: "Timeout members",
  CHANGE_NICKNAME: "Change own nickname",
  MANAGE_NICKNAMES: "Manage nicknames",
  VIEW_AUDIT_LOG: "View audit log",
  VIEW_GUILD_INSIGHTS: "View Server Insights",
  CREATE_INSTANT_INVITE: "Create invite",
  MENTION_EVERYONE: "Mention @everyone",
  ATTACH_FILES: "Attach files",
  EMBED_LINKS: "Embed links",
  ADD_REACTIONS: "Add reactions",
  READ_MESSAGE_HISTORY: "Read message history",
  CONNECT: "Connect (voice)",
  SPEAK: "Speak",
  REQUEST_TO_SPEAK: "Request to Speak",
  PRIORITY_SPEAKER: "Priority speaker",
  STREAM: "Video / stream",
  MUTE_MEMBERS: "Mute members",
  DEAFEN_MEMBERS: "Deafen members",
  MOVE_MEMBERS: "Move members",
  ADMINISTRATOR: "Administrator",
};

function colorToHex(color) {
  const n = Math.max(0, Math.min(0xffffff, Number(color) || 0));
  return `#${n.toString(16).padStart(6, "0")}`;
}

function hexToColor(hex) {
  const cleaned = String(hex || "").replace("#", "").trim();
  const n = parseInt(cleaned, 16);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Owner roles manager — list / create / edit / delete + member assign.
 */
export default function ServerRolesModal({ server, onClose, onRolesChanged }) {
  const t = useT();
  const [roles, setRoles] = useState(server?.roles || []);
  const [editableKeys, setEditableKeys] = useState(Object.keys(PERM_LABELS));
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("roles"); // roles | members
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [dragRoleId, setDragRoleId] = useState(null);
  const [dragOverRoleId, setDragOverRoleId] = useState(null);

  const { customRoles, everyoneRole } = useMemo(() => {
    const sorted = [...roles].sort((a, b) => (b.position || 0) - (a.position || 0));
    return {
      customRoles: sorted.filter((r) => !r.isEveryone),
      everyoneRole: sorted.find((r) => r.isEveryone) || null,
    };
  }, [roles]);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) || null,
    [roles, selectedId]
  );

  const load = async () => {
    if (!server?.id) return;
    setError("");
    try {
      const [rolesRes, membersRes] = await Promise.all([
        getServerRoles(server.id),
        getServerMembers(server.id),
      ]);
      const nextRoles = rolesRes?.roles || [];
      setRoles(nextRoles);
      if (rolesRes?.editablePermissions?.length) setEditableKeys(rolesRes.editablePermissions);
      setMembers(membersRes?.members || []);
      onRolesChanged?.(nextRoles);
      if (!selectedId && nextRoles.length) {
        const firstCustom = nextRoles.find((r) => !r.isEveryone) || nextRoles[0];
        setSelectedId(firstCustom.id);
      }
    } catch (err) {
      setError(err?.message || t("Something went wrong."));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      name: selected.name,
      color: selected.color ?? 0,
      hoist: Boolean(selected.hoist),
      mentionable: Boolean(selected.mentionable),
      flags: permissionsToFlagMap(selected.permissions, editableKeys),
    });
  }, [selected?.id, selected?.permissions, selected?.name, selected?.color, editableKeys]);

  const startCreate = () => {
    setSelectedId(null);
    setTab("roles");
    setDraft({
      name: "",
      color: 0x5865f2,
      hoist: false,
      mentionable: false,
      flags: Object.fromEntries(editableKeys.map((k) => [k, k === "VIEW_CHANNEL" || k === "SEND_MESSAGES" || k === "CONNECT" || k === "SPEAK"])),
      isNew: true,
    });
  };

  const saveDraft = async () => {
    if (!draft || !server?.id) return;
    const name = draft.name.trim();
    if (!name) {
      setError(t("Role name is required."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (draft.isNew) {
        const { role } = await createServerRole(server.id, {
          name,
          color: draft.color,
          hoist: draft.hoist,
          mentionable: draft.mentionable,
          permissions: draft.flags,
        });
        setRoles((prev) => {
          const next = [...prev.filter((r) => r.id !== role.id), role].sort(
            (a, b) => (b.position || 0) - (a.position || 0)
          );
          onRolesChanged?.(next);
          return next;
        });
        setSelectedId(role.id);
      } else if (selected) {
        const patch = {
          color: draft.color,
          hoist: draft.hoist,
          mentionable: draft.mentionable,
          permissions: draft.flags,
        };
        if (!selected.isEveryone) patch.name = name;
        const { role } = await updateServerRole(server.id, selected.id, patch);
        setRoles((prev) => {
          const next = prev.map((r) => (r.id === role.id ? role : r));
          onRolesChanged?.(next);
          return next;
        });
      }
    } catch (err) {
      setError(err?.message || t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const removeRole = async () => {
    if (!selected || selected.isEveryone || !server?.id) return;
    if (!window.confirm(t("Delete role {name}?", { name: selected.name }))) return;
    setBusy(true);
    setError("");
    try {
      await deleteServerRole(server.id, selected.id);
      setRoles((prev) => {
        const next = prev.filter((r) => r.id !== selected.id);
        onRolesChanged?.(next);
        return next;
      });
      setSelectedId(null);
      setDraft(null);
    } catch (err) {
      setError(err?.message || t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const toggleMemberRole = async (member, roleId, hasRole) => {
    if (!server?.id || !member?.userId || !roleId) return;
    setError("");
    // Do not toggle global `busy` here — it disabled every chip and felt broken on mobile.
    if (hasRole) await removeMemberRole(server.id, member.userId, roleId);
    else await assignMemberRole(server.id, member.userId, roleId);
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId !== member.userId) return m;
        const roleIds = new Set(m.roleIds || []);
        if (hasRole) roleIds.delete(roleId);
        else roleIds.add(roleId);
        const highestPosition = [...roleIds].reduce((top, id) => {
          const role = roles.find((r) => r.id === id);
          return Math.max(top, Number(role?.position) || 0);
        }, 0);
        return { ...m, roleIds: [...roleIds], highestPosition };
      })
    );
  };

  const actorIsOwner = Boolean(server?.isOwner || server?.myPermissions?.isOwner);
  const actorIsAdmin = Boolean(server?.myPermissions?.flags?.ADMINISTRATOR);
  const actorHighestPosition = Number(server?.myPermissions?.highestPosition) || 0;
  const assignableRoles = roles.filter(
    (r) =>
      !r.isEveryone &&
      (actorIsOwner || actorIsAdmin || (Number(r.position) || 0) < actorHighestPosition)
  );

  const reorderCustomRoles = async (fromId, toId) => {
    if (!server?.id || !fromId || !toId || fromId === toId) return;
    const list = customRoles.slice();
    const fromIdx = list.findIndex((r) => r.id === fromId);
    const toIdx = list.findIndex((r) => r.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);

    const prevById = new Map(customRoles.map((r) => [r.id, r.position || 0]));
    const nextCustom = list.map((role, index) => ({
      ...role,
      position: list.length - index,
    }));
    const nextRoles = everyoneRole ? [...nextCustom, everyoneRole] : nextCustom;

    setRoles(nextRoles);
    onRolesChanged?.(nextRoles);

    const changed = nextCustom.filter((role) => (prevById.get(role.id) || 0) !== role.position);
    if (!changed.length) return;

    setBusy(true);
    setError("");
    try {
      await Promise.all(
        changed.map((role) => updateServerRole(server.id, role.id, { position: role.position }))
      );
    } catch (err) {
      setError(err?.message || t("Something went wrong."));
      load();
    } finally {
      setBusy(false);
    }
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
        className={`server-modal server-roles-modal${tab === "members" ? " is-members" : ""}`}
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="server-roles-header">
          <div>
            <h3>{t("Roles")}</h3>
            <p className="server-modal-lead" style={{ marginBottom: 0 }}>
              {t("Create roles, set permissions, and assign them to members.")}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title={t("Close")}>
            <X size={18} />
          </button>
        </div>

        <div className="server-roles-tabs">
          <button
            type="button"
            className={`server-roles-tab ${tab === "roles" ? "active" : ""}`}
            onClick={() => setTab("roles")}
          >
            <Shield size={14} />
            {t("Roles")}
          </button>
          <button
            type="button"
            className={`server-roles-tab ${tab === "members" ? "active" : ""}`}
            onClick={() => setTab("members")}
          >
            <Users size={14} />
            {t("Members")}
          </button>
        </div>

        {error && <p className="server-modal-error">{error}</p>}

        {tab === "roles" ? (
          <div className="server-roles-layout">
            <div className="server-roles-list">
              <button type="button" className="server-primary-btn server-roles-create" onClick={startCreate}>
                <Plus size={14} />
                {t("Create role")}
              </button>
              <ul>
                {customRoles.map((role) => (
                  <li
                    key={role.id}
                    className={`server-role-row-wrap${dragRoleId === role.id ? " is-dragging" : ""}${dragOverRoleId === role.id ? " is-drag-over" : ""}`}
                    draggable={!busy}
                    onDragStart={(e) => {
                      setDragRoleId(role.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", role.id);
                    }}
                    onDragEnd={() => {
                      setDragRoleId(null);
                      setDragOverRoleId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragRoleId && dragRoleId !== role.id) setDragOverRoleId(role.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverRoleId === role.id) setDragOverRoleId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromId = e.dataTransfer.getData("text/plain") || dragRoleId;
                      setDragRoleId(null);
                      setDragOverRoleId(null);
                      reorderCustomRoles(fromId, role.id);
                    }}
                  >
                    <button
                      type="button"
                      className={`server-role-item ${selectedId === role.id && !draft?.isNew ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(role.id);
                        setDraft(null);
                      }}
                    >
                      <span className="server-role-dot" style={{ background: colorToHex(role.color) }} />
                      <span>{role.name}</span>
                    </button>
                  </li>
                ))}
                {everyoneRole && (
                  <li key={everyoneRole.id} className="server-role-row-wrap server-role-everyone">
                    <button
                      type="button"
                      className={`server-role-item ${selectedId === everyoneRole.id && !draft?.isNew ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(everyoneRole.id);
                        setDraft(null);
                      }}
                    >
                      <span className="server-role-dot" style={{ background: colorToHex(everyoneRole.color) }} />
                      <span>{everyoneRole.name}</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>

            <div className="server-roles-editor">
              {!draft ? (
                <p className="server-empty-hint">{t("Select a role to edit, or create a new one.")}</p>
              ) : (
                <>
                  <label className="server-field">
                    <span>{t("Role name")}</span>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      maxLength={100}
                      disabled={selected?.isEveryone && !draft.isNew}
                      autoFocus={Boolean(draft.isNew)}
                    />
                  </label>

                  <div className="server-field">
                    <span>{t("Color")}</span>
                    <div className="server-role-colors">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`server-role-color ${draft.color === c ? "active" : ""}`}
                          style={{ background: colorToHex(c) }}
                          onClick={() => setDraft((d) => ({ ...d, color: c }))}
                          aria-label={colorToHex(c)}
                        />
                      ))}
                      <input
                        type="color"
                        value={colorToHex(draft.color)}
                        onChange={(e) => setDraft((d) => ({ ...d, color: hexToColor(e.target.value) }))}
                        title={t("Custom color")}
                      />
                    </div>
                  </div>

                  <label className="server-check">
                    <input
                      type="checkbox"
                      checked={draft.hoist}
                      onChange={(e) => setDraft((d) => ({ ...d, hoist: e.target.checked }))}
                    />
                    <span>{t("Display role members separately")}</span>
                  </label>
                  <label className="server-check">
                    <input
                      type="checkbox"
                      checked={draft.mentionable}
                      onChange={(e) => setDraft((d) => ({ ...d, mentionable: e.target.checked }))}
                    />
                    <span>{t("Allow anyone to @mention this role")}</span>
                  </label>

                  <div className="server-field">
                    <span>{t("Permissions")}</span>
                    <ul className="server-perm-list">
                      {editableKeys.map((key) => (
                        <li key={key} className="server-perm-row">
                          <label className="server-perm-label">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.flags?.[key])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setDraft((d) => {
                                  const next = { ...(d.flags || {}) };
                                  if (key === "ADMINISTRATOR") {
                                    // Admin is a master switch — mirror Discord's "all permissions".
                                    for (const k of editableKeys) next[k] = checked;
                                  } else {
                                    next[key] = checked;
                                    if (!checked) next.ADMINISTRATOR = false;
                                  }
                                  return { ...d, flags: next };
                                });
                              }}
                            />
                            <span className="server-perm-text">{t(PERM_LABELS[key] || key)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="server-modal-actions">
                    {selected && !selected.isEveryone && !draft.isNew && (
                      <button type="button" className="server-danger-btn" onClick={removeRole} disabled={busy}>
                        <Trash2 size={14} />
                        {t("Delete role")}
                      </button>
                    )}
                    <button type="button" className="server-ghost-btn" onClick={onClose} disabled={busy}>
                      {t("Cancel")}
                    </button>
                    <button type="button" className="server-primary-btn" onClick={saveDraft} disabled={busy}>
                      {busy ? t("Please wait...") : draft.isNew ? t("Create") : t("Save")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <ServerMemberRoleAssign
            server={server}
            members={members}
            assignableRoles={assignableRoles}
            allRoles={roles}
            busy={busy}
            onToggleRole={async (member, roleId, hasRole) => {
              try {
                await toggleMemberRole(member, roleId, hasRole);
              } catch (err) {
                setError(err?.message || t("Something went wrong."));
                throw err;
              }
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

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

const PRESET_COLORS = [
  0x5865f2, 0x57f287, 0xfee75c, 0xed4245, 0xeb459e, 0xf47b67, 0x3ba55d, 0x3498db, 0x9b59b6, 0x95a5a6,
];

const PERM_LABELS = {
  VIEW_CHANNEL: "View channels",
  SEND_MESSAGES: "Send messages",
  MANAGE_MESSAGES: "Manage messages",
  MANAGE_CHANNELS: "Manage channels",
  MANAGE_ROLES: "Manage roles",
  KICK_MEMBERS: "Kick members",
  BAN_MEMBERS: "Ban members",
  MENTION_EVERYONE: "Mention @everyone",
  CONNECT: "Connect (voice)",
  SPEAK: "Speak",
  MUTE_MEMBERS: "Mute members",
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

function permissionsToFlags(permissions, keys) {
  let bits = 0n;
  try {
    bits = BigInt(permissions || "0");
  } catch {
    bits = 0n;
  }
  const flags = {};
  for (const key of keys) {
    const bit = PERM_BITS[key];
    flags[key] = bit != null ? (bits & bit) !== 0n : false;
  }
  return flags;
}

/** Must match backend Permissions bit positions for editable keys. */
const PERM_BITS = {
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_ROLES: 1n << 28n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  MENTION_EVERYONE: 1n << 17n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  MOVE_MEMBERS: 1n << 24n,
  ADMINISTRATOR: 1n << 3n,
};

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
      flags: permissionsToFlags(selected.permissions, editableKeys),
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
    if (!server?.id) return;
    setBusy(true);
    setError("");
    try {
      if (hasRole) await removeMemberRole(server.id, member.userId, roleId);
      else await assignMemberRole(server.id, member.userId, roleId);
      setMembers((prev) =>
        prev.map((m) => {
          if (m.userId !== member.userId) return m;
          const roleIds = new Set(m.roleIds || []);
          if (hasRole) roleIds.delete(roleId);
          else roleIds.add(roleId);
          return { ...m, roleIds: [...roleIds] };
        })
      );
    } catch (err) {
      setError(err?.message || t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const assignableRoles = roles.filter((r) => !r.isEveryone);

  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="server-modal server-roles-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="server-roles-header">
          <div>
            <h3>{t("Roles")}</h3>
            <p className="server-modal-lead" style={{ marginBottom: 0 }}>
              {t("Create roles and assign them to members. Full permission checks arrive next.")}
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
                {roles
                  .slice()
                  .sort((a, b) => (b.position || 0) - (a.position || 0))
                  .map((role) => (
                    <li key={role.id}>
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
                    <div className="server-perm-grid">
                      {editableKeys.map((key) => (
                        <label key={key} className="server-check">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.flags?.[key])}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                flags: { ...d.flags, [key]: e.target.checked },
                              }))
                            }
                          />
                          <span>{t(PERM_LABELS[key] || key)}</span>
                        </label>
                      ))}
                    </div>
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
          <div className="server-roles-members">
            {assignableRoles.length === 0 ? (
              <p className="server-empty-hint">{t("Create a role first, then assign it to members.")}</p>
            ) : (
              <ul className="server-member-role-list">
                {members.map((member) => (
                  <li key={member.userId} className="server-member-role-row">
                    <div className="server-member-role-identity">
                      <strong>{member.displayName || member.username || member.userId}</strong>
                      <span>
                        @{member.username || "—"}
                        {member.isOwner ? ` · ${t("Owner")}` : ""}
                      </span>
                    </div>
                    <div className="server-member-role-chips">
                      {assignableRoles.map((role) => {
                        const has = (member.roleIds || []).includes(role.id);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            className={`server-role-chip ${has ? "active" : ""}`}
                            style={has ? { borderColor: colorToHex(role.color), color: colorToHex(role.color) } : undefined}
                            disabled={busy}
                            onClick={() => toggleMemberRole(member, role.id, has)}
                          >
                            {role.name}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

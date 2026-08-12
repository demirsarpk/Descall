import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shield, UserPlus, X, Trash2 } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { resolveDisplayName } from "../../lib/userProfile";
import {
  getChannelOverrides,
  putChannelOverride,
  deleteChannelOverride,
  getServerRoles,
  getServerMembers,
} from "../../api/servers";

const PERM_LABELS = {
  VIEW_CHANNEL: "View channel",
  SEND_MESSAGES: "Send messages",
  MANAGE_MESSAGES: "Manage messages",
  CREATE_INSTANT_INVITE: "Create invite",
  MENTION_EVERYONE: "Mention @everyone",
  ATTACH_FILES: "Attach files",
  EMBED_LINKS: "Embed links",
  ADD_REACTIONS: "Add reactions",
  READ_MESSAGE_HISTORY: "Read message history",
  CONNECT: "Connect",
  SPEAK: "Speak",
  REQUEST_TO_SPEAK: "Request to Speak",
  PRIORITY_SPEAKER: "Priority speaker",
  STREAM: "Video / stream",
  MUTE_MEMBERS: "Mute members",
  MOVE_MEMBERS: "Move members",
};

function stateFromOverride(override, key) {
  if (!override) return "inherit";
  if (override.allow?.[key]) return "allow";
  if (override.deny?.[key]) return "deny";
  return "inherit";
}

/**
 * Channel access menu — role/member allow/deny/inherit overrides.
 */
export default function ChannelPermissionsModal({ server, channel, onClose }) {
  const t = useT();
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [editableKeys, setEditableKeys] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null); // `role:id` | `member:id`
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!server?.id || !channel?.id) return;
    setError("");
    try {
      const [ov, rolesRes, membersRes] = await Promise.all([
        getChannelOverrides(server.id, channel.id),
        getServerRoles(server.id),
        getServerMembers(server.id),
      ]);
      setOverrides(ov?.overrides || []);
      setEditableKeys(ov?.editableKeys || Object.keys(PERM_LABELS));
      setRoles(rolesRes?.roles || []);
      setMembers(membersRes?.members || []);
      if (!selectedKey) {
        const everyone = (rolesRes?.roles || []).find((r) => r.isEveryone || r.is_everyone);
        if (everyone) setSelectedKey(`role:${everyone.id}`);
      }
    } catch (err) {
      setError(err.message || t("Failed to load"));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id, channel?.id]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    const [kind, id] = selectedKey.split(":");
    if (kind === "role") {
      const role = roles.find((r) => r.id === id);
      if (!role) return null;
      return { kind: "role", id, label: role.name, role };
    }
    const member = members.find((m) => m.userId === id);
    if (!member) return null;
    return {
      kind: "member",
      id,
      label: resolveDisplayName(member) || member.username || "User",
      member,
    };
  }, [selectedKey, roles, members]);

  const currentOverride = useMemo(() => {
    if (!selected) return null;
    return (
      overrides.find(
        (o) => o.targetType === selected.kind && String(o.targetId) === String(selected.id)
      ) || null
    );
  }, [overrides, selected]);

  useEffect(() => {
    if (!selected) {
      setDraft({});
      return;
    }
    const next = {};
    for (const key of editableKeys) {
      next[key] = stateFromOverride(currentOverride, key);
    }
    setDraft(next);
  }, [selected, currentOverride, editableKeys]);

  const targetsOnList = useMemo(() => {
    const items = [];
    for (const role of roles) {
      const has = overrides.some(
        (o) => o.targetType === "role" && String(o.targetId) === String(role.id)
      );
      if (has || role.isEveryone || role.is_everyone) {
        items.push({
          key: `role:${role.id}`,
          kind: "role",
          label: role.name,
          color: role.color,
          pinned: Boolean(role.isEveryone || role.is_everyone),
        });
      }
    }
    for (const m of members) {
      const has = overrides.some(
        (o) => o.targetType === "member" && String(o.targetId) === String(m.userId)
      );
      if (has) {
        items.push({
          key: `member:${m.userId}`,
          kind: "member",
          label: resolveDisplayName(m) || m.username || "User",
        });
      }
    }
    return items;
  }, [roles, members, overrides]);

  const addableRoles = roles.filter(
    (r) => !targetsOnList.some((t) => t.key === `role:${r.id}`)
  );
  const addableMembers = members.filter(
    (m) => !targetsOnList.some((t) => t.key === `member:${m.userId}`)
  );

  const save = async () => {
    if (!selected || !server?.id || !channel?.id) return;
    setBusy(true);
    setError("");
    try {
      const permissions = {};
      for (const key of editableKeys) {
        const v = draft[key] || "inherit";
        if (v === "allow") permissions[key] = "allow";
        else if (v === "deny") permissions[key] = "deny";
      }
      await putChannelOverride(server.id, channel.id, {
        targetType: selected.kind,
        targetId: selected.id,
        permissions,
      });
      await load();
    } catch (err) {
      setError(err.message || t("Failed to save"));
    } finally {
      setBusy(false);
    }
  };

  const clearOverride = async () => {
    if (!selected || selected.role?.isEveryone || selected.role?.is_everyone) return;
    setBusy(true);
    setError("");
    try {
      await deleteChannelOverride(server.id, channel.id, selected.kind, selected.id);
      setSelectedKey(null);
      await load();
    } catch (err) {
      setError(err.message || t("Failed to save"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="server-modal-backdrop" role="presentation" onClick={onClose}>
      <motion.div
        className="server-modal server-channel-perms-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("Channel access")}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="server-modal-head">
          <div>
            <h2>{t("Channel access")}</h2>
            <p className="server-modal-sub">
              #{channel?.name} · {t("Role or member overrides")}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Close")}>
            <X size={18} />
          </button>
        </header>

        {error ? <p className="server-modal-error">{error}</p> : null}

        <div className="server-channel-perms-layout">
          <aside className="server-channel-perms-targets">
            <div className="server-channel-perms-targets-head">
              <span>{t("Overrides")}</span>
              <button
                type="button"
                className="icon-btn"
                title={t("Add override")}
                onClick={() => setAddOpen((v) => !v)}
              >
                <UserPlus size={16} />
              </button>
            </div>
            {addOpen && (
              <div className="server-channel-perms-add">
                {addableRoles.length > 0 && (
                  <>
                    <p>{t("Roles")}</p>
                    {addableRoles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="server-dropdown-item"
                        onClick={() => {
                          setSelectedKey(`role:${r.id}`);
                          setAddOpen(false);
                        }}
                      >
                        <Shield size={14} />
                        {r.name}
                      </button>
                    ))}
                  </>
                )}
                {addableMembers.length > 0 && (
                  <>
                    <p>{t("Members")}</p>
                    {addableMembers.slice(0, 40).map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        className="server-dropdown-item"
                        onClick={() => {
                          setSelectedKey(`member:${m.userId}`);
                          setAddOpen(false);
                        }}
                      >
                        {resolveDisplayName(m) || m.username}
                      </button>
                    ))}
                  </>
                )}
                {!addableRoles.length && !addableMembers.length && (
                  <p className="server-empty-hint">{t("Everyone already listed")}</p>
                )}
              </div>
            )}
            <ul>
              {targetsOnList.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`server-channel-perms-target ${selectedKey === item.key ? "active" : ""}`}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    {item.kind === "role" ? <Shield size={14} /> : null}
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="server-channel-perms-editor">
            {!selected ? (
              <p className="server-empty-hint">{t("Select a role or member")}</p>
            ) : (
              <>
                <div className="server-channel-perms-editor-head">
                  <h3>{selected.label}</h3>
                  {!(selected.role?.isEveryone || selected.role?.is_everyone) && (
                    <button
                      type="button"
                      className="server-ghost-btn danger"
                      disabled={busy}
                      onClick={clearOverride}
                    >
                      <Trash2 size={14} />
                      {t("Remove override")}
                    </button>
                  )}
                </div>
                <div className="server-channel-perms-rows">
                  {editableKeys.map((key) => (
                    <div key={key} className="server-channel-perms-row">
                      <span>{t(PERM_LABELS[key] || key)}</span>
                      <div className="server-channel-perms-tri">
                        {["allow", "inherit", "deny"].map((state) => (
                          <button
                            key={state}
                            type="button"
                            className={`server-perm-tri ${draft[key] === state ? `is-${state}` : ""}`}
                            onClick={() => setDraft((d) => ({ ...d, [key]: state }))}
                          >
                            {state === "allow"
                              ? t("Allow")
                              : state === "deny"
                                ? t("Deny")
                                : t("Inherit")}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <footer className="server-modal-actions">
                  <button type="button" className="server-ghost-btn" onClick={onClose}>
                    {t("Cancel")}
                  </button>
                  <button
                    type="button"
                    className="server-primary-btn"
                    disabled={busy}
                    onClick={save}
                  >
                    {busy ? t("Please wait...") : t("Save")}
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

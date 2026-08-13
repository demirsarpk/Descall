import { useMemo, useState } from "react";
import {
  Search,
  Shield,
  Lock,
  Check,
  Crown,
  UserRound,
  Filter,
  X,
  Plus,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../../context/LocaleContext";
import { Avatar } from "../ui/Avatar";

function colorToHex(color) {
  const n = Math.max(0, Math.min(0xffffff, Number(color) || 0));
  return `#${n.toString(16).padStart(6, "0")}`;
}

function memberLabel(member) {
  return member?.displayName || member?.username || member?.userId || "Unknown";
}

/**
 * Advanced member ↔ role assignment UI (Discord-style dual pane).
 */
export default function ServerMemberRoleAssign({
  server,
  members = [],
  assignableRoles = [],
  allRoles = [],
  busy = false,
  onToggleRole,
}) {
  const t = useT();
  const [view, setView] = useState("members"); // members | roles
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(assignableRoles[0]?.id || null);
  const [addQuery, setAddQuery] = useState("");
  const [pendingId, setPendingId] = useState(null);

  const roleById = useMemo(() => {
    const map = new Map();
    for (const role of allRoles || []) map.set(role.id, role);
    return map;
  }, [allRoles]);

  const actorHighestPosition = Number(server?.myPermissions?.highestPosition) || 0;

  const canManageMember = (member) =>
    Boolean(
      member &&
        !member.isOwner &&
        (server?.isOwner || actorHighestPosition > (Number(member.highestPosition) || 0))
    );

  const sortedMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(members || [])]
      .filter((m) => {
        if (roleFilter !== "all" && !(m.roleIds || []).includes(roleFilter)) return false;
        if (!q) return true;
        const hay = `${m.displayName || ""} ${m.username || ""} ${m.nickname || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => memberLabel(a).localeCompare(memberLabel(b)));
  }, [members, query, roleFilter]);

  const selectedMember =
    sortedMembers.find((m) => m.userId === selectedMemberId) ||
    members.find((m) => m.userId === selectedMemberId) ||
    sortedMembers[0] ||
    null;

  const selectedRole =
    assignableRoles.find((r) => r.id === selectedRoleId) || assignableRoles[0] || null;

  const membersWithSelectedRole = useMemo(() => {
    if (!selectedRole) return [];
    return [...(members || [])]
      .filter((m) => (m.roleIds || []).includes(selectedRole.id))
      .sort((a, b) => memberLabel(a).localeCompare(memberLabel(b)));
  }, [members, selectedRole]);

  const addCandidates = useMemo(() => {
    if (!selectedRole) return [];
    const q = addQuery.trim().toLowerCase();
    return [...(members || [])]
      .filter((m) => canManageMember(m) && !(m.roleIds || []).includes(selectedRole.id))
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.displayName || ""} ${m.username || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [members, selectedRole, addQuery, server, actorHighestPosition]);

  const roleCounts = useMemo(() => {
    const counts = new Map();
    for (const role of assignableRoles) counts.set(role.id, 0);
    for (const m of members || []) {
      for (const id of m.roleIds || []) {
        if (counts.has(id)) counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return counts;
  }, [members, assignableRoles]);

  const toggle = async (member, role, hasRole) => {
    if (!member || !role || busy) return;
    if (!canManageMember(member)) return;
    setPendingId(`${member.userId}:${role.id}`);
    try {
      await onToggleRole?.(member, role.id, hasRole);
    } finally {
      setPendingId(null);
    }
  };

  if (!assignableRoles.length) {
    return (
      <div className="sra-empty">
        <Shield size={28} strokeWidth={1.5} />
        <h4>{t("No assignable roles yet")}</h4>
        <p>{t("Create a role first, then assign it to members.")}</p>
      </div>
    );
  }

  return (
    <div className="sra-root">
      <div className="sra-toolbar">
        <div className="sra-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search members")}
            aria-label={t("Search members")}
          />
          {query ? (
            <button type="button" className="sra-icon-clear" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          ) : null}
        </div>

        <label className="sra-filter">
          <Filter size={14} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">{t("All roles")}</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <div className="sra-view-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            className={view === "members" ? "active" : ""}
            aria-selected={view === "members"}
            onClick={() => setView("members")}
          >
            <UserRound size={14} />
            {t("By member")}
          </button>
          <button
            type="button"
            role="tab"
            className={view === "roles" ? "active" : ""}
            aria-selected={view === "roles"}
            onClick={() => setView("roles")}
          >
            <Shield size={14} />
            {t("By role")}
          </button>
        </div>

        <span className="sra-count">
          <Users size={13} />
          {sortedMembers.length}
        </span>
      </div>

      {view === "members" ? (
        <div className="sra-layout">
          <div className="sra-list">
            {sortedMembers.length === 0 ? (
              <p className="sra-list-empty">{t("No members match your filters.")}</p>
            ) : (
              sortedMembers.map((member) => {
                const active = selectedMember?.userId === member.userId;
                const pills = (member.roleIds || [])
                  .map((id) => roleById.get(id))
                  .filter((r) => r && !r.isEveryone)
                  .sort((a, b) => (b.position || 0) - (a.position || 0))
                  .slice(0, 3);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    className={`sra-member-row${active ? " active" : ""}${
                      !canManageMember(member) ? " is-locked" : ""
                    }`}
                    onClick={() => setSelectedMemberId(member.userId)}
                  >
                    <Avatar
                      name={memberLabel(member)}
                      size={36}
                      user={{
                        id: member.userId,
                        username: member.username,
                        avatarUrl: member.avatarUrl,
                      }}
                      imageUrl={member.avatarUrl || undefined}
                    />
                    <div className="sra-member-meta">
                      <strong style={{ color: pills[0] ? colorToHex(pills[0].color) : undefined }}>
                        {memberLabel(member)}
                        {member.isOwner ? (
                          <Crown size={12} className="sra-owner-icon" title={t("Owner")} />
                        ) : null}
                      </strong>
                      <span>@{member.username || "—"}</span>
                      <div className="sra-mini-pills">
                        {pills.map((role) => (
                          <em
                            key={role.id}
                            style={{
                              borderColor: colorToHex(role.color),
                              color: colorToHex(role.color),
                            }}
                          >
                            {role.name}
                          </em>
                        ))}
                        {(member.roleIds || []).filter((id) => {
                          const r = roleById.get(id);
                          return r && !r.isEveryone;
                        }).length > 3 ? (
                          <em className="more">
                            +
                            {(member.roleIds || []).filter((id) => {
                              const r = roleById.get(id);
                              return r && !r.isEveryone;
                            }).length - 3}
                          </em>
                        ) : null}
                      </div>
                    </div>
                    {!canManageMember(member) ? <Lock size={14} className="sra-lock" /> : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="sra-detail">
            {!selectedMember ? (
              <div className="sra-empty">
                <UserRound size={28} strokeWidth={1.5} />
                <h4>{t("Select a member")}</h4>
                <p>{t("Choose someone from the list to manage their roles.")}</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedMember.userId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="sra-detail-inner"
                >
                  <div className="sra-detail-head">
                    <Avatar
                      name={memberLabel(selectedMember)}
                      size={56}
                      user={{
                        id: selectedMember.userId,
                        username: selectedMember.username,
                        avatarUrl: selectedMember.avatarUrl,
                      }}
                      imageUrl={selectedMember.avatarUrl || undefined}
                    />
                    <div>
                      <h4>{memberLabel(selectedMember)}</h4>
                      <p>
                        @{selectedMember.username || "—"}
                        {selectedMember.isOwner ? ` · ${t("Owner")}` : ""}
                        {selectedMember.nickname ? ` · ${selectedMember.nickname}` : ""}
                      </p>
                    </div>
                  </div>

                  {!canManageMember(selectedMember) ? (
                    <div className="sra-banner">
                      <Lock size={14} />
                      <span>
                        {selectedMember.isOwner
                          ? t("Server owners manage their own roles.")
                          : t("This member has an equal or higher role.")}
                      </span>
                    </div>
                  ) : null}

                  <div className="sra-section-label">
                    <Shield size={13} />
                    {t("Assigned roles")}
                    <span>
                      {
                        (selectedMember.roleIds || []).filter((id) =>
                          assignableRoles.some((r) => r.id === id)
                        ).length
                      }
                      /{assignableRoles.length}
                    </span>
                  </div>

                  <ul className="sra-role-assign-list">
                    {assignableRoles.map((role) => {
                      const has = (selectedMember.roleIds || []).includes(role.id);
                      const locked = !canManageMember(selectedMember);
                      const pending = pendingId === `${selectedMember.userId}:${role.id}`;
                      const hex = colorToHex(role.color);
                      return (
                        <li key={role.id}>
                          <button
                            type="button"
                            className={`sra-role-toggle${has ? " is-on" : ""}${
                              locked ? " is-disabled" : ""
                            }`}
                            disabled={busy || locked || pending}
                            onClick={() => toggle(selectedMember, role, has)}
                            style={has ? { "--role-color": hex } : undefined}
                          >
                            <span className="sra-role-swatch" style={{ background: hex }} />
                            <span className="sra-role-copy">
                              <strong>{role.name}</strong>
                              <small>
                                {role.hoist ? t("Displayed separately") : t("Role")}
                                {" · "}
                                {roleCounts.get(role.id) || 0} {t("members")}
                              </small>
                            </span>
                            <span className={`sra-switch${has ? " on" : ""}`} aria-hidden>
                              {has ? <Check size={12} /> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      ) : (
        <div className="sra-layout">
          <div className="sra-list sra-role-side">
            {assignableRoles.map((role) => {
              const active = selectedRole?.id === role.id;
              const hex = colorToHex(role.color);
              return (
                <button
                  key={role.id}
                  type="button"
                  className={`sra-role-side-row${active ? " active" : ""}`}
                  onClick={() => setSelectedRoleId(role.id)}
                  style={active ? { "--role-color": hex } : undefined}
                >
                  <span className="sra-role-swatch" style={{ background: hex }} />
                  <span className="sra-role-copy">
                    <strong>{role.name}</strong>
                    <small>
                      {roleCounts.get(role.id) || 0} {t("members")}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sra-detail">
            {!selectedRole ? (
              <div className="sra-empty">
                <Shield size={28} strokeWidth={1.5} />
                <h4>{t("Select a role")}</h4>
                <p>{t("Pick a role to see and manage its members.")}</p>
              </div>
            ) : (
              <div className="sra-detail-inner">
                <div className="sra-detail-head">
                  <span
                    className="sra-role-badge-lg"
                    style={{ background: colorToHex(selectedRole.color) }}
                  >
                    <Shield size={22} color="#0b0c10" />
                  </span>
                  <div>
                    <h4 style={{ color: colorToHex(selectedRole.color) }}>{selectedRole.name}</h4>
                    <p>
                      {roleCounts.get(selectedRole.id) || 0} {t("members with this role")}
                    </p>
                  </div>
                </div>

                <div className="sra-add-box">
                  <div className="sra-search">
                    <Plus size={15} />
                    <input
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                      placeholder={t("Add members to this role…")}
                    />
                  </div>
                  {addQuery.trim() && addCandidates.length > 0 ? (
                    <ul className="sra-add-results">
                      {addCandidates.map((member) => (
                        <li key={member.userId}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              await toggle(member, selectedRole, false);
                              setAddQuery("");
                            }}
                          >
                            <Avatar
                              name={memberLabel(member)}
                              size={28}
                              user={{
                                id: member.userId,
                                username: member.username,
                                avatarUrl: member.avatarUrl,
                              }}
                              imageUrl={member.avatarUrl || undefined}
                            />
                            <span>
                              {memberLabel(member)}
                              <small>@{member.username || "—"}</small>
                            </span>
                            <Plus size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="sra-section-label">
                  <Users size={13} />
                  {t("Members")}
                </div>

                {membersWithSelectedRole.length === 0 ? (
                  <p className="sra-list-empty">{t("No members have this role yet.")}</p>
                ) : (
                  <ul className="sra-role-members">
                    {membersWithSelectedRole.map((member) => {
                      const locked = !canManageMember(member);
                      return (
                        <li key={member.userId}>
                          <Avatar
                            name={memberLabel(member)}
                            size={32}
                            user={{
                              id: member.userId,
                              username: member.username,
                              avatarUrl: member.avatarUrl,
                            }}
                            imageUrl={member.avatarUrl || undefined}
                          />
                          <div className="sra-member-meta">
                            <strong>{memberLabel(member)}</strong>
                            <span>@{member.username || "—"}</span>
                          </div>
                          <button
                            type="button"
                            className="sra-remove"
                            disabled={busy || locked}
                            title={
                              locked
                                ? t("This member has an equal or higher role.")
                                : t("Remove role")
                            }
                            onClick={() => toggle(member, selectedRole, true)}
                          >
                            {locked ? <Lock size={14} /> : <X size={14} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

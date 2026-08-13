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
 * Member ↔ role assignment UI.
 * Primary interaction: inline role chips per member (works on mobile).
 * Secondary: by-role view to add/remove members for one role.
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
  const [selectedRoleId, setSelectedRoleId] = useState(assignableRoles[0]?.id || null);
  const [addQuery, setAddQuery] = useState("");
  const [pendingId, setPendingId] = useState(null);

  const roleById = useMemo(() => {
    const map = new Map();
    for (const role of allRoles || []) map.set(role.id, role);
    return map;
  }, [allRoles]);

  const actorIsOwner = Boolean(server?.isOwner || server?.myPermissions?.isOwner);
  const actorIsAdmin = Boolean(server?.myPermissions?.flags?.ADMINISTRATOR);
  const actorHighestPosition = Number(server?.myPermissions?.highestPosition) || 0;

  const canManageMember = (member) => {
    if (!member || member.isOwner) return false;
    if (actorIsOwner || actorIsAdmin) return true;
    return actorHighestPosition > (Number(member.highestPosition) || 0);
  };

  const sortedMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(members || [])]
      .filter((m) => {
        if (roleFilter !== "all" && !(m.roleIds || []).includes(roleFilter)) return false;
        if (!q) return true;
        const hay = `${m.displayName || ""} ${m.username || ""} ${m.nickname || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // Manageable members first, then name — avoids defaulting to a locked owner row.
        const am = canManageMember(a) ? 0 : 1;
        const bm = canManageMember(b) ? 0 : 1;
        if (am !== bm) return am - bm;
        return memberLabel(a).localeCompare(memberLabel(b));
      });
  }, [members, query, roleFilter, actorIsOwner, actorIsAdmin, actorHighestPosition]);

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
  }, [members, selectedRole, addQuery, actorIsOwner, actorIsAdmin, actorHighestPosition]);

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
    if (!member || !role) return;
    if (!canManageMember(member)) return;
    const key = `${member.userId}:${role.id}`;
    if (pendingId === key) return;
    setPendingId(key);
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
        <div className="sra-chip-list">
          {sortedMembers.length === 0 ? (
            <p className="sra-list-empty">{t("No members match your filters.")}</p>
          ) : (
            sortedMembers.map((member) => {
              const locked = !canManageMember(member);
              const assigned = (member.roleIds || [])
                .map((id) => roleById.get(id))
                .filter((r) => r && !r.isEveryone)
                .sort((a, b) => (b.position || 0) - (a.position || 0));
              return (
                <div
                  key={member.userId}
                  className={`sra-chip-row${locked ? " is-locked" : ""}`}
                >
                  <div className="sra-chip-identity">
                    <Avatar
                      name={memberLabel(member)}
                      size={40}
                      user={{
                        id: member.userId,
                        username: member.username,
                        avatarUrl: member.avatarUrl,
                      }}
                      imageUrl={member.avatarUrl || undefined}
                    />
                    <div className="sra-member-meta">
                      <strong
                        style={{
                          color: assigned[0] ? colorToHex(assigned[0].color) : undefined,
                        }}
                      >
                        {memberLabel(member)}
                        {member.isOwner ? (
                          <Crown size={12} className="sra-owner-icon" title={t("Owner")} />
                        ) : null}
                        {locked ? <Lock size={12} className="sra-lock" /> : null}
                      </strong>
                      <span>
                        @{member.username || "—"}
                        {member.isOwner ? ` · ${t("Owner")}` : ""}
                      </span>
                    </div>
                  </div>

                  {locked ? (
                    <p className="sra-chip-hint">
                      {member.isOwner
                        ? t("Server owners manage their own roles.")
                        : t("This member has an equal or higher role.")}
                    </p>
                  ) : null}

                  <div className="sra-role-chips" role="group" aria-label={t("Assigned roles")}>
                    {assignableRoles.map((role) => {
                      const has = (member.roleIds || []).includes(role.id);
                      const pending = pendingId === `${member.userId}:${role.id}`;
                      const hex = colorToHex(role.color);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          className={`server-role-chip${has ? " active" : ""}${
                            pending ? " is-pending" : ""
                          }`}
                          style={
                            has
                              ? { borderColor: hex, color: hex, ["--role-color"]: hex }
                              : undefined
                          }
                          disabled={locked || pending}
                          title={
                            locked
                              ? t("This member has an equal or higher role.")
                              : has
                                ? t("Remove role")
                                : t("Assign role")
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void toggle(member, role, has);
                          }}
                        >
                          {has ? <Check size={12} aria-hidden /> : null}
                          {role.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
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
                            disabled={Boolean(pendingId)}
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
                      const pending = pendingId === `${member.userId}:${selectedRole.id}`;
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
                            disabled={locked || pending}
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
      {/* busy reserved for parent role CRUD; chips use pendingId only */}
      {busy ? <span className="sra-busy-sr" aria-live="polite" /> : null}
    </div>
  );
}

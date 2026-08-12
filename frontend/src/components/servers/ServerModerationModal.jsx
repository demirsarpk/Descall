import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ban, ScrollText, UserCheck, RefreshCw, X } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { Avatar } from "../ui/Avatar";
import {
  listServerBans,
  unbanServerMember,
  getServerAuditLogs,
} from "../../api/servers";
import { resolveDisplayName } from "../../lib/userProfile";

const ACTION_LABELS = {
  SERVER_CREATE: "Server created",
  SERVER_UPDATE: "Server updated",
  SERVER_DELETE: "Server deleted",
  MEMBER_JOIN: "Member joined",
  MEMBER_LEAVE: "Member left",
  MEMBER_KICK: "Member kicked",
  MEMBER_BAN: "Member banned",
  MEMBER_UNBAN: "Member unbanned",
  MEMBER_ROLE_ADD: "Role assigned",
  MEMBER_ROLE_REMOVE: "Role removed",
  ROLE_CREATE: "Role created",
  ROLE_UPDATE: "Role updated",
  ROLE_DELETE: "Role deleted",
  CHANNEL_CREATE: "Channel created",
  CHANNEL_UPDATE: "Channel updated",
  CHANNEL_DELETE: "Channel deleted",
  INVITE_CREATE: "Invite created",
  INVITE_DELETE: "Invite revoked",
};

/**
 * Bans list + recent audit log (Step 9).
 */
export default function ServerModerationModal({
  server,
  onClose,
  initialTab = "bans",
}) {
  const t = useT();
  const { toast } = useToast();
  const flags = server?.myPermissions?.flags || {};
  const canBan = Boolean(server?.isOwner || flags.BAN_MEMBERS || flags.ADMINISTRATOR);
  const canAudit = Boolean(server?.isOwner || flags.VIEW_AUDIT_LOG || flags.ADMINISTRATOR);

  const [tab, setTab] = useState(() => {
    if (initialTab === "audit" && canAudit) return "audit";
    if (canBan) return "bans";
    return canAudit ? "audit" : "bans";
  });
  const [bans, setBans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadBans = async () => {
    if (!server?.id || !canBan) return;
    const data = await listServerBans(server.id);
    setBans(data?.bans || []);
  };

  const loadLogs = async () => {
    if (!server?.id || !canAudit) return;
    const data = await getServerAuditLogs(server.id, { limit: 50 });
    setLogs(data?.logs || []);
  };

  const load = async () => {
    if (!server?.id) return;
    setLoading(true);
    try {
      if (tab === "bans" && canBan) await loadBans();
      if (tab === "audit" && canAudit) await loadLogs();
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id, tab]);

  const unban = async (ban) => {
    if (!server?.id) return;
    setBusyId(ban.userId);
    try {
      await unbanServerMember(server.id, ban.userId);
      setBans((prev) => prev.filter((b) => String(b.userId) !== String(ban.userId)));
      toast(t("Member unbanned"), "success");
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const nameOf = (row) =>
    resolveDisplayName({
      id: row.userId || row.actorId,
      username: row.username || row.actorUsername,
      displayName: row.displayName || row.actorDisplayName,
    });

  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="server-modal server-moderation-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="server-moderation-head">
          <h3>{t("Server moderation")}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Close")}>
            <X size={16} />
          </button>
        </div>
        <p className="server-modal-lead">
          {t("Manage bans and review recent activity for {name}.", {
            name: server?.name || t("this server"),
          })}
        </p>

        <div className="server-join-tabs">
          {canBan && (
            <button
              type="button"
              className={tab === "bans" ? "active" : ""}
              onClick={() => setTab("bans")}
            >
              <Ban size={14} />
              {t("Bans")}
            </button>
          )}
          {canAudit && (
            <button
              type="button"
              className={tab === "audit" ? "active" : ""}
              onClick={() => setTab("audit")}
            >
              <ScrollText size={14} />
              {t("Audit log")}
            </button>
          )}
        </div>

        <div className="server-moderation-toolbar">
          <button type="button" className="icon-btn" onClick={load} title={t("Refresh")}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="server-moderation-body">
          {loading ? (
            <p className="server-empty-hint">{t("Loading…")}</p>
          ) : tab === "bans" ? (
            bans.length === 0 ? (
              <p className="server-empty-hint">{t("No banned members")}</p>
            ) : (
              bans.map((ban) => {
                const name = nameOf(ban);
                return (
                  <div key={ban.userId} className="server-moderation-row">
                    <Avatar
                      name={name}
                      size={36}
                      user={{
                        id: ban.userId,
                        username: ban.username,
                        displayName: ban.displayName,
                        avatarUrl: ban.avatarUrl,
                      }}
                    />
                    <div className="server-moderation-meta">
                      <strong>{name}</strong>
                      <span>
                        {ban.reason ? ban.reason : t("No reason")}
                        {ban.createdAt
                          ? ` · ${new Date(ban.createdAt).toLocaleString()}`
                          : ""}
                        {ban.moderatorUsername
                          ? ` · ${t("by {name}", { name: ban.moderatorDisplayName || ban.moderatorUsername })}`
                          : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="server-ghost-btn sm"
                      disabled={busyId === ban.userId}
                      onClick={() => unban(ban)}
                    >
                      <UserCheck size={14} />
                      {t("Unban")}
                    </button>
                  </div>
                );
              })
            )
          ) : logs.length === 0 ? (
            <p className="server-empty-hint">{t("No audit events yet")}</p>
          ) : (
            logs.map((log) => {
              const actorName = nameOf({
                actorId: log.actorId,
                actorUsername: log.actorUsername,
                actorDisplayName: log.actorDisplayName,
              });
              return (
                <div key={log.id} className="server-audit-row">
                  <div className="server-audit-action">
                    {t(ACTION_LABELS[log.action] || log.action)}
                  </div>
                  <div className="server-audit-detail">
                    <span>
                      {actorName !== "User" ? actorName : t("System")}
                      {log.reason ? ` · ${log.reason}` : ""}
                    </span>
                    <time dateTime={log.createdAt || undefined}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                    </time>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="server-modal-actions">
          <button type="button" className="server-ghost-btn" onClick={onClose}>
            {t("Close")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

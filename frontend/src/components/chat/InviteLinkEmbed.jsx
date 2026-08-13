import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Server,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  LogIn,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { Avatar } from "../ui/Avatar";
import { previewGroupInvite, joinGroupByInvite } from "../../api/groups";
import { previewServerInvite, joinServerByInvite } from "../../api/servers";
import {
  extractDescallInvites,
  getCachedInvitePreview,
  setCachedInvitePreview,
} from "../../lib/inviteLinks";

/**
 * Discord-style rich invite card shown under chat messages that contain
 * Descall group / server / friend invite links.
 */
export default function InviteLinkEmbed({ invite }) {
  const t = useT();
  const { toast } = useToast();
  const [loading, setLoading] = useState(invite.kind !== "friend");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(() => {
    if (invite.kind === "friend") {
      return { username: invite.username || invite.code };
    }
    const cached = getCachedInvitePreview(invite.kind, invite.code);
    return cached?.data || null;
  });

  useEffect(() => {
    if (!invite?.code || invite.kind === "friend") {
      setLoading(false);
      return undefined;
    }
    const cached = getCachedInvitePreview(invite.kind, invite.code);
    if (cached?.data) {
      setPreview(cached.data);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data =
          invite.kind === "server"
            ? await previewServerInvite(invite.code)
            : await previewGroupInvite(invite.code);
        if (cancelled) return;
        setCachedInvitePreview(invite.kind, invite.code, data);
        setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || t("Invite invalid or expired."));
          setPreview(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invite?.kind, invite?.code, t]);

  const alreadyMember =
    invite.kind === "group"
      ? Boolean(preview?.alreadyMember)
      : invite.kind === "server"
        ? Boolean(preview?.server?.isMember || preview?.alreadyMember)
        : false;

  const title =
    invite.kind === "server"
      ? preview?.server?.name || t("Server invite")
      : invite.kind === "group"
        ? preview?.group?.name || t("Group invite")
        : t("Friend invite");

  const subtitle =
    invite.kind === "server"
      ? t("{count} members", { count: preview?.server?.memberCount ?? 0 })
      : invite.kind === "group"
        ? t("{count} members", { count: preview?.group?.memberCount ?? 0 })
        : t("Join {name} on Descall", { name: invite.username || invite.code });

  const iconUrl =
    invite.kind === "server"
      ? preview?.server?.iconUrl
      : invite.kind === "group"
        ? preview?.group?.avatarUrl
        : null;

  const splashUrl =
    invite.kind === "server"
      ? preview?.server?.splashUrl || preview?.server?.bannerUrl || null
      : null;

  const handleAction = async () => {
    if (invite.kind === "friend") {
      window.open(invite.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (alreadyMember) {
      window.dispatchEvent(
        new CustomEvent("descall:open-invite-target", {
          detail: {
            kind: invite.kind,
            group: preview?.group || null,
            server: preview?.server || null,
          },
        })
      );
      return;
    }

    setJoining(true);
    setError("");
    try {
      if (invite.kind === "server") {
        const data = await joinServerByInvite(invite.code);
        const server = data?.server;
        setCachedInvitePreview(invite.kind, invite.code, {
          ...(preview || {}),
          server: server ? { ...server, isMember: true } : preview?.server,
          alreadyMember: true,
        });
        setPreview((prev) => ({
          ...(prev || {}),
          server: server ? { ...server, isMember: true } : prev?.server,
          alreadyMember: true,
        }));
        toast(t("Joined {name}", { name: server?.name || t("server") }), "success");
        window.dispatchEvent(
          new CustomEvent("descall:joined-server", { detail: { server } })
        );
      } else {
        const data = await joinGroupByInvite(invite.code);
        const group = data?.group;
        setCachedInvitePreview(invite.kind, invite.code, {
          ...(preview || {}),
          group: group || preview?.group,
          alreadyMember: true,
        });
        setPreview((prev) => ({
          ...(prev || {}),
          group: group || prev?.group,
          alreadyMember: true,
        }));
        toast(t("Joined {name}", { name: group?.name || t("group") }), "success");
        window.dispatchEvent(
          new CustomEvent("descall:joined-group", { detail: { group } })
        );
      }
    } catch (err) {
      const msg = err?.message || t("Could not join");
      setError(msg);
      toast(msg, "error");
    } finally {
      setJoining(false);
    }
  };

  const KindIcon = invite.kind === "server" ? Server : invite.kind === "friend" ? UserPlus : Users;
  const ctaLabel =
    invite.kind === "friend"
      ? t("Open invite")
      : alreadyMember
        ? invite.kind === "server"
          ? t("Open server")
          : t("Open group")
        : t("Accept Invite");

  return (
    <motion.div
      className={`invite-embed invite-embed-${invite.kind}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="invite-embed-accent" aria-hidden />
      {splashUrl ? (
        <div
          className="invite-embed-splash"
          style={{ backgroundImage: `url(${splashUrl})` }}
        />
      ) : (
        <div className="invite-embed-splash invite-embed-splash-fallback" />
      )}

      <div className="invite-embed-body">
        <div className="invite-embed-eyebrow">
          <KindIcon size={12} />
          <span>
            {invite.kind === "server"
              ? t("You've been invited to a server")
              : invite.kind === "group"
                ? t("You've been invited to a group")
                : t("You've been invited to Descall")}
          </span>
        </div>

        {loading ? (
          <div className="invite-embed-loading">
            <Loader2 size={18} className="spin" />
            <span>{t("Loading invite…")}</span>
          </div>
        ) : error && !preview ? (
          <div className="invite-embed-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            <div className="invite-embed-main">
              {invite.kind === "friend" ? (
                <div className="invite-embed-avatar friend">
                  <Avatar name={invite.username || invite.code} size={48} />
                </div>
              ) : iconUrl ? (
                <img src={iconUrl} alt="" className="invite-embed-icon" />
              ) : (
                <div className="invite-embed-icon-fallback">
                  {(title || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="invite-embed-copy">
                <strong>{title}</strong>
                <span>{subtitle}</span>
                {alreadyMember ? (
                  <em className="invite-embed-member">
                    <CheckCircle2 size={12} />
                    {t("Already a member")}
                  </em>
                ) : null}
              </div>
            </div>

            {error ? <p className="invite-embed-inline-error">{error}</p> : null}

            <button
              type="button"
              className="invite-embed-cta"
              onClick={handleAction}
              disabled={joining || loading}
            >
              {joining ? (
                <Loader2 size={16} className="spin" />
              ) : invite.kind === "friend" ? (
                <LogIn size={16} />
              ) : alreadyMember ? (
                <CheckCircle2 size={16} />
              ) : (
                <LogIn size={16} />
              )}
              {joining ? t("Joining…") : ctaLabel}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export function InviteLinkEmbedList({ text }) {
  const invites = extractDescallInvites(text);
  if (!invites.length) return null;
  return (
    <div className="invite-embed-list">
      {invites.map((inv) => (
        <InviteLinkEmbed key={`${inv.kind}:${inv.code}`} invite={inv} />
      ))}
    </div>
  );
}

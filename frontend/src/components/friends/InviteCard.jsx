import { useMemo, useState } from "react";
import { Check, Coins, Copy, Gift, Share2 } from "lucide-react";
import { buildFriendInviteUrl } from "../../lib/referral";
import { Funnel } from "../../site/analytics";
import { useT } from "../../context/LocaleContext";

/**
 * Shareable personal invite card with DesCoin reward copy.
 */
export default function InviteCard({ username, compact = false, onCopied, onShared }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => buildFriendInviteUrl(username), [username]);

  if (!username) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      Funnel.inviteGenerated({ method: "invite_card", username });
      setCopied(true);
      try {
        onCopied?.({ method: "clipboard", kind: "link" });
      } catch {
        /* ignore */
      }
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Descall",
          text: t("Join me on Descall — we both get DesCoin"),
          url,
        });
        Funnel.inviteGenerated({ method: "native_share", username });
        try {
          onShared?.({ method: "native_share" });
        } catch {
          /* ignore */
        }
        return;
      }
    } catch {
      /* fall through to copy */
    }
    await copy();
    try {
      onShared?.({ method: "clipboard_fallback" });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`invite-card ${compact ? "compact" : ""}`}>
      <div className="invite-card-header">
        <Gift size={18} />
        <div>
          <strong>{t("Invite friends")}</strong>
          <span>{t("You get 100 DesCoin · they get 50")}</span>
        </div>
      </div>
      <div className="invite-card-link" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </div>
      <div className="invite-card-actions">
        <button type="button" className="invite-card-btn primary" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t("Copied") : t("Copy link")}
        </button>
        <button type="button" className="invite-card-btn" onClick={share}>
          <Share2 size={15} />
          {t("Share")}
        </button>
      </div>
      <p className="invite-card-footnote">
        <Coins size={13} />
        {t("Rewards land when they register with your link")}
      </p>
    </div>
  );
}

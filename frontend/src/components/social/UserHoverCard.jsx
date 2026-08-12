import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Avatar } from "../ui/Avatar";
import { pickAvatarUrl, resolveDisplayName } from "../../lib/userProfile";
import { cssUrl } from "../../lib/cssUrl";
import ValorantBadge from "./ValorantBadge";
import AdminBadge from "./AdminBadge";
import { BadgeIcon, NameEffectText, TitleTag, profileAuraClass } from "../ui/Cosmetics";
import { getUserValorant } from "../../api/riot";
import { useT } from "../../context/LocaleContext";
import ParallaxBanner from "../ui/ParallaxBanner";

const STATUS_CLASS = {
  online: "st-online",
  idle: "st-idle",
  dnd: "st-dnd",
  invisible: "st-invisible",
  offline: "st-offline",
};

const CARD_WIDTH = 280;
const PAD = 8;

function formatLastSeen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return null;
  }
}

function clampPos(anchor, cardH = 180) {
  if (!anchor) return { left: PAD, top: PAD };
  let left = typeof anchor.x === "number" ? anchor.x : PAD;
  let top = typeof anchor.y === "number" ? anchor.y : PAD;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (left + CARD_WIDTH > vw - PAD) {
    left = Math.max(PAD, (anchor.flipX ?? left) - CARD_WIDTH);
  }
  if (left < PAD) left = PAD;

  if (top + cardH > vh - PAD) {
    top = Math.max(PAD, vh - cardH - PAD);
  }
  if (top < PAD) top = PAD;

  return { left, top };
}

export default function UserHoverCard({ user, anchor }) {
  const t = useT();
  const ref = useRef(null);
  const [pos, setPos] = useState(() => clampPos(anchor));
  const [valorant, setValorant] = useState(user?.valorant || null);

  useEffect(() => {
    let cancelled = false;
    setValorant(user?.valorant || null);
    if (!user?.id || user?.valorant?.linked) return undefined;
    getUserValorant(user.id)
      .then((res) => {
        if (!cancelled) setValorant(res.valorant || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.valorant]);

  useLayoutEffect(() => {
    if (!anchor) return;
    const el = ref.current;
    const h = el?.offsetHeight || 180;
    setPos(clampPos(anchor, h));
  }, [anchor, user?.id, user?.bio, user?.customStatus, valorant]);

  if (!user || !anchor) return null;

  const statusKey = user.status && STATUS_CLASS[user.status] ? user.status : "offline";
  const statusClass = STATUS_CLASS[statusKey];
  const statusLabel = {
    online: t("Online"),
    idle: t("Idle"),
    dnd: t("Do Not Disturb"),
    invisible: t("Invisible"),
    offline: t("Offline"),
  }[statusKey];
  const lastSeenLabel = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
  const display = resolveDisplayName(user);
  const banner = user.bannerUrl || user.banner_url;
  const bio = user.bio;
  const customStatus = user.customStatus || user.custom_status;
  const avatarUrl = pickAvatarUrl(user);

  const node = (
    <motion.div
      ref={ref}
      className={`user-hover-card glass ${profileAuraClass(user)}`.trim()}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 4000,
        width: CARD_WIDTH,
        maxWidth: `calc(100vw - ${PAD * 2}px)`,
        maxHeight: `calc(100vh - ${PAD * 2}px)`,
        overflow: "auto",
      }}
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
    >
      <ParallaxBanner
        className="uhc-banner"
        height={72}
        imageUrl={banner ? cssUrl(banner) : null}
        fallbackStyle={undefined}
        strength={8}
      />
      <div className="uhc-body">
        <div className="uhc-avatar-wrap">
          <Avatar
            name={display}
            size={56}
            user={user}
            imageUrl={avatarUrl}
            animate="always"
            loading="eager"
          />
        </div>
        <div className="uhc-text">
          <div className="uhc-name">
            <NameEffectText user={user}>{display}</NameEffectText>
            <BadgeIcon user={user} />
            <AdminBadge user={user} variant="inline" />
          </div>
          <div className="uhc-handle">@{user.username || t("user")}</div>
          <TitleTag user={user} />
          <div className={`uhc-status ${statusClass}`}>
            <span className="uhc-dot" /> {statusLabel}
          </div>
          {customStatus && <p className="uhc-custom-status">{customStatus}</p>}
          {valorant?.linked && <ValorantBadge valorant={valorant} compact />}
          {bio && <p className="uhc-bio">{bio}</p>}
          {!bio && lastSeenLabel && statusClass === "st-offline" && (
            <p className="uhc-bio">{t("Last seen {time}", { time: lastSeenLabel })}</p>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

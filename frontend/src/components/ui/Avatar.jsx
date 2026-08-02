import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { resolveAvatarUrl, resolveDisplayName } from "../../lib/userProfile";
import { getStaticAvatarFrame, isAnimatedAvatarUrl } from "../../lib/gifAvatar";

const PALETTES = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#9b59b6", "#3498db"];

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Discord-like avatar.
 *
 * animate:
 *  - "hover" (default): GIFs play while hovered (message avatars)
 *  - "always": GIFs always loop (nav rail profile)
 *  - "speaking": GIFs play while isSpeaking is true (voice chat)
 *  - "never": never animate GIFs
 */
export function Avatar({
  name,
  size = 36,
  imageUrl,
  user,
  onClick,
  animate = "hover",
  isSpeaking = false,
  className = "",
  loading: loadingProp,
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [staticFrame, setStaticFrame] = useState(null);
  const [frameReady, setFrameReady] = useState(false);
  const [useBareUrl, setUseBareUrl] = useState(false);

  const displayName = name || resolveDisplayName(user);
  const letter = (displayName && displayName[0] ? displayName[0] : "?").toUpperCase();
  const bg = PALETTES[hashString(displayName || "") % PALETTES.length];

  // Prefer full user object, but fall back to imageUrl when user lacks avatar fields.
  const source = useMemo(() => {
    if (user) {
      const hasAvatar = Boolean(user.avatarUrl || user.avatar_url || user.initiatorAvatarUrl);
      if (hasAvatar) return user;
      if (imageUrl) return { ...user, avatarUrl: imageUrl };
      return user;
    }
    if (imageUrl) return { avatarUrl: imageUrl };
    return null;
  }, [user, imageUrl]);

  const resolvedUrl = source ? resolveAvatarUrl(source) : null;
  const bareUrl = resolvedUrl ? resolvedUrl.split("?")[0] : null;
  const activeUrl = useBareUrl && bareUrl ? bareUrl : resolvedUrl;
  const animated = isAnimatedAvatarUrl(activeUrl || resolvedUrl);
  const showImage = Boolean(activeUrl) && !failed;

  const shouldAnimate = useMemo(() => {
    if (!animated) return false;
    if (animate === "always") return true;
    if (animate === "never") return false;
    if (animate === "speaking") return Boolean(isSpeaking);
    return hovered || Boolean(isSpeaking);
  }, [animated, animate, hovered, isSpeaking]);

  const displaySrc = useMemo(() => {
    if (!activeUrl) return null;
    if (!animated) return activeUrl;
    if (shouldAnimate) return activeUrl;
    if (frameReady && staticFrame) return staticFrame;
    // CORS freeze failed — keep showing GIF rather than letter forever.
    if (frameReady && !staticFrame) return activeUrl;
    return null;
  }, [activeUrl, animated, shouldAnimate, frameReady, staticFrame]);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setStaticFrame(null);
    setFrameReady(false);
    setUseBareUrl(false);
  }, [resolvedUrl]);

  useEffect(() => {
    if (!activeUrl || !animated || shouldAnimate) {
      if (!animated) setFrameReady(true);
      return undefined;
    }
    let cancelled = false;
    getStaticAvatarFrame(activeUrl).then((frame) => {
      if (cancelled) return;
      setStaticFrame(frame);
      setFrameReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [activeUrl, animated, shouldAnimate]);

  useEffect(() => {
    setLoaded(false);
  }, [displaySrc]);

  const eager =
    loadingProp === "eager" ||
    loadingProp === true ||
    animate === "always" ||
    size >= 56;

  return (
    <motion.div
      className={`ui-avatar ${className}`.trim()}
      style={{
        width: size,
        height: size,
        background: showImage ? "var(--surface-2)" : bg,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: onClick ? 1.06 : 1 }}
      role={onClick ? "button" : undefined}
    >
      {showImage ? (
        <>
          {!loaded && (
            <span
              className="ui-avatar-letter"
              style={{ position: "absolute", opacity: 0.45 }}
            >
              {letter}
            </span>
          )}
          {displaySrc ? (
            <img
              key={displaySrc}
              src={displaySrc}
              alt=""
              className="ui-avatar-img"
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => {
                if (!useBareUrl && bareUrl && activeUrl !== bareUrl) {
                  setUseBareUrl(true);
                  setFailed(false);
                  setLoaded(false);
                  return;
                }
                setFailed(true);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: loaded ? 1 : 0,
                transition: "opacity 0.15s ease",
              }}
            />
          ) : null}
        </>
      ) : (
        <span className="ui-avatar-letter">{letter}</span>
      )}
    </motion.div>
  );
}

export default Avatar;

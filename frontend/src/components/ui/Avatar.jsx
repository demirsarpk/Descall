import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { resolveAvatarUrl, resolveDisplayName } from "../../lib/userProfile";
import { getStaticAvatarFrame, isAnimatedAvatarUrl } from "../../lib/gifAvatar";
import { avatarEffectClass } from "./Cosmetics";

const PALETTES = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#9b59b6", "#3498db"];

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function imgIsReady(img) {
  return Boolean(img && img.complete && img.naturalWidth > 0);
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
  const [useBareUrl, setUseBareUrl] = useState(false);
  const [stickySrc, setStickySrc] = useState(null);
  const imgRef = useRef(null);

  const displayName = name || resolveDisplayName(user);
  const letter = (displayName && displayName[0] ? displayName[0] : "?").toUpperCase();
  const bg = PALETTES[hashString(displayName || "") % PALETTES.length];

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

  const shouldAnimate = useMemo(() => {
    if (!animated) return false;
    if (animate === "always") return true;
    if (animate === "never") return false;
    if (animate === "speaking") return Boolean(isSpeaking);
    return hovered || Boolean(isSpeaking);
  }, [animated, animate, hovered, isSpeaking]);

  // Always keep a concrete src when avatar URL is known — never letter-only "loading gap".
  const displaySrc = useMemo(() => {
    if (!activeUrl) return stickySrc;
    if (!animated) return activeUrl;
    if (shouldAnimate) return activeUrl;
    if (staticFrame) return staticFrame;
    return activeUrl;
  }, [activeUrl, animated, shouldAnimate, staticFrame, stickySrc]);

  useEffect(() => {
    setFailed(false);
    setUseBareUrl(false);
    setStaticFrame(null);
  }, [resolvedUrl]);

  useEffect(() => {
    if (!activeUrl || !animated || shouldAnimate) return undefined;
    let cancelled = false;
    getStaticAvatarFrame(activeUrl).then((frame) => {
      if (cancelled || !frame) return;
      setStaticFrame(frame);
    });
    return () => {
      cancelled = true;
    };
  }, [activeUrl, animated, shouldAnimate]);

  const noteGoodSrc = useCallback((src) => {
    if (!src || src.startsWith("data:")) return;
    setStickySrc(src);
  }, []);

  const syncLoadedFromEl = useCallback(
    (el) => {
      if (!el) return;
      if (imgIsReady(el)) {
        noteGoodSrc(el.currentSrc || el.src);
        setLoaded(true);
        setFailed(false);
      }
    },
    [noteGoodSrc]
  );

  const setImgNode = useCallback(
    (el) => {
      imgRef.current = el;
      syncLoadedFromEl(el);
    },
    [syncLoadedFromEl]
  );

  // Critical: cached images often skip onLoad after React updates.
  // Re-read img.complete whenever src changes so we never stick on the letter.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !displaySrc) {
      setLoaded(false);
      return undefined;
    }
    if (imgIsReady(el)) {
      noteGoodSrc(el.currentSrc || el.src || displaySrc);
      setLoaded(true);
      return undefined;
    }
    setLoaded(false);
    const id = requestAnimationFrame(() => syncLoadedFromEl(imgRef.current));
    return () => cancelAnimationFrame(id);
  }, [displaySrc, noteGoodSrc, syncLoadedFromEl]);

  const eager =
    loadingProp === "eager" ||
    loadingProp === true ||
    animate === "always" ||
    size >= 56;

  const showImage = Boolean(displaySrc) && !failed;
  const frameUrl = user?.equippedAvatarFrame?.asset_url || null;
  const effectClass = avatarEffectClass(user);

  return (
    <motion.div
      className={`ui-avatar ${frameUrl ? "has-frame" : ""} ${className}`.trim()}
      style={{
        width: size,
        height: size,
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
      {effectClass && <div className={effectClass} aria-hidden />}
      <div
        className="ui-avatar-inner"
        style={{
          width: "100%",
          height: "100%",
          background: showImage ? "var(--surface-2)" : bg,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
      {showImage ? (
        <>
          {!loaded && (
            <span className="ui-avatar-letter" style={{ position: "absolute", opacity: 0.3 }} aria-hidden>
              {letter}
            </span>
          )}
          <img
            ref={setImgNode}
            src={displaySrc}
            alt=""
            className="ui-avatar-img"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onLoad={(e) => {
              noteGoodSrc(e.currentTarget.currentSrc || e.currentTarget.src || displaySrc);
              setLoaded(true);
              setFailed(false);
            }}
            onError={() => {
              if (!useBareUrl && bareUrl && displaySrc !== bareUrl) {
                setUseBareUrl(true);
                setFailed(false);
                return;
              }
              setFailed(true);
              setLoaded(false);
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // If the browser already decoded the bitmap, never hide it behind the letter.
              opacity: loaded || (imgRef.current && imgIsReady(imgRef.current)) ? 1 : 0,
              transition: "opacity 0.12s ease",
            }}
          />
        </>
      ) : (
        <span className="ui-avatar-letter">{letter}</span>
      )}
      </div>
      {frameUrl && (
        <img
          className="ui-avatar-frame-overlay"
          src={frameUrl}
          alt=""
          draggable={false}
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "132%",
            height: "132%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            objectFit: "contain",
          }}
        />
      )}
    </motion.div>
  );
}

export default Avatar;

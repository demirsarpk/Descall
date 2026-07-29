import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { resolveAvatarUrl, resolveDisplayName } from "../../lib/userProfile";

const PALETTES = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#9b59b6", "#3498db"];

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = 36, imageUrl, user, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const displayName = name || resolveDisplayName(user);
  const letter = (displayName && displayName[0] ? displayName[0] : "?").toUpperCase();
  const bg = PALETTES[hashString(displayName || "") % PALETTES.length];

  const source = user || (imageUrl ? { avatarUrl: imageUrl } : null);
  const resolvedUrl = source ? resolveAvatarUrl(source) : null;
  const showImage = resolvedUrl && !failed;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [resolvedUrl]);

  return (
    <motion.div
      className="ui-avatar"
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
      whileHover={{ scale: onClick ? 1.06 : 1 }}
      role={onClick ? "button" : undefined}
    >
      {showImage ? (
        <>
          {!loaded && (
            <span
              className="ui-avatar-letter"
              style={{ position: "absolute", opacity: 0.5 }}
            >
              {letter}
            </span>
          )}
          <img
            src={resolvedUrl}
            alt=""
            className="ui-avatar-img"
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          />
        </>
      ) : (
        <span className="ui-avatar-letter">{letter}</span>
      )}
    </motion.div>
  );
}

export default Avatar;

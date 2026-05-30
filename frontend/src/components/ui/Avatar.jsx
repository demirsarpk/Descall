import { motion } from "framer-motion";

const PALETTES = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#9b59b6", "#3498db"];

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name = "?", size = 36, imageUrl, onClick }) {
  const letter = (name && name[0] ? name[0] : "?").toUpperCase();
  const bg = PALETTES[hashString(name || "") % PALETTES.length];
  return (
    <motion.div
      className="ui-avatar"
      style={{ width: size, height: size, background: imageUrl ? "transparent" : bg, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClick}
      whileHover={{ scale: onClick ? 1.06 : 1 }}
      role={onClick ? "button" : undefined}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="ui-avatar-img" />
      ) : (
        <span className="ui-avatar-letter">{letter}</span>
      )}
    </motion.div>
  );
}

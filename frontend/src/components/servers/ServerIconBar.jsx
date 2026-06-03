import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Compass } from "lucide-react";
import CreateGuildModal from "./CreateGuildModal";
import JoinGuildModal from "./JoinGuildModal";

function GuildIcon({ guild, isActive, onClick }) {
  const initials = guild.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.button
      className={`guild-nav-icon ${isActive ? "active" : ""}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={guild.name}
    >
      <div className="guild-nav-pill" />
      {guild.iconUrl ? (
        <img src={guild.iconUrl} alt={guild.name} className="guild-nav-img" />
      ) : (
        <div className="guild-nav-default">{initials}</div>
      )}
    </motion.button>
  );
}

export default function ServerIconBar({
  guilds,
  activeGuild,
  onGuildSelect,
  onCreateGuild,
  onJoinGuild,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const sortedGuilds = [...(guilds || [])].sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return (
    <div className="server-icon-bar">
      {/* Home/DM button */}
      <motion.button
        className={`guild-home-btn ${!activeGuild ? "active" : ""}`}
        onClick={() => onGuildSelect(null)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Direct Messages"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </motion.button>

      <div className="guild-icons-divider" />

      {/* Guild icons scroll */}
      <div className="guild-icons-scroll">
        {sortedGuilds.map((guild) => (
          <GuildIcon
            key={guild.id}
            guild={guild}
            isActive={activeGuild?.id === guild.id}
            onClick={() => onGuildSelect(guild)}
          />
        ))}
      </div>

      <div className="guild-icons-divider" />

      {/* Add/Explore buttons */}
      <motion.button
        className="guild-action-btn add"
        onClick={() => setShowCreate(true)}
        whileHover={{ scale: 1.05, borderRadius: "10px" }}
        whileTap={{ scale: 0.95 }}
        title="Add a Server"
      >
        <Plus size={20} />
      </motion.button>

      <motion.button
        className="guild-action-btn explore"
        onClick={() => setShowJoin(true)}
        whileHover={{ scale: 1.05, borderRadius: "10px" }}
        whileTap={{ scale: 0.95 }}
        title="Join a Server"
      >
        <Compass size={20} />
      </motion.button>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateGuildModal
            onClose={() => setShowCreate(false)}
            onCreate={async (data) => {
              await onCreateGuild(data);
              setShowCreate(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showJoin && (
          <JoinGuildModal
            onClose={() => setShowJoin(false)}
            onJoin={async (code) => {
              await onJoinGuild(code);
              setShowJoin(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

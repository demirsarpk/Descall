import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Compass, X, Hash, Volume2, ChevronDown, ChevronRight, UserPlus, Settings, LogOut, Trash2, Copy, Check } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import CreateGuildModal from "./CreateGuildModal";
import JoinGuildModal from "./JoinGuildModal";

function GuildIcon({ guild, isActive, onClick, hasUnread }) {
  const initials = guild.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.button
      className={`server-icon-wrapper ${isActive ? "active" : ""} ${hasUnread ? "unread" : ""}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={guild.name}
    >
      <div className="server-pill" />
      {guild.iconUrl ? (
        <img src={guild.iconUrl} alt={guild.name} className="server-icon-img" />
      ) : (
        <div className="server-icon-default">{initials}</div>
      )}
    </motion.button>
  );
}

function ChannelItem({ channel, isActive, onClick, guild }) {
  const Icon = channel.type === "voice" ? Volume2 : Hash;
  const isCategory = channel.type === "category";

  if (isCategory) {
    return (
      <div className="channel-category">
        <ChevronDown size={12} className="channel-category-chevron" />
        <span className="channel-category-name">{channel.name}</span>
      </div>
    );
  }

  return (
    <motion.button
      className={`channel-item ${isActive ? "active" : ""}`}
      onClick={onClick}
      whileHover={{ x: 2 }}
    >
      <Icon size={18} className="channel-item-icon" />
      <span className="channel-item-name">{channel.name}</span>
    </motion.button>
  );
}

export default function ServerList({
  guilds,
  activeGuild,
  activeChannel,
  onGuildSelect,
  onChannelSelect,
  onCreateGuild,
  onJoinGuild,
  onLeaveGuild,
  onDeleteGuild,
  onCreateChannel,
  onRefreshGuilds,
  me,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showGuildMenu, setShowGuildMenu] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const menuRef = useRef(null);

  const sortedGuilds = [...(guilds || [])].sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const handleCopyInvite = async (guildId) => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/invites`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      const invite = data.invites?.[0];
      if (invite) {
        await navigator.clipboard.writeText(invite.code);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const activeChannels = activeGuild?.channels || [];

  return (
    <div className="server-list-container">
      {/* Home / DMs button */}
      <motion.button
        className={`server-home-btn ${!activeGuild ? "active" : ""}`}
        onClick={() => onGuildSelect(null)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Direct Messages"
      >
        <div className="server-pill" />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </motion.button>

      <div className="server-divider" />

      {/* Guild list */}
      <div className="server-icons-scroll">
        {sortedGuilds.map((guild) => (
          <GuildIcon
            key={guild.id}
            guild={guild}
            isActive={activeGuild?.id === guild.id}
            onClick={() => onGuildSelect(guild)}
            hasUnread={false}
          />
        ))}
      </div>

      <div className="server-divider" />

      {/* Add server */}
      <motion.button
        className="server-add-btn"
        onClick={() => setShowCreate(true)}
        whileHover={{ scale: 1.05, borderRadius: "14px" }}
        whileTap={{ scale: 0.95 }}
        title="Add a Server"
      >
        <Plus size={24} />
      </motion.button>

      {/* Explore servers */}
      <motion.button
        className="server-explore-btn"
        onClick={() => setShowJoin(true)}
        whileHover={{ scale: 1.05, borderRadius: "14px" }}
        whileTap={{ scale: 0.95 }}
        title="Explore Public Servers"
      >
        <Compass size={24} />
      </motion.button>

      {/* Guild Channel Sidebar (when a guild is active) */}
      <AnimatePresence>
        {activeGuild && (
          <motion.div
            className="guild-sidebar"
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Guild header */}
            <div className="guild-header">
              <h3 className="guild-header-name">{activeGuild.name}</h3>
              <button
                className="guild-header-menu-btn"
                onClick={() => setShowGuildMenu(showGuildMenu === activeGuild.id ? null : activeGuild.id)}
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Guild dropdown menu */}
            <AnimatePresence>
              {showGuildMenu === activeGuild.id && (
                <motion.div
                  className="guild-dropdown"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  ref={menuRef}
                >
                  {activeGuild.isOwner ? (
                    <>
                      <button className="guild-dropdown-item" onClick={() => handleCopyInvite(activeGuild.id)}>
                        {inviteCopied ? <Check size={16} /> : <Copy size={16} />}
                        <span>{inviteCopied ? "Copied!" : "Copy Invite"}</span>
                      </button>
                      <button className="guild-dropdown-item" onClick={() => {}}>
                        <Settings size={16} />
                        <span>Server Settings</span>
                      </button>
                      <div className="guild-dropdown-divider" />
                      <button
                        className="guild-dropdown-item danger"
                        onClick={() => { onDeleteGuild(activeGuild.id); setShowGuildMenu(null); }}
                      >
                        <Trash2 size={16} />
                        <span>Delete Server</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="guild-dropdown-item" onClick={() => { onLeaveGuild(activeGuild.id); setShowGuildMenu(null); }}>
                        <LogOut size={16} />
                        <span>Leave Server</span>
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channels list */}
            <div className="guild-channels-scroll">
              {activeChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannel?.id === channel.id}
                  onClick={() => onChannelSelect(channel)}
                  guild={activeGuild}
                />
              ))}

              {/* Add channel button (owner only for now) */}
              {activeGuild.isOwner && (
                <button className="channel-add-btn" onClick={() => onCreateChannel?.(activeGuild.id)}>
                  <Plus size={14} />
                  <span>Add Channel</span>
                </button>
              )}
            </div>

            {/* User panel at bottom */}
            <div className="guild-user-panel">
              <Avatar name={me?.username || "User"} size={32} imageUrl={me?.avatarUrl} />
              <div className="guild-user-info">
                <span className="guild-user-name">{me?.username}</span>
                <span className="guild-user-status">Online</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

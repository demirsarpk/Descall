import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Compass, X, Hash, Volume2, ChevronDown, LogOut, Trash2, Copy, Check, Settings, Users } from "lucide-react";
import { Avatar } from "../ui/Avatar";
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

function ChannelItem({ channel, isActive, onClick }) {
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

export default function ServerSidebar({
  guilds,
  activeGuild,
  activeChannel,
  onGuildSelect,
  onChannelSelect,
  onCreateGuild,
  onJoinGuild,
  onLeaveGuild,
  onDeleteGuild,
  onRefreshGuilds,
  me,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showGuildMenu, setShowGuildMenu] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const sortedGuilds = [...(guilds || [])].sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const handleCopyInvite = async () => {
    if (!activeGuild) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/guilds/${activeGuild.id}/invites`, {
        headers: { Authorization: `Bearer ${token}` },
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
    <div className="server-sidebar-container">
      {/* Guild icons row at top */}
      <div className="guild-icons-row">
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
      </div>

      {/* Channel list area */}
      <div className="guild-channel-area">
        {activeGuild ? (
          <>
            {/* Guild header */}
            <div className="guild-channel-header">
              <h3 className="guild-channel-header-name">{activeGuild.name}</h3>
              <button
                className="guild-channel-header-menu"
                onClick={() => setShowGuildMenu(!showGuildMenu)}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Guild dropdown */}
            <AnimatePresence>
              {showGuildMenu && (
                <motion.div
                  className="guild-channel-dropdown"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {activeGuild.isOwner ? (
                    <>
                      <button className="guild-dropdown-item" onClick={() => { handleCopyInvite(); setShowGuildMenu(false); }}>
                        {inviteCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{inviteCopied ? "Copied!" : "Copy Invite"}</span>
                      </button>
                      <button className="guild-dropdown-item" onClick={() => setShowGuildMenu(false)}>
                        <Settings size={14} />
                        <span>Server Settings</span>
                      </button>
                      <div className="guild-dropdown-divider" />
                      <button
                        className="guild-dropdown-item danger"
                        onClick={() => { onDeleteGuild(activeGuild.id); setShowGuildMenu(false); }}
                      >
                        <Trash2 size={14} />
                        <span>Delete Server</span>
                      </button>
                    </>
                  ) : (
                    <button
                      className="guild-dropdown-item danger"
                      onClick={() => { onLeaveGuild(activeGuild.id); setShowGuildMenu(false); }}
                    >
                      <LogOut size={14} />
                      <span>Leave Server</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channels */}
            <div className="guild-channels-list">
              {activeChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannel?.id === channel.id}
                  onClick={() => onChannelSelect(channel)}
                />
              ))}
            </div>
          </>
        ) : (
          /* No guild selected — show placeholder */
          <div className="guild-empty-state">
            <Users size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>Select a server or create one</p>
          </div>
        )}
      </div>

      {/* User panel at bottom */}
      <div className="guild-sidebar-user-panel">
        <Avatar name={me?.username || "User"} size={32} imageUrl={me?.avatarUrl} />
        <div className="guild-sidebar-user-info">
          <span className="guild-sidebar-user-name">{me?.username}</span>
          <span className="guild-sidebar-user-status">Online</span>
        </div>
      </div>

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

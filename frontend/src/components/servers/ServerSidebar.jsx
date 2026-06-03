import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Volume2, ChevronDown, ChevronRight, LogOut, Trash2, Copy, Check, Settings, Users } from "lucide-react";

function ChannelItem({ channel, isActive, onClick }) {
  const Icon = channel.type === "voice" ? Volume2 : Hash;
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

function ChannelCategory({ name, expanded, onToggle, children }) {
  return (
    <div className="channel-category-group">
      <button className="channel-category" onClick={onToggle}>
        <ChevronRight
          size={12}
          className="channel-category-chevron"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        />
        <span className="channel-category-name">{name}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="channel-category-children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ServerSidebar({
  activeGuild,
  activeChannel,
  onChannelSelect,
  onLeaveGuild,
  onDeleteGuild,
}) {
  const [showGuildMenu, setShowGuildMenu] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

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

  const toggleCategory = (name) => {
    setExpandedCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Group channels by category for collapsible rendering
  const channelTree = useMemo(() => {
    const tree = [];
    let currentCategory = null;
    for (const ch of activeChannels) {
      if (ch.type === "category") {
        currentCategory = { category: ch, channels: [] };
        tree.push(currentCategory);
      } else if (currentCategory) {
        currentCategory.channels.push(ch);
      } else {
        tree.push({ channels: [ch] });
      }
    }
    return tree;
  }, [activeChannels]);

  return (
    <div className="server-sidebar-container">
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

              {/* Guild dropdown - positioned inside header for correct relative context */}
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
            </div>

            {/* Channels */}
            <div className="guild-channels-list">
              {channelTree.map((group, idx) => {
                if (group.category) {
                  const isExpanded = expandedCategories[group.category.name] !== false;
                  return (
                    <ChannelCategory
                      key={group.category.id || idx}
                      name={group.category.name}
                      expanded={isExpanded}
                      onToggle={() => toggleCategory(group.category.name)}
                    >
                      {group.channels.map((channel) => (
                        <ChannelItem
                          key={channel.id}
                          channel={channel}
                          isActive={activeChannel?.id === channel.id}
                          onClick={() => onChannelSelect(channel)}
                        />
                      ))}
                    </ChannelCategory>
                  );
                }
                return group.channels.map((channel) => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={activeChannel?.id === channel.id}
                    onClick={() => onChannelSelect(channel)}
                  />
                ));
              })}
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

    </div>
  );
}

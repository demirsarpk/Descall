import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import StatusBadge from '../ui/StatusBadge';

const TYPE_COLOR = {
  game:          '#23a55a',
  music:         '#1db954',
  dev:           '#5865f2',
  creative:      '#eb459e',
  browser:       '#4f9ef8',
  communication: '#5865f2',
  media:         '#f0b232',
  launcher:      '#747f8d',
  manual:        '#5865f2',
  app:           '#747f8d',
};

function PresenceCard({ friend, presence, onlineUsers }) {
  const isOnline = onlineUsers?.has?.(friend.id) || onlineUsers?.includes?.(friend.id);
  const accentColor = presence ? (TYPE_COLOR[presence.appType] || '#5865f2') : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="activity-presence-card"
      style={{ borderLeftColor: accentColor || 'transparent' }}
    >
      <div className="activity-presence-avatar">
        <Avatar user={friend} size={36} />
        <StatusBadge online={isOnline} size={10} />
      </div>
      <div className="activity-presence-info">
        <span className="activity-presence-name">{friend.username}</span>
        {presence ? (
          <span className="activity-presence-status" style={{ color: accentColor }}>
            <span className="activity-presence-icon">{presence.icon || '🎮'}</span>
            {presence.displayName}
          </span>
        ) : (
          <span className="activity-presence-idle">Online</span>
        )}
      </div>
    </motion.div>
  );
}

export default function ActivitySidebar({ friends, friendPresence, onlineUsers }) {
  const { active, idle } = useMemo(() => {
    const active = [];
    const idle   = [];
    for (const friend of (friends || [])) {
      const presence = friendPresence?.[friend.id];
      const isOnline = onlineUsers?.has?.(friend.id) || onlineUsers?.includes?.(friend.id);
      if (!isOnline) continue;
      if (presence?.displayName) {
        active.push({ friend, presence });
      } else {
        idle.push({ friend, presence: null });
      }
    }
    // Sort active by type priority
    active.sort((a, b) => {
      const typeOrder = ['game', 'music', 'creative', 'dev', 'media', 'browser', 'communication', 'app', 'manual'];
      return typeOrder.indexOf(a.presence?.appType) - typeOrder.indexOf(b.presence?.appType);
    });
    return { active, idle };
  }, [friends, friendPresence, onlineUsers]);

  return (
    <aside className="sidebar-secondary">
      <div className="sidebar-inner">
        <div className="sidebar-header">
          <h2 className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: 'var(--primary)' }} />
            Activity
          </h2>
        </div>

        <div className="sidebar-content" style={{ padding: '8px 8px 16px' }}>
          {active.length > 0 && (
            <div className="activity-sidebar-section">
              <div className="activity-sidebar-label">
                Active Now — {active.length}
              </div>
              <AnimatePresence initial={false}>
                {active.map(({ friend, presence }) => (
                  <PresenceCard
                    key={friend.id}
                    friend={friend}
                    presence={presence}
                    onlineUsers={onlineUsers}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {idle.length > 0 && (
            <div className="activity-sidebar-section" style={{ marginTop: active.length ? 16 : 0 }}>
              <div className="activity-sidebar-label">
                Online — {idle.length}
              </div>
              <AnimatePresence initial={false}>
                {idle.map(({ friend }) => (
                  <PresenceCard
                    key={friend.id}
                    friend={friend}
                    presence={null}
                    onlineUsers={onlineUsers}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {active.length === 0 && idle.length === 0 && (
            <div className="activity-empty-state">
              <Zap size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <p>No friends online</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, Edit3, X, ChevronDown, Lock, Users, EyeOff, Monitor } from 'lucide-react';
import { useT } from '../../context/LocaleContext';

const TYPE_COLOR = {
  game:     '#23a55a',
  music:    '#1db954',
  dev:      '#5865f2',
  creative: '#eb459e',
  browser:  '#4f9ef8',
  media:    '#f0b232',
  manual:   '#5865f2',
  app:      '#747f8d',
};

function getPrivacyOptions(t) {
  return [
    { value: 'friends', label: t('Visible to Friends'), icon: Users,  desc: t('Friends can see your activity') },
    { value: 'only-me', label: t('Only Me'),            icon: Lock,   desc: t('Shows as "Online" to friends') },
    { value: 'hidden',  label: t('Hidden'),             icon: EyeOff, desc: t('Hidden from activity panel') },
  ];
}

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatRelativeTime(dateStr, t) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return t('{count}d ago', { count: d });
  if (h > 0) return t('{count}h ago', { count: h });
  if (m > 0) return t('{count}m ago', { count: m });
  return t('just now');
}

function CurrentActivityCard({ activity, manualOverride, onClearManual, isElectron }) {
  const t = useT();
  const accentColor = activity ? (TYPE_COLOR[activity.appType] || '#5865f2') : '#5865f2';

  return (
    <div className="activity-current-card" style={{ borderColor: accentColor }}>
      <div className="activity-current-header">
        <div className="activity-current-icon-wrap" style={{ background: `${accentColor}22` }}>
          <span style={{ fontSize: 28 }}>{activity?.icon || '💤'}</span>
        </div>
        <div className="activity-current-info">
          <div className="activity-current-label">
            {activity ? t('Currently Active') : t('No Activity Detected')}
          </div>
          <div className="activity-current-display" style={{ color: activity ? accentColor : 'var(--text-muted)' }}>
            {activity?.displayName || (isElectron ? t('Launch a game or app to start tracking') : t('Manual status only in browser'))}
          </div>
          {activity?.startedAt && (
            <div className="activity-current-since">
              {t('Started {time}', { time: formatRelativeTime(activity.startedAt, t) })}
            </div>
          )}
        </div>
        {manualOverride && (
          <button className="activity-clear-manual-btn" onClick={onClearManual} title={t('Clear manual status')}>
            <X size={16} />
          </button>
        )}
      </div>
      {!isElectron && (
        <div className="activity-web-notice">
          <Monitor size={14} />
          <span>{t('Automatic activity detection requires the')} <strong>{t('Descall desktop app')}</strong></span>
        </div>
      )}
    </div>
  );
}

function ManualStatusModal({ onSet, onClose }) {
  const t = useT();
  const [text, setText] = useState('');
  const [expiresIn, setExpiresIn] = useState('4h');

  const SUGGESTIONS = [
    `🎮 ${t('Gaming')}`, `🎵 ${t('Listening to Music')}`, `📚 ${t('Studying')}`, `💼 ${t('Working')}`,
    `🍕 ${t('Taking a break')}`, `🎬 ${t('Watching something')}`, `💻 ${t('Coding')}`,
  ];

  return (
    <motion.div
      className="activity-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="activity-modal"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.92,    y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="activity-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Edit3 size={18} style={{ color: 'var(--primary)' }} />
            <h3>{t('Set Custom Status')}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <input
          className="activity-modal-input"
          placeholder={t('What are you up to?')}
          value={text}
          maxLength={80}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && text.trim() && onSet(text.trim(), expiresIn)}
          autoFocus
        />

        <div className="activity-modal-suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s} className="activity-suggestion-chip" onClick={() => setText(s.slice(3).trim())}>
              {s}
            </button>
          ))}
        </div>

        <div className="activity-modal-expiry">
          <span className="activity-modal-label">{t('Clears in')}</span>
          <div className="activity-expiry-options">
            {[['1h', t('1 Hour')], ['4h', t('4 Hours')], [null, t('Until Cleared')]].map(([val, label]) => (
              <button
                key={label}
                className={`activity-expiry-btn${expiresIn === val ? ' active' : ''}`}
                onClick={() => setExpiresIn(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="activity-modal-submit"
          disabled={!text.trim()}
          onClick={() => onSet(text.trim(), expiresIn)}
        >
          {t('Set Status')}
        </button>
      </motion.div>
    </motion.div>
  );
}

function HistoryRow({ entry }) {
  const t = useT();
  const accentColor = TYPE_COLOR[entry.app_type] || '#747f8d';
  return (
    <div className="activity-history-row">
      <div className="activity-history-icon" style={{ color: accentColor }}>
        {entry.app_type === 'game' ? '🎮' : entry.app_type === 'music' ? '🎵' : entry.app_type === 'dev' ? '💻' : entry.app_type === 'creative' ? '🎨' : '📱'}
      </div>
      <div className="activity-history-info">
        <span className="activity-history-name">{entry.display_name}</span>
        <span className="activity-history-time">{formatRelativeTime(entry.started_at, t)}</span>
      </div>
      <div className="activity-history-duration">
        {formatDuration(entry.duration_sec)}
      </div>
    </div>
  );
}

export default function ActivityView({
  me,
  currentActivity,
  manualOverride,
  history,
  friendPresence,
  friends,
  settings,
  isElectron,
  onSetManual,
  onClearManual,
  onUpdatePrivacy,
  onlineUsers,
}) {
  const t = useT();
  const [showManualModal,  setShowManualModal]  = useState(false);
  const [showPrivacyMenu,  setShowPrivacyMenu]  = useState(false);
  const [activeTab,        setActiveTab]        = useState('history');

  const PRIVACY_OPTIONS = getPrivacyOptions(t);
  const currentPrivacy = PRIVACY_OPTIONS.find(p => p.value === settings.privacy) || PRIVACY_OPTIONS[0];
  const PrivacyIcon    = currentPrivacy.icon;

  const friendFeed = Object.entries(friendPresence)
    .map(([userId, pres]) => {
      const friend = friends?.find(f => f.id === userId);
      if (!friend || !pres?.displayName) return null;
      return { friend, pres };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.pres.startedAt || 0) - new Date(a.pres.startedAt || 0));

  return (
    <div className="activity-view">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="activity-view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="activity-header-icon">
            <Zap size={20} />
          </div>
          <div>
            <h1 className="activity-view-title">{t('Activity')}</h1>
            <p className="activity-view-subtitle">{t('Your presence and history')}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Privacy selector */}
          <div className="activity-privacy-selector" style={{ position: 'relative' }}>
            <button
              className="activity-privacy-btn"
              onClick={() => setShowPrivacyMenu(v => !v)}
            >
              <PrivacyIcon size={14} />
              <span>{currentPrivacy.label}</span>
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showPrivacyMenu && (
                <motion.div
                  className="activity-privacy-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0,  scale: 1 }}
                  exit={{ opacity: 0,   y: -6,  scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  {PRIVACY_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        className={`activity-privacy-option${settings.privacy === opt.value ? ' active' : ''}`}
                        onClick={() => { onUpdatePrivacy(opt.value); setShowPrivacyMenu(false); }}
                      >
                        <Icon size={14} />
                        <div>
                          <div>{opt.label}</div>
                          <div className="activity-privacy-option-desc">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Manual status */}
          <button className="activity-set-status-btn" onClick={() => setShowManualModal(true)}>
            <Edit3 size={14} />
            <span>{t('Set Status')}</span>
          </button>
        </div>
      </div>

      {/* ─── Current activity card ─────────────────────────────────────── */}
      <div className="activity-view-section">
        <CurrentActivityCard
          activity={currentActivity}
          manualOverride={manualOverride}
          onClearManual={onClearManual}
          isElectron={isElectron}
        />
      </div>

      {/* ─── Tabs ─────────────────────────────────────────────────────── */}
      <div className="activity-tabs">
        {['history', 'friends'].map(tab => (
          <button
            key={tab}
            className={`activity-tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'history' ? (
              <><Clock size={14} /> {t('History')}</>
            ) : (
              <><Zap size={14} /> {t('Friends')}</>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab content ──────────────────────────────────────────────── */}
      <div className="activity-tab-content">
        <AnimatePresence mode="wait">
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {history.length > 0 ? (
                <div className="activity-history-list">
                  {history.map(entry => (
                    <HistoryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="activity-tab-empty">
                  <Clock size={32} />
                  <p>{t('No activity history yet')}</p>
                  <span>{t('Start using apps and games to see them here')}</span>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {friendFeed.length > 0 ? (
                <div className="activity-friend-feed">
                  {friendFeed.map(({ friend, pres }) => {
                    const accentColor = TYPE_COLOR[pres.appType] || '#5865f2';
                    return (
                      <div key={friend.id} className="activity-friend-feed-row">
                        <div className="activity-friend-feed-avatar">
                          <img
                            src={friend.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=5865f2&color=fff&size=36`}
                            alt={friend.username}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        </div>
                        <div className="activity-friend-feed-info">
                          <span className="activity-friend-feed-name">{friend.username}</span>
                          <span className="activity-friend-feed-status" style={{ color: accentColor }}>
                            {pres.displayName}
                          </span>
                        </div>
                        <span className="activity-friend-feed-time">
                          {formatRelativeTime(pres.startedAt, t)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="activity-tab-empty">
                  <Zap size={32} />
                  <p>{t('No friend activity')}</p>
                  <span>{t("Friends' active sessions will appear here")}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Manual modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showManualModal && (
          <ManualStatusModal
            onSet={(text, exp) => { onSetManual(text, exp); setShowManualModal(false); }}
            onClose={() => setShowManualModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

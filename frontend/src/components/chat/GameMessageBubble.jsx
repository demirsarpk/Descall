import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Coins, AlertCircle, Gamepad2, 
  TrendingUp, RotateCcw, HelpCircle, Wallet,
  Crown, Target, Sparkles, ChevronDown, ChevronUp,
  BookOpen, Terminal, BarChart3, Medal, Star,
  Zap, Shield, Dice5, Info
} from "lucide-react";

// Advanced Discord-style Game UI
const SUIT_SYMBOLS = {
  '♠': { symbol: '♠', color: '#4a5568', bg: '#1a202c' },
  '♥': { symbol: '♥', color: '#e53e3e', bg: '#742a2a' },
  '♦': { symbol: '♦', color: '#e53e3e', bg: '#742a2a' },
  '♣': { symbol: '♣', color: '#4a5568', bg: '#1a202c' }
};

function PlayingCard({ card, hidden = false, index = 0 }) {
  if (hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ delay: index * 0.1, duration: 0.3 }}
        className="card-hidden"
      >
        <div className="card-back-pattern">🎰</div>
      </motion.div>
    );
  }

  const suit = SUIT_SYMBOLS[card.suit] || SUIT_SYMBOLS['♠'];
  const isRed = card.suit === '♥' || card.suit === '♦';

  return (
    <motion.div
      initial={{ y: -30, rotateZ: -5, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, rotateZ: 0, opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.15, type: "spring", stiffness: 200 }}
      className={`playing-card ${isRed ? 'red' : 'black'}`}
    >
      <div className="card-corner top-left">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-small">{suit.symbol}</span>
      </div>
      <div className="card-center">{suit.symbol}</div>
      <div className="card-corner bottom-right">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit-small">{suit.symbol}</span>
      </div>
    </motion.div>
  );
}

function HandDisplay({ cards, value, label, isDealer = false, hidden = false }) {
  const displayCards = hidden && cards.length > 1 ? [cards[0]] : cards;

  return (
    <div className={`hand-section ${isDealer ? 'dealer' : 'player'}`}>
      <div className="hand-header">
        <span className="hand-label">{label}</span>
        {value !== undefined && !hidden && (
          <motion.span className="hand-value" initial={{ scale: 0 }} animate={{ scale: 1 }} key={value}>
            {value}
          </motion.span>
        )}
        {hidden && <span className="hand-value hidden">?</span>}
      </div>
      <div className="cards-container">
        {displayCards.map((card, i) => (
          <PlayingCard key={card.id || i} card={card} index={i} />
        ))}
        {hidden && cards[1] && <PlayingCard key="hidden" hidden={true} index={cards.length} />}
      </div>
    </div>
  );
}

function ActionButton({ onClick, children, variant = 'primary', disabled = false }) {
  const variants = {
    primary: { bg: 'var(--primary)', hover: '#357abd' },
    success: { bg: '#22c55e', hover: '#16a34a' },
    danger: { bg: '#ef4444', hover: '#dc2626' },
    warning: { bg: '#f59e0b', hover: '#d97706' },
    info: { bg: '#3b82f6', hover: '#2563eb' }
  };
  
  const v = variants[variant] || variants.primary;

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`game-action-btn ${variant}`}
      style={{ background: v.bg, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </motion.button>
  );
}

function BetSelector({ onBet, credits, currentBet = 100 }) {
  const [bet, setBet] = useState(currentBet);
  const [showQuickBets, setShowQuickBets] = useState(false);

  const quickBets = [50, 100, 250, 500, 1000, 2500, 5000];
  const canBet = credits >= bet && bet >= 10;

  const adjustBet = (amount) => {
    const newBet = Math.max(10, Math.min(credits, bet + amount));
    setBet(newBet);
  };

  const handlePlay = () => {
    if (canBet && onBet) {
      console.log('[BetSelector] Playing with bet:', bet);
      onBet(bet);
    }
  };

  return (
    <div className="bet-selector-ui">
      <div className="bet-display">
        <div className="bet-icon-wrapper">
          <Wallet size={22} />
        </div>
        <div className="bet-amount-section">
          <span className="bet-label">Bahis Miktarı</span>
          <div className="bet-controls">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustBet(-10)} className="bet-adjust">−</motion.button>
            <span className="bet-value">{bet.toLocaleString()}</span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustBet(10)} className="bet-adjust">+</motion.button>
          </div>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: canBet ? 1.02 : 1 }}
        whileTap={{ scale: canBet ? 0.98 : 1 }}
        onClick={handlePlay}
        disabled={!canBet}
        className="play-btn"
      >
        <Gamepad2 size={18} />
        OYNA
      </motion.button>

      <button className="quick-bets-toggle" onClick={() => setShowQuickBets(!showQuickBets)}>
        {showQuickBets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        Hızlı Bahis
      </button>

      <AnimatePresence>
        {showQuickBets && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="quick-bets-grid"
          >
            {quickBets.map(amount => (
              <button
                key={amount}
                onClick={() => setBet(Math.min(amount, credits))}
                className={`quick-bet-chip ${bet === amount ? 'active' : ''} ${credits < amount ? 'disabled' : ''}`}
                disabled={credits < amount}
              >
                {amount >= 1000 ? `${amount/1000}K` : amount}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="credits-info">
        <Coins size={14} />
        <span>Bakiye: <strong>{credits.toLocaleString()}</strong></span>
      </div>
    </div>
  );
}

export default function GameMessageBubble({ 
  message, 
  isOwn = false,
  currentUserId,
  socket,
  onGameAction
}) {
  const { content, gameData, type, sender, groupId } = message;
  const [credits, setCredits] = useState(1000);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.emit('game:credits', (response) => {
        if (response?.credits !== undefined) setCredits(response.credits);
      });
    }
  }, [socket]);

  const handleStartGame = (bet) => {
    const targetGroupId = groupId || message.groupId;
    if (!socket || !targetGroupId) {
      console.error('[Game] Cannot start game: missing socket or groupId', { socket: !!socket, groupId: targetGroupId });
      return;
    }
    console.log('[Game] Starting game with bet:', bet, 'in group:', targetGroupId);
    socket.emit('game:command', { groupId: targetGroupId, command: 'bj', args: bet.toString() });
    if (onGameAction) onGameAction('start', bet);
  };

  const handleAction = (action) => {
    const targetGroupId = groupId || message.groupId;
    if (!socket || !targetGroupId) {
      console.error('[Game] Cannot handle action: missing socket or groupId', { socket: !!socket, groupId: targetGroupId });
      return;
    }
    if (action === 'start') {
      handleStartGame(gameData?.bet || 100);
    } else {
      console.log('[Game] Emitting game:action', { groupId: targetGroupId, action, gameId: gameData?.id });
      socket.emit('game:action', { groupId: targetGroupId, action: action, gameId: gameData?.id });
    }
    if (onGameAction) onGameAction(action);
  };

  // Modern UI for Help messages
  if (type === 'game_help' || content?.includes('CASINO BOT - YARDIM')) {
    return <ModernHelpMessage content={content} />;
  }

  // Modern UI for Credits messages  
  if (type === 'game_credits' || content?.includes('Bakiye Bilgisi') || content?.includes('Toplam Kazan')) {
    return <ModernCreditsMessage content={content} />;
  }

  // Modern UI for Leaderboard messages
  if (type === 'game_leaderboard' || type === 'game_top' || content?.includes('EN ZENGIN') || content?.includes('Lider Tablosu')) {
    return <ModernLeaderboardMessage content={content} />;
  }

  // Game Lobby View
  if (!gameData || gameData.status === 'finished') {
    return (
      <motion.div className="game-message-bubble lobby" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="game-bubble-header">
          <div className="bot-avatar"><Sparkles size={20} /></div>
          <div className="game-title-section">
            <h3>🎰 Blackjack</h3>
            <p>Krupiyeye karşı 21 yap!</p>
          </div>
        </div>
        <BetSelector onBet={handleStartGame} credits={credits} />
        <button className="rules-btn" onClick={() => handleAction('help')}>
          <HelpCircle size={14} /> Nasıl Oynanır?
        </button>
      </motion.div>
    );
  }

  const { playerHand, dealerHand, status, result, winAmount, bet, actions = [] } = gameData;
  const isPlaying = status === 'playing';
  const isFinished = status === 'finished';

  return (
    <motion.div className={`game-message-bubble ${isFinished ? 'finished' : ''} ${result === 'blackjack' ? 'blackjack' : ''}`}
      initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      
      <div className="game-bubble-header">
        <div className={`status-indicator ${isPlaying ? 'active' : result}`}>
          {isPlaying && <Target size={16} />}
          {result === 'win' && <Trophy size={16} />}
          {result === 'blackjack' && <Crown size={16} />}
          {result === 'loss' && <AlertCircle size={16} />}
          {result === 'push' && <Coins size={16} />}
        </div>
        <div className="game-info">
          <span className="game-status">
            {isPlaying ? 'Oynanıyor...' : 
             result === 'win' ? 'Kazandın!' :
             result === 'blackjack' ? 'BLACKJACK!' :
             result === 'loss' ? 'Kaybettin' :
             result === 'push' ? 'Berabere' : '🎰 Blackjack'}
          </span>
          <span className="game-bet">Bahis: {bet?.toLocaleString()} 💰</span>
        </div>
      </div>

      {isFinished && (
        <motion.div className={`result-banner ${result}`} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          {result === 'win' && <>+{(winAmount - bet).toLocaleString()}</>}
          {result === 'blackjack' && <>+{(winAmount - bet).toLocaleString()} (Blackjack!)</>}
          {result === 'loss' && <>-{bet.toLocaleString()}</>}
          {result === 'push' && <>Bahis İade: {bet.toLocaleString()}</>}
        </motion.div>
      )}

      <div className="game-board">
        <HandDisplay cards={dealerHand?.cards || []} value={dealerHand?.value} label="Krupiye" isDealer={true} hidden={isPlaying} />
        <HandDisplay cards={playerHand?.cards || []} value={playerHand?.value} label="Senin El" />
      </div>

      {isPlaying && (
        <div className="game-actions">
          <ActionButton onClick={() => handleAction('hit')} variant="success"><TrendingUp size={16} /> HIT</ActionButton>
          <ActionButton onClick={() => handleAction('stand')} variant="warning">STAND</ActionButton>
          {actions.includes('double') && <ActionButton onClick={() => handleAction('double')} variant="info">DOUBLE</ActionButton>}
        </div>
      )}

      {isFinished && (
        <div className="game-over-actions">
          <ActionButton onClick={() => handleStartGame(bet)} variant="primary"><RotateCcw size={16} /> Tekrar Oyna ({bet.toLocaleString()})</ActionButton>
          <ActionButton onClick={() => handleStartGame(Math.min(bet * 2, credits))} variant="success" disabled={credits < bet * 2}>
            Bahisi İkiye Katla
          </ActionButton>
        </div>
      )}

      <button className="expand-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? 'Küçült ▲' : 'Detaylar ▼'}
      </button>
    </motion.div>
  );
}

/* ==========================================
   MODERN HELP MESSAGE COMPONENT
   ========================================== */
function ModernHelpMessage({ content, onCommandClick }) {
  const lines = content.split('\n');
  const credits = lines.find(l => l.includes('Bakiyeniz'))?.match(/[\d,]+/)?.[0] || '0';
  
  const gameCommands = [
    { cmd: '/bj <miktar>', desc: 'Blackjack oyunu başlat', example: '/bj 100', icon: <Dice5 size={14} /> },
    { cmd: '/hit', desc: 'Kart çek (oyundayken)', icon: <Zap size={14} /> },
    { cmd: '/stand', desc: 'Bekle, turu bitir', icon: <Shield size={14} /> },
    { cmd: '/double', desc: 'Bahisi 2x yap', icon: <Coins size={14} /> },
  ];
  
  const infoCommands = [
    { cmd: '/credits', desc: 'Bakiye ve istatistikler', icon: <Wallet size={14} /> },
    { cmd: '/top', desc: 'En zengin 10 oyuncu', icon: <BarChart3 size={14} /> },
    { cmd: '/help', desc: 'Yardım mesajını göster', icon: <HelpCircle size={14} /> },
  ];
  
  const rules = [
    "21'e ulaşmaya çalış, geçme (Bust)!",
    "Krupiye 17'ye kadar çeker",
    "Blackjack (A+10) 3:2 öder (+150%)",
    "Normal kazanç 1:1 öder (+100%)"
  ];

  return (
    <motion.div 
      className="game-message-bubble help"
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Header */}
      <div className="game-bubble-header">
        <div className="bot-avatar"><BookOpen size={22} /></div>
        <div className="game-title-section">
          <h3>CASINO YARDIM</h3>
          <p>Tüm komutlar ve kurallar</p>
        </div>
      </div>
      
      {/* Credits Display */}
      <div className="credits-display-box">
        <span className="label"><Coins size={16} /> Mevcut Bakiye</span>
        <span className="amount">{parseInt(credits.replace(/,/g, '')).toLocaleString()} cr</span>
      </div>
      
      {/* Game Commands */}
      <div className="section-title"><Terminal size={16} /> Oyun Komutları</div>
      <div className="command-list">
        {gameCommands.map((item, idx) => (
          <motion.div 
            key={idx} 
            className="command-item"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.01 }}
          >
            <span className="cmd">{item.cmd}</span>
            <span className="desc">{item.icon} {item.desc}</span>
          </motion.div>
        ))}
      </div>
      
      {/* Info Commands */}
      <div className="section-title"><Info size={16} /> Bilgi Komutları</div>
      <div className="command-list">
        {infoCommands.map((item, idx) => (
          <motion.div 
            key={idx} 
            className="command-item"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 + idx * 0.05 }}
            whileHover={{ scale: 1.01 }}
          >
            <span className="cmd">{item.cmd}</span>
            <span className="desc">{item.icon} {item.desc}</span>
          </motion.div>
        ))}
      </div>
      
      {/* Rules */}
      <div className="section-title"><Shield size={16} /> Blackjack Kuralları</div>
      <ul className="rules-list">
        {rules.map((rule, idx) => (
          <motion.li 
            key={idx}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 + idx * 0.05 }}
          >
            {rule}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ==========================================
   MODERN CREDITS MESSAGE COMPONENT
   ========================================== */
function ModernCreditsMessage({ content }) {
  const credits = content.match(/([\d,]+)\s*credits?/i)?.[1] || '0';
  const totalWon = content.match(/Toplam Kazan[çc]:?\s*\*\*?(\d+)\*\*?/i)?.[1] || '0';
  const totalLost = content.match(/Toplam Kay[ıi]p:?\s*\*\*?(\d+)\*\*?/i)?.[1] || '0';
  const gamesPlayed = content.match(/Oynanan Oyun:?\s*\*\*?(\d+)\*\*?/i)?.[1] || '0';
  
  const stats = [
    { label: 'Mevcut Bakiye', value: credits, icon: <Coins size={18} />, color: 'gold' },
    { label: 'Toplam Kazanç', value: totalWon, icon: <Trophy size={18} />, color: 'green' },
    { label: 'Toplam Kayıp', value: totalLost, icon: <TrendingUp size={18} style={{ rotate: 180 }} />, color: 'red' },
    { label: 'Oynanan Oyun', value: gamesPlayed, icon: <Gamepad2 size={18} />, color: 'blue' },
  ];

  return (
    <motion.div 
      className="game-message-bubble credits"
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="game-bubble-header">
        <div className="bot-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <Wallet size={22} />
        </div>
        <div className="game-title-section">
          <h3 style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', WebkitBackgroundClip: 'text' }}>
            BAKIYE BILGISI
          </h3>
          <p>Kredi ve oyun istatistikleriniz</p>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.1, type: "spring" }}
            style={{
              background: `linear-gradient(135deg, ${stat.color === 'gold' ? 'rgba(245, 158, 11, 0.15)' : stat.color === 'green' ? 'rgba(16, 185, 129, 0.15)' : stat.color === 'red' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)'}, transparent)`,
              border: `1px solid ${stat.color === 'gold' ? 'rgba(245, 158, 11, 0.3)' : stat.color === 'green' ? 'rgba(16, 185, 129, 0.3)' : stat.color === 'red' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ 
              color: stat.color === 'gold' ? '#fbbf24' : stat.color === 'green' ? '#34d399' : stat.color === 'red' ? '#f87171' : '#60a5fa',
              opacity: 0.8 
            }}>
              {stat.icon}
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
              {parseInt(stat.value).toLocaleString()}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ==========================================
   MODERN LEADERBOARD MESSAGE COMPONENT
   ========================================== */
function ModernLeaderboardMessage({ content }) {
  // Parse leaderboard data from content
  const lines = content.split('\n').filter(l => l.trim());
  const title = lines[0]?.replace(/\*\*/g, '') || 'LIDER TABLOSU';
  
  // Extract top 10 entries
  const entries = [];
  for (let i = 1; i < lines.length && entries.length < 10; i++) {
    const line = lines[i];
    // Match patterns like: 1. @username - 10,000 cr veya 1. username - 10000
    const match = line.match(/(\d+)\.\s*(?:@)?(\w+)\s*-?\s*([\d,]+)/);
    if (match) {
      entries.push({
        rank: parseInt(match[1]),
        username: match[2],
        credits: match[3].replace(/,/g, '')
      });
    }
  }

  const getRankBadge = (rank) => {
    if (rank === 1) return { class: 'gold', icon: <Crown size={14} /> };
    if (rank === 2) return { class: 'silver', icon: <Medal size={14} /> };
    if (rank === 3) return { class: 'bronze', icon: <Medal size={14} /> };
    return { class: 'normal', icon: <span style={{ fontSize: '12px', fontWeight: 700 }}>{rank}</span> };
  };

  return (
    <motion.div 
      className="game-message-bubble leaderboard"
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="game-bubble-header">
        <div className="bot-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
          <Trophy size={22} />
        </div>
        <div className="game-title-section">
          <h3 style={{ background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', WebkitBackgroundClip: 'text' }}>
            EN ZENGINLER
          </h3>
          <p>Top 10 oyuncu sıralaması</p>
        </div>
      </div>
      
      <div className="leaderboard-list">
        {entries.map((entry, idx) => {
          const badge = getRankBadge(entry.rank);
          return (
            <motion.div 
              key={idx}
              className={`leaderboard-item ${entry.rank <= 3 ? 'top-' + entry.rank : ''}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.01 }}
            >
              <div className={`rank-badge ${badge.class}`}>{badge.icon}</div>
              <span className="leaderboard-user">{entry.username}</span>
              <span className="leaderboard-credits">{parseInt(entry.credits).toLocaleString()} cr</span>
            </motion.div>
          );
        })}
        {entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
            <Star size={32} style={{ opacity: 0.5, marginBottom: '10px' }} />
            <p>Henüz veri yok</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function formatGameMessage(content) {
  if (!content) return '';
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
    .replace(/\n/g, '<br/>');
}

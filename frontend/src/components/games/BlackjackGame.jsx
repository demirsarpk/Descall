import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Club, Diamond, Heart, Spade,
  Plus, Minus, RotateCcw, Coins,
  Trophy, AlertCircle
} from "lucide-react";

const CARD_SUITS = {
  '♠': { icon: Spade, color: '#1a1a1a' },
  '♥': { icon: Heart, color: '#dc2626' },
  '♦': { icon: Diamond, color: '#dc2626' },
  '♣': { icon: Club, color: '#1a1a1a' }
};

const CARD_RANKS = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
  '9': '9', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
};

function PlayingCard({ card, hidden = false, delay = 0 }) {
  if (hidden) {
    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ delay, duration: 0.4, type: "spring", stiffness: 200 }}
        className="playing-card hidden"
      >
        <div className="card-back">
          <div className="card-pattern" />
        </div>
      </motion.div>
    );
  }

  const suit = CARD_SUITS[card.suit];
  const Icon = suit?.icon || Spade;
  const color = suit?.color || '#1a1a1a';

  return (
    <motion.div
      initial={{ y: -50, rotateZ: -10, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, rotateZ: 0, opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, type: "spring", stiffness: 300, damping: 20 }}
      className="playing-card"
      style={{ borderColor: color + '30' }}
    >
      <div className="card-content" style={{ color }}>
        <span className="card-rank top">{CARD_RANKS[card.rank]}</span>
        <Icon className="card-center-icon" size={28} />
        <span className="card-rank bottom">{CARD_RANKS[card.rank]}</span>
      </div>
    </motion.div>
  );
}

function HandDisplay({ hand, label, score, hidden = false, isDealer = false }) {
  const cards = hand?.cards || hand?.visibleCards || [];
  const hiddenCard = hand?.hiddenCard;
  
  return (
    <div className={`hand-display ${isDealer ? 'dealer' : 'player'}`}>
      <div className="hand-header">
        <span className="hand-label">{label}</span>
        {score !== undefined && !hidden && (
          <motion.span 
            className="hand-score"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            key={score}
          >
            {score}
          </motion.span>
        )}
        {hidden && <span className="hand-score hidden-score">?</span>}
      </div>
      <div className="cards-row">
        {cards.map((card, i) => (
          <PlayingCard key={card.id || i} card={card} delay={i * 0.1} />
        ))}
        {hidden && hiddenCard && (
          <PlayingCard key="hidden" hidden={true} delay={cards.length * 0.1} />
        )}
      </div>
    </div>
  );
}

function ActionButton({ action, onClick, disabled, variant = 'primary' }) {
  const labels = {
    hit: { text: 'HIT', icon: Plus, color: '#22c55e' },
    stand: { text: 'STAND', icon: Minus, color: '#f59e0b' },
    double: { text: 'DOUBLE', icon: Coins, color: '#8b5cf6' }
  };

  const config = labels[action] || labels.hit;
  const Icon = config.icon;

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`action-btn ${variant} ${disabled ? 'disabled' : ''}`}
      style={{ '--btn-color': config.color }}
    >
      <Icon size={18} />
      <span>{config.text}</span>
    </motion.button>
  );
}

export default function BlackjackGame({ 
  gameData, 
  onAction, 
  isActive = false,
  currentUserId,
  credits = 0
}) {
  const [bet, setBet] = useState(100);
  const [showRules, setShowRules] = useState(false);

  const handleAction = useCallback((action) => {
    if (onAction && gameData?.id) {
      onAction(action, gameData.id);
    }
  }, [onAction, gameData?.id]);

  const handleStartGame = useCallback(() => {
    if (onAction) {
      onAction('start', bet);
    }
  }, [onAction, bet]);

  // Oyun durumu yoksa veya bitmişse başlangıç ekranı
  if (!gameData || gameData.status === 'finished') {
    return (
      <div className="blackjack-lobby">
        <motion.div 
          className="bj-header"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h3>🎰 Blackjack</h3>
          <p className="bj-subtitle">21'e ulaşmaya çalış ama geçme!</p>
        </motion.div>

        <div className="bet-selector">
          <label>Bahis Miktarı</label>
          <div className="bet-controls">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setBet(Math.max(10, bet - 10))}
              className="bet-btn"
            >
              <Minus size={16} />
            </motion.button>
            <span className="bet-amount">{bet.toLocaleString()}</span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setBet(Math.min(10000, bet + 10))}
              className="bet-btn"
            >
              <Plus size={16} />
            </motion.button>
          </div>
          <div className="quick-bets">
            {[50, 100, 250, 500, 1000].map(amount => (
              <button
                key={amount}
                onClick={() => setBet(amount)}
                className={`quick-bet ${bet === amount ? 'active' : ''}`}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        <div className="credits-display">
          <Coins size={16} />
          <span>Bakiye: {credits.toLocaleString()}</span>
        </div>

        <motion.button
          whileHover={{ scale: credits >= bet ? 1.02 : 1 }}
          whileTap={{ scale: credits >= bet ? 0.98 : 1 }}
          onClick={handleStartGame}
          disabled={credits < bet}
          className="start-game-btn"
        >
          {credits < bet ? 'Yetersiz Bakiye' : 'Oyna'}
        </motion.button>

        <button 
          className="rules-toggle"
          onClick={() => setShowRules(!showRules)}
        >
          {showRules ? 'Kuralları Gizle' : 'Kuralları Göster'}
        </button>

        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="rules-panel"
            >
              <ul>
                <li>Amaç 21 puan toplamak</li>
                <li>21'i geçersen (Bust) kaybedersin</li>
                <li>Krupiye 17'ye kadar çeker</li>
                <li>Blackjack (A+10) 3:2 öder</li>
                <li>Double: Bahisi 2x yap, 1 kart çek</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const { playerHand, dealerHand, status, result, winAmount, bet: gameBet, actions = [] } = gameData;
  const isPlaying = status === 'playing';
  const isFinished = status === 'finished';

  return (
    <div className="blackjack-game">
      {/* Bahis ve Bakiye */}
      <div className="game-stats-bar">
        <div className="stat-item">
          <Coins size={14} />
          <span>Bahis: {gameBet?.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <Trophy size={14} />
          <span>Bakiye: {credits.toLocaleString()}</span>
        </div>
      </div>

      {/* Krupiye Eli */}
      <HandDisplay 
        hand={dealerHand}
        label="Krupiye"
        score={dealerHand?.value}
        hidden={isPlaying}
        isDealer={true}
      />

      {/* Sonuç Bildirimi */}
      <AnimatePresence mode="wait">
        {isFinished && result && (
          <motion.div
            key={result}
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -20 }}
            className={`result-banner ${result}`}
          >
            {result === 'win' && <><Trophy size={24} /> Kazandın!</>}
            {result === 'blackjack' && <><Trophy size={24} /> BLACKJACK!</>}
            {result === 'loss' && <><AlertCircle size={24} /> Kaybettin</>}
            {result === 'push' && <>Berabere (Push)</>}
          </motion.div>
        )}
      </AnimatePresence>

      {isFinished && winAmount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="win-amount"
        >
          +{winAmount.toLocaleString()} credits
        </motion.div>
      )}

      {/* Oyuncu Eli */}
      <HandDisplay 
        hand={playerHand}
        label="Senin El"
        score={playerHand?.value}
      />

      {/* Aksiyon Butonları */}
      {isPlaying && (
        <div className="actions-bar">
          <ActionButton 
            action="hit" 
            onClick={() => handleAction('hit')}
          />
          <ActionButton 
            action="stand" 
            onClick={() => handleAction('stand')}
          />
          {actions.includes('double') && (
            <ActionButton 
              action="double" 
              onClick={() => handleAction('double')}
            />
          )}
        </div>
      )}

      {/* Yeniden Oyna */}
      {isFinished && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleAction('start')}
          className="play-again-btn"
        >
          <RotateCcw size={18} />
          Tekrar Oyna
        </motion.button>
      )}
    </div>
  );
}

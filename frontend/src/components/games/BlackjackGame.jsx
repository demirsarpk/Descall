import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Club, Diamond, Heart, Spade,
  Plus, Minus, RotateCcw, Coins,
  Trophy, AlertCircle
} from "lucide-react";
import { useT } from "../../context/LocaleContext";

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

function ActionButton({ action, onClick, disabled, variant = 'primary', t }) {
  const labels = {
    hit: { text: t("HIT"), icon: Plus, color: '#22c55e' },
    stand: { text: t("STAND"), icon: Minus, color: '#f59e0b' },
    double: { text: t("DOUBLE"), icon: Coins, color: '#8b5cf6' }
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
  const t = useT();
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

  // Lobby when no active game or finished
  if (!gameData || gameData.status === 'finished') {
    return (
      <div className="blackjack-lobby">
        <motion.div 
          className="bj-header"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h3>🎰 {t("Blackjack")}</h3>
          <p className="bj-subtitle">{t("Try to reach 21 — but don’t go over!")}</p>
        </motion.div>

        <div className="bet-selector">
          <label>{t("Bet Amount")}</label>
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
          <span>{t("Balance:")} {credits.toLocaleString()}</span>
        </div>

        <motion.button
          whileHover={{ scale: credits >= bet ? 1.02 : 1 }}
          whileTap={{ scale: credits >= bet ? 0.98 : 1 }}
          onClick={handleStartGame}
          disabled={credits < bet}
          className="start-game-btn"
        >
          {credits < bet ? t("Insufficient Balance") : t("Play")}
        </motion.button>

        <button 
          className="rules-toggle"
          onClick={() => setShowRules(!showRules)}
        >
          {showRules ? t("Hide Rules") : t("Show Rules")}
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
                <li>{t("Goal: get as close to 21 as possible")}</li>
                <li>{t("Going over 21 (Bust) loses")}</li>
                <li>{t("Dealer draws until 17")}</li>
                <li>{t("Blackjack (A+10) pays 3:2")}</li>
                <li>{t("Double: 2x bet, take one card")}</li>
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
      <div className="game-stats-bar">
        <div className="stat-item">
          <Coins size={14} />
          <span>{t("Bet:")} {gameBet?.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <Trophy size={14} />
          <span>{t("Balance:")} {credits.toLocaleString()}</span>
        </div>
      </div>

      <HandDisplay 
        hand={dealerHand}
        label={t("Dealer")}
        score={dealerHand?.value}
        hidden={isPlaying}
        isDealer={true}
      />

      <AnimatePresence mode="wait">
        {isFinished && result && (
          <motion.div
            key={result}
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -20 }}
            className={`result-banner ${result}`}
          >
            {result === 'win' && <><Trophy size={24} /> {t("You win!")}</>}
            {result === 'blackjack' && <><Trophy size={24} /> {t("BLACKJACK!")}</>}
            {result === 'loss' && <><AlertCircle size={24} /> {t("You lose")}</>}
            {result === 'push' && <>{t("Push (tie)")}</>}
          </motion.div>
        )}
      </AnimatePresence>

      {isFinished && winAmount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="win-amount"
        >
          +{winAmount.toLocaleString()} {t("credits")}
        </motion.div>
      )}

      <HandDisplay 
        hand={playerHand}
        label={t("Your Hand")}
        score={playerHand?.value}
      />

      {isPlaying && (
        <div className="actions-bar">
          <ActionButton 
            action="hit" 
            onClick={() => handleAction('hit')}
            t={t}
          />
          <ActionButton 
            action="stand" 
            onClick={() => handleAction('stand')}
            t={t}
          />
          {actions.includes('double') && (
            <ActionButton 
              action="double" 
              onClick={() => handleAction('double')}
              t={t}
            />
          )}
        </div>
      )}

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
          {t("Play Again")}
        </motion.button>
      )}
    </div>
  );
}

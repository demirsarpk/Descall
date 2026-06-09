import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Trophy, Coins, AlertCircle, 
  Gamepad2, TrendingUp, RotateCcw 
} from "lucide-react";
import BlackjackGame from "../games/BlackjackGame";

const GAME_ICONS = {
  blackjack: Gamepad2,
  default: Gamepad2
};

const RESULT_COLORS = {
  win: '#22c55e',
  blackjack: '#f59e0b',
  loss: '#ef4444',
  push: '#6b7280'
};

export default function GameMessageBubble({ 
  message, 
  isOwn = false,
  currentUserId,
  socket,
  onGameAction
}) {
  const { content, gameData, type, sender } = message;
  const [isExpanded, setIsExpanded] = useState(false);
  const [credits, setCredits] = useState(1000);

  // Oyun aksiyon handler'ı
  const handleGameAction = async (action, value) => {
    if (!socket || !message.groupId) return;

    if (action === 'start') {
      // Yeni oyun başlat
      socket.emit('game:command', {
        groupId: message.groupId,
        command: 'bj',
        args: value.toString()
      });
    } else {
      // Hit, stand, double
      socket.emit('game:action', {
        groupId: message.groupId,
        action: action,
        gameId: gameData?.id
      });
    }

    if (onGameAction) {
      onGameAction(action, value);
    }
  };

  // Bakiye sorgula
  const fetchCredits = () => {
    if (socket) {
      socket.emit('game:credits', (response) => {
        if (response?.credits !== undefined) {
          setCredits(response.credits);
        }
      });
    }
  };

  // Mesaj tipine göre render
  const isGameStart = type === 'game_start' || content?.includes('Oyun Başladı');
  const isGameEnd = type === 'game_end' || gameData?.status === 'finished';
  const isGameAction = type === 'game_action';

  // Basit mesaj (sadece text)
  if (!gameData && !isGameStart && !isGameEnd) {
    return (
      <div className={`game-message-bubble simple ${isOwn ? 'own' : ''}`}>
        <div className="game-message-header">
          <span className="bot-badge">🎰 BOT</span>
          <span className="sender-name">{sender?.username || 'Casino Bot'}</span>
        </div>
        <div className="game-message-content" dangerouslySetInnerHTML={{ 
          __html: formatGameMessage(content) 
        }} />
      </div>
    );
  }

  const GameIcon = GAME_ICONS[gameData?.gameType || 'blackjack'] || GAME_ICONS.default;
  const resultColor = gameData?.result ? RESULT_COLORS[gameData.result] : null;

  return (
    <motion.div 
      className={`game-message-bubble ${isOwn ? 'own' : ''} ${isGameEnd ? 'finished' : ''}`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={resultColor ? { '--result-color': resultColor } : {}}
    >
      {/* Header */}
      <div className="game-bubble-header">
        <div className="game-icon-wrapper">
          <GameIcon size={18} />
        </div>
        <div className="game-info">
          <span className="game-title">
            {gameData?.result === 'blackjack' ? '🎉 BLACKJACK!' : 
             gameData?.result === 'win' ? '✅ Kazandın!' :
             gameData?.result === 'loss' ? '❌ Kaybettin' :
             gameData?.result === 'push' ? '🤝 Berabere' :
             '🎰 Blackjack'}
          </span>
          <span className="game-meta">
            {gameData?.bet && `Bahis: ${gameData.bet.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Oyun İçeriği (Kartlar) */}
      {gameData && (
        <div className="game-cards-preview">
          {/* Krupiye */}
          <div className="mini-hand dealer">
            <span className="mini-label">Krupiye</span>
            <div className="mini-cards">
              {gameData.dealerHand?.visibleCards?.map((card, i) => (
                <span key={i} className={`mini-card ${card.color}`}>
                  {card.suit}{card.rank}
                </span>
              ))}
              {gameData.status === 'playing' && gameData.dealerHand?.hiddenCard && (
                <span className="mini-card hidden">🂠</span>
              )}
              {gameData.status !== 'playing' && gameData.dealerHand?.cards?.map((card, i) => (
                <span key={`d-${i}`} className={`mini-card ${card.color}`}>
                  {card.suit}{card.rank}
                </span>
              ))}
              <span className="mini-score">
                {gameData.status === 'playing' ? '?' : gameData.dealerHand?.value}
              </span>
            </div>
          </div>

          {/* Oyuncu */}
          <div className="mini-hand player">
            <span className="mini-label">Senin El ({gameData.playerHand?.value})</span>
            <div className="mini-cards">
              {gameData.playerHand?.cards?.map((card, i) => (
                <span key={i} className={`mini-card ${card.color}`}>
                  {card.suit}{card.rank}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sonuç Bilgisi */}
      {gameData?.result && (
        <div className={`game-result ${gameData.result}`}>
          {gameData.result === 'win' && (
            <><Trophy size={16} /> Kazandın! +{(gameData.winAmount - gameData.bet).toLocaleString()}</>
          )}
          {gameData.result === 'blackjack' && (
            <><Trophy size={16} /> BLACKJACK! +{(gameData.winAmount - gameData.bet).toLocaleString()}</>
          )}
          {gameData.result === 'loss' && (
            <><AlertCircle size={16} /> Kaybettin -{gameData.bet.toLocaleString()}</>
          )}
          {gameData.result === 'push' && (
            <>🤝 Berabere - Bahis iade</>
          )}
        </div>
      )}

      {/* Aksiyonlar veya Yeniden Oyna */}
      {gameData?.status === 'playing' && gameData.actions?.length > 0 && (
        <div className="quick-actions">
          {gameData.actions.map(action => (
            <button 
              key={action}
              onClick={() => handleGameAction(action)}
              className={`quick-action ${action}`}
            >
              {action === 'hit' && <><TrendingUp size={12} /> Hit</>}
              {action === 'stand' && 'Stand'}
              {action === 'double' && <><Coins size={12} /> Double</>}
            </button>
          ))}
        </div>
      )}

      {gameData?.status === 'finished' && (
        <button 
          onClick={() => handleGameAction('start', gameData.bet)}
          className="quick-replay"
        >
          <RotateCcw size={14} />
          Tekrar Oyna
        </button>
      )}

      {/* Detaylı Görünüm Toggle */}
      <button 
        className="expand-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Küçült ▲' : 'Genişlet ▼'}
      </button>

      {/* Detaylı Oyun UI */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="expanded-game"
        >
          <BlackjackGame 
            gameData={gameData}
            onAction={handleGameAction}
            isActive={true}
            currentUserId={currentUserId}
            credits={credits}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

// Mesaj formatlama (markdown benzeri)
function formatGameMessage(content) {
  if (!content) return '';
  
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
    .replace(/\n/g, '<br/>');
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Coins, AlertCircle, Gamepad2, TrendingUp, RotateCcw, HelpCircle,
  Wallet, Crown, Target, Sparkles, BookOpen, Terminal, BarChart3, Zap,
  Shield, Dice5, Info, HandMetal,
} from "lucide-react";

/* ── Playing card ─────────────────────────────────────────────── */

function PlayingCard({ card, hidden = false, index = 0 }) {
  if (hidden || card?.hidden) {
    return (
      <motion.div
        className="bj-card bj-card--back"
        initial={{ rotateY: 90, opacity: 0, y: -24 }}
        animate={{ rotateY: 0, opacity: 1, y: 0 }}
        transition={{ delay: index * 0.12, type: "spring", stiffness: 260, damping: 18 }}
      >
        <div className="bj-card-back-art" />
      </motion.div>
    );
  }

  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <motion.div
      className={`bj-card ${isRed ? "bj-card--red" : "bj-card--black"}`}
      initial={{ y: -40, rotate: -8, opacity: 0, scale: 0.85 }}
      animate={{ y: 0, rotate: 0, opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.12, type: "spring", stiffness: 280, damping: 16 }}
    >
      <div className="bj-card-corner bj-card-corner--tl">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
      <div className="bj-card-pip">{card.suit}</div>
      <div className="bj-card-corner bj-card-corner--br">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
    </motion.div>
  );
}

function HandRow({ label, hand, hideHole }) {
  const cards = hand?.cards || [];
  const showValue = !hideHole && hand?.value != null;

  return (
    <div className={`bj-hand ${hideHole ? "bj-hand--mystery" : ""}`}>
      <div className="bj-hand-meta">
        <span className="bj-hand-label">{label}</span>
        {showValue ? (
          <motion.span
            key={hand.value}
            className={`bj-hand-total ${hand.isBust ? "is-bust" : ""} ${hand.isBlackjack ? "is-bj" : ""}`}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
          >
            {hand.isBlackjack ? "BJ" : hand.value}
            {hand.isSoft && !hand.isBlackjack ? " soft" : ""}
          </motion.span>
        ) : (
          <span className="bj-hand-total is-hidden">?</span>
        )}
      </div>
      <div className="bj-cards">
        {cards.map((card, i) => (
          <PlayingCard
            key={card.id || `${card.rank}-${i}`}
            card={card}
            hidden={Boolean(card.hidden)}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({ amount, active, disabled, onClick }) {
  return (
    <motion.button
      type="button"
      className={`bj-chip ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
      whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
    >
      {amount >= 1000 ? `${amount / 1000}K` : amount}
    </motion.button>
  );
}

function ActionBar({ actions, onAction, busy }) {
  const map = {
    hit: { label: "HIT", icon: TrendingUp, variant: "hit" },
    stand: { label: "STAND", icon: HandMetal, variant: "stand" },
    double: { label: "DOUBLE", icon: Coins, variant: "double" },
  };
  return (
    <div className="bj-actions">
      {(actions?.length ? actions : ["hit", "stand"]).map((key) => {
        const cfg = map[key];
        if (!cfg) return null;
        const Icon = cfg.icon;
        return (
          <motion.button
            key={key}
            type="button"
            className={`bj-action bj-action--${cfg.variant}`}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            disabled={busy}
            onClick={() => onAction(key)}
          >
            <Icon size={16} />
            {cfg.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function ResultBanner({ result, profit, bet }) {
  if (!result) return null;
  const copy = {
    blackjack: { title: "BLACKJACK", sub: `+${(profit || 0).toLocaleString()}`, cls: "bj" },
    win: { title: "YOU WIN", sub: `+${(profit || 0).toLocaleString()}`, cls: "win" },
    push: { title: "PUSH", sub: "Stake returned", cls: "push" },
    loss: { title: "DEALER WINS", sub: `−${(bet || 0).toLocaleString()}`, cls: "loss" },
  }[result] || { title: result, sub: "", cls: "" };

  return (
    <motion.div
      className={`bj-result bj-result--${copy.cls}`}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <span className="bj-result-title">{copy.title}</span>
      <span className="bj-result-sub">{copy.sub}</span>
    </motion.div>
  );
}

function LobbyTable({ credits, onBet, onHelp }) {
  const [bet, setBet] = useState(100);
  const chips = [50, 100, 250, 500, 1000, 2500, 5000];
  const canPlay = credits >= bet && bet >= 10;

  return (
    <div className="bj-shell bj-shell--lobby">
      <header className="bj-header">
        <div className="bj-brand">
          <Sparkles size={18} />
          <div>
            <h3>Blackjack</h3>
            <p>Multi-deck · 3:2 · Soft 17</p>
          </div>
        </div>
        <div className="bj-bankroll">
          <Wallet size={14} />
          <strong>{credits.toLocaleString()}</strong>
        </div>
      </header>

      <div className="bj-bet-panel">
        <div className="bj-bet-readout">
          <span>Bet</span>
          <strong>{bet.toLocaleString()}</strong>
        </div>
        <div className="bj-chip-row">
          {chips.map((c) => (
            <Chip
              key={c}
              amount={c}
              active={bet === c}
              disabled={credits < c}
              onClick={() => setBet(c)}
            />
          ))}
        </div>
        <div className="bj-bet-slider-row">
          <button type="button" onClick={() => setBet((b) => Math.max(10, b - 10))}>−</button>
          <input
            type="range"
            min={10}
            max={Math.max(10, Math.min(25000, credits || 10))}
            step={10}
            value={Math.min(bet, Math.max(10, credits || 10))}
            onChange={(e) => setBet(Number(e.target.value))}
          />
          <button type="button" onClick={() => setBet((b) => Math.min(credits, b + 10))}>+</button>
        </div>
        <motion.button
          type="button"
          className="bj-deal-btn"
          whileHover={canPlay ? { scale: 1.02 } : {}}
          whileTap={canPlay ? { scale: 0.98 } : {}}
          disabled={!canPlay}
          onClick={() => canPlay && onBet(bet)}
        >
          <Gamepad2 size={18} />
          Deal hand
        </motion.button>
      </div>

      <button type="button" className="bj-link-btn" onClick={onHelp}>
        <HelpCircle size={14} /> Rules & commands
      </button>
    </div>
  );
}

/* ── Info panels ──────────────────────────────────────────────── */

function HelpPanel({ credits }) {
  return (
    <div className="bj-shell bj-shell--info">
      <header className="bj-header">
        <div className="bj-brand">
          <BookOpen size={18} />
          <div>
            <h3>Casino Help</h3>
            <p>Commands & house rules</p>
          </div>
        </div>
        <div className="bj-bankroll"><Coins size={14} /><strong>{(credits || 0).toLocaleString()}</strong></div>
      </header>
      <div className="bj-info-grid">
        <div>
          <h4><Terminal size={14} /> Play</h4>
          <ul>
            <li><code>/bj 100</code> deal</li>
            <li><code>/hit</code> · <code>/stand</code> · <code>/double</code></li>
          </ul>
        </div>
        <div>
          <h4><Info size={14} /> Info</h4>
          <ul>
            <li><code>/credits</code> balance</li>
            <li><code>/top</code> leaderboard</li>
            <li><code>/help</code> this panel</li>
          </ul>
        </div>
      </div>
      <ul className="bj-rules">
        <li><Shield size={14} /> Beat the dealer without going over 21</li>
        <li><Dice5 size={14} /> Blackjack pays <strong>3:2</strong></li>
        <li><Zap size={14} /> Dealer hits soft 17 · 6-deck shoe</li>
      </ul>
    </div>
  );
}

function CreditsPanel({ content, gameData }) {
  const credits = gameData?.credits ?? gameData?.stats?.credits;
  const stats = gameData?.stats;
  return (
    <div className="bj-shell bj-shell--info">
      <header className="bj-header">
        <div className="bj-brand">
          <Wallet size={18} />
          <div>
            <h3>Balance</h3>
            <p>Your casino bankroll</p>
          </div>
        </div>
      </header>
      <div className="bj-balance-hero">{Number(credits || 0).toLocaleString()}</div>
      {stats && (
        <div className="bj-stat-row">
          <div><span>Won</span><strong>{(stats.total_won || 0).toLocaleString()}</strong></div>
          <div><span>Lost</span><strong>{(stats.total_lost || 0).toLocaleString()}</strong></div>
          <div><span>Hands</span><strong>{(stats.games_played || 0).toLocaleString()}</strong></div>
        </div>
      )}
      {!stats && content && <pre className="bj-plain">{content}</pre>}
    </div>
  );
}

function LeaderboardPanel({ content, gameData }) {
  return (
    <div className="bj-shell bj-shell--info">
      <header className="bj-header">
        <div className="bj-brand">
          <BarChart3 size={18} />
          <div>
            <h3>Leaderboard</h3>
            <p>Top bankrolls</p>
          </div>
        </div>
      </header>
      <pre className="bj-plain">{content}</pre>
    </div>
  );
}

/* ── Main bubble ──────────────────────────────────────────────── */

export default function GameMessageBubble({
  message,
  socket,
  currentUserId,
}) {
  const { content, gameData, type, groupId } = message;
  const [credits, setCredits] = useState(gameData?.credits ?? 1000);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (gameData?.credits != null) setCredits(gameData.credits);
  }, [gameData?.credits]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("game:credits", (res) => {
      if (res?.credits != null) setCredits(res.credits);
    });
  }, [socket, gameData?.id, gameData?.status]);

  const targetGroupId = groupId || message.groupId;

  const emitCommand = (command, args) => {
    if (!socket || !targetGroupId) return;
    setBusy(true);
    socket.emit("game:command", { groupId: targetGroupId, command, args });
    setTimeout(() => setBusy(false), 400);
  };

  const emitAction = (action) => {
    if (!socket || !targetGroupId) return;
    setBusy(true);
    socket.emit("game:action", { groupId: targetGroupId, action, gameId: gameData?.id });
    setTimeout(() => setBusy(false), 400);
  };

  if (type === "game_help") {
    return <HelpPanel credits={gameData?.credits ?? credits} />;
  }
  if (type === "game_credits") {
    return <CreditsPanel content={content} gameData={gameData} />;
  }
  if (type === "game_leaderboard" || type === "game_top") {
    return <LeaderboardPanel content={content} gameData={gameData} />;
  }

  const isBoard =
    gameData &&
    (gameData.status === "playing" ||
      gameData.status === "dealer" ||
      gameData.status === "finished" ||
      gameData.status === "dealing");

  // Lobby / invalid bet / no board data
  if (!isBoard || type === "game_lobby") {
    return (
      <LobbyTable
        credits={credits}
        onBet={(bet) => emitCommand("bj", String(bet))}
        onHelp={() => emitAction("help")}
      />
    );
  }

  const isPlaying = gameData.status === "playing";
  const isFinished = gameData.status === "finished";
  const isMine = !gameData.userId || gameData.userId === currentUserId;
  const hideHole = Boolean(gameData.dealerHand?.holeHidden || isPlaying);

  let statusIcon = <Coins size={16} />;
  if (isPlaying) statusIcon = <Target size={16} />;
  else if (gameData.result === "blackjack") statusIcon = <Crown size={16} />;
  else if (gameData.result === "win") statusIcon = <Trophy size={16} />;
  else if (gameData.result === "loss") statusIcon = <AlertCircle size={16} />;

  return (
    <motion.div
      className={`bj-shell bj-shell--table ${isFinished ? `is-${gameData.result}` : "is-live"}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className="bj-header">
        <div className="bj-brand">
          <div className={`bj-status-dot ${isPlaying ? "live" : gameData.result || ""}`}>
            {statusIcon}
          </div>
          <div>
            <h3>{isPlaying ? "Live hand" : "Hand complete"}</h3>
            <p>
              @{gameData.username || "Player"} · Bet {gameData.bet?.toLocaleString()}
              {gameData.doubled ? " · Doubled" : ""}
            </p>
          </div>
        </div>
        <div className="bj-bankroll">
          <Wallet size={14} />
          <strong>{Number(gameData.credits ?? credits).toLocaleString()}</strong>
        </div>
      </header>

      <AnimatePresence>
        {isFinished && (
          <ResultBanner result={gameData.result} profit={gameData.profit} bet={gameData.bet} />
        )}
      </AnimatePresence>

      <div className="bj-felt">
        <HandRow label="Dealer" hand={gameData.dealerHand} hideHole={hideHole} />
        <div className="bj-felt-divider" />
        <HandRow label="You" hand={gameData.playerHand} hideHole={false} />
      </div>

      {isPlaying && isMine && (
        <ActionBar
          actions={gameData.actions}
          onAction={emitAction}
          busy={busy}
        />
      )}

      {isPlaying && !isMine && (
        <div className="bj-spectator">Watching this hand…</div>
      )}

      {isFinished && isMine && (
        <div className="bj-actions bj-actions--end">
          <motion.button
            type="button"
            className="bj-action bj-action--hit"
            whileTap={{ scale: 0.96 }}
            onClick={() => emitCommand("bj", String(gameData.originalBet || gameData.bet))}
          >
            <RotateCcw size={16} />
            Again ({(gameData.originalBet || gameData.bet)?.toLocaleString()})
          </motion.button>
          <motion.button
            type="button"
            className="bj-action bj-action--double"
            whileTap={{ scale: 0.96 }}
            disabled={credits < (gameData.originalBet || gameData.bet) * 2}
            onClick={() =>
              emitCommand("bj", String(Math.min((gameData.originalBet || gameData.bet) * 2, credits)))
            }
          >
            <Coins size={16} />
            Double stake
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

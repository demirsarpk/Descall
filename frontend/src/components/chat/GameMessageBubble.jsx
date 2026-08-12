import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Coins, AlertCircle, Gamepad2, TrendingUp, RotateCcw, HelpCircle,
  Wallet, Crown, Target, Sparkles, BookOpen, Terminal, BarChart3, Zap,
  Shield, Dice5, Info, HandMetal, X,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";

/* ── Playing card ─────────────────────────────────────────────── */

function PlayingCard({ card, hidden = false, index = 0 }) {
  if (!card && !hidden) return null;
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

function HandRow({ label, hand, hideHole, highlight }) {
  const t = useT();
  const cards = hand?.cards || [];
  const showValue = !hideHole && hand?.value != null;

  return (
    <div className={`bj-hand ${hideHole ? "bj-hand--mystery" : ""} ${highlight ? `bj-hand--${highlight}` : ""}`}>
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
            {hand.isSoft && !hand.isBlackjack ? ` ${t("soft")}` : ""}
          </motion.span>
        ) : (
          <span className="bj-hand-total is-hidden">?</span>
        )}
      </div>
      <div className="bj-cards">
        {cards.map((card, i) => (
          <PlayingCard
            key={card?.id || `${card?.rank || "x"}-${card?.suit || "x"}-${i}`}
            card={card}
            hidden={Boolean(card?.hidden)}
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
  const t = useT();
  const map = {
    hit: { label: t("HIT"), icon: TrendingUp, variant: "hit" },
    stand: { label: t("STAND"), icon: HandMetal, variant: "stand" },
    double: { label: t("DOUBLE"), icon: Coins, variant: "double" },
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

function outcomeCopy(result, profit, bet, t) {
  return (
    {
      blackjack: {
        title: "BLACKJACK!",
        headline: t("You win"),
        sub: `+${(profit || 0).toLocaleString()} ${t("credits")}`,
        cls: "bj",
      },
      win: {
        title: t("YOU WIN"),
        headline: t("You win"),
        sub: `+${(profit || 0).toLocaleString()} ${t("credits")}`,
        cls: "win",
      },
      push: {
        title: t("PUSH"),
        headline: t("Tie"),
        sub: t("Stake returned"),
        cls: "push",
      },
      loss: {
        title: t("YOU LOSE"),
        headline: t("Dealer wins"),
        sub: `−${(bet || 0).toLocaleString()} ${t("credits")}`,
        cls: "loss",
      },
    }[result] || { title: String(result || ""), headline: t("Hand complete"), sub: "", cls: "" }
  );
}

function ResultBanner({ result, profit, bet }) {
  const t = useT();
  if (!result) return null;
  const copy = outcomeCopy(result, profit, bet, t);

  return (
    <motion.div
      className={`bj-result bj-result--${copy.cls}`}
      initial={{ y: -12, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
    >
      <div className="bj-result-main">
        <span className="bj-result-title">{copy.title}</span>
        <span className="bj-result-headline">{copy.headline}</span>
      </div>
      <span className="bj-result-sub">{copy.sub}</span>
    </motion.div>
  );
}

function ResultStamp({ result, profit, bet }) {
  const t = useT();
  if (!result) return null;
  const copy = outcomeCopy(result, profit, bet, t);
  return (
    <motion.div
      className={`bj-stamp bj-stamp--${copy.cls}`}
      initial={{ scale: 1.35, opacity: 0, rotate: -8 }}
      animate={{ scale: 1, opacity: 1, rotate: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 16 }}
    >
      <strong>{copy.title}</strong>
      <span>{copy.sub}</span>
    </motion.div>
  );
}

function LobbyTable({ credits, onBet, onHelp }) {
  const t = useT();
  const [bet, setBet] = useState(100);
  const [showHelp, setShowHelp] = useState(false);
  const chips = [50, 100, 250, 500, 1000, 2500, 5000];
  const canPlay = credits >= bet && bet >= 10;

  if (showHelp) {
    return (
      <div className="bj-shell bj-shell--info">
        <header className="bj-header">
          <div className="bj-brand">
            <BookOpen size={18} />
            <div>
              <h3>{t("Casino Help")}</h3>
              <p>{t("Commands & house rules")}</p>
            </div>
          </div>
          <button type="button" className="bj-icon-btn" onClick={() => setShowHelp(false)} aria-label={t("Close help")}>
            <X size={16} />
          </button>
        </header>
        <div className="bj-info-grid">
          <div>
            <h4><Terminal size={14} /> {t("Play")}</h4>
            <ul>
              <li><code>/bj 100</code> {t("deal")}</li>
              <li><code>/hit</code> · <code>/stand</code> · <code>/double</code></li>
            </ul>
          </div>
          <div>
            <h4><Info size={14} /> {t("Info")}</h4>
            <ul>
              <li><code>/credits</code> {t("balance")}</li>
              <li><code>/top</code> {t("leaderboard")}</li>
              <li><code>/help</code> {t("this panel")}</li>
            </ul>
          </div>
        </div>
        <ul className="bj-rules">
          <li><Shield size={14} /> {t("Beat the dealer without going over 21")}</li>
          <li><Dice5 size={14} /> {t("Blackjack pays")} <strong>3:2</strong></li>
          <li><Zap size={14} /> {t("Dealer hits soft 17 · 6-deck shoe")}</li>
        </ul>
        <button type="button" className="bj-deal-btn" onClick={() => setShowHelp(false)}>
          {t("Back to bet")}
        </button>
      </div>
    );
  }

  return (
    <div className="bj-shell bj-shell--lobby">
      <header className="bj-header">
        <div className="bj-brand">
          <Sparkles size={18} />
          <div>
            <h3>Blackjack</h3>
            <p>{t("Multi-deck · 3:2 · Soft 17")}</p>
          </div>
        </div>
        <div className="bj-bankroll">
          <Wallet size={14} />
          <strong>{credits.toLocaleString()}</strong>
        </div>
      </header>

      <div className="bj-bet-panel">
        <div className="bj-bet-readout">
          <span>{t("Bet")}</span>
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
          {t("Deal hand")}
        </motion.button>
      </div>

      <button
        type="button"
        className="bj-link-btn"
        onClick={() => {
          setShowHelp(true);
          onHelp?.();
        }}
      >
        <HelpCircle size={14} /> {t("Rules & commands")}
      </button>
    </div>
  );
}

/* ── Info panels ──────────────────────────────────────────────── */

function HelpPanel({ credits }) {
  const t = useT();
  return (
    <div className="bj-shell bj-shell--info">
      <header className="bj-header">
        <div className="bj-brand">
          <BookOpen size={18} />
          <div>
            <h3>{t("Casino Help")}</h3>
            <p>{t("Commands & house rules")}</p>
          </div>
        </div>
        <div className="bj-bankroll"><Coins size={14} /><strong>{(credits || 0).toLocaleString()}</strong></div>
      </header>
      <div className="bj-info-grid">
        <div>
          <h4><Terminal size={14} /> {t("Play")}</h4>
          <ul>
            <li><code>/bj 100</code> {t("deal")}</li>
            <li><code>/hit</code> · <code>/stand</code> · <code>/double</code></li>
          </ul>
        </div>
        <div>
          <h4><Info size={14} /> {t("Info")}</h4>
          <ul>
            <li><code>/credits</code> {t("balance")}</li>
            <li><code>/top</code> {t("leaderboard")}</li>
            <li><code>/help</code> {t("this panel")}</li>
          </ul>
        </div>
      </div>
      <ul className="bj-rules">
        <li><Shield size={14} /> {t("Beat the dealer without going over 21")}</li>
        <li><Dice5 size={14} /> {t("Blackjack pays")} <strong>3:2</strong></li>
        <li><Zap size={14} /> {t("Dealer hits soft 17 · 6-deck shoe")}</li>
      </ul>
    </div>
  );
}

function CreditsPanel({ content, gameData }) {
  const t = useT();
  const credits = gameData?.credits ?? gameData?.stats?.credits;
  const stats = gameData?.stats;
  return (
    <div className="bj-shell bj-shell--info">
      <header className="bj-header">
        <div className="bj-brand">
          <Wallet size={18} />
          <div>
            <h3>{t("Balance")}</h3>
            <p>{t("Your casino bankroll")}</p>
          </div>
        </div>
      </header>
      <div className="bj-balance-hero">{Number(credits || 0).toLocaleString()}</div>
      {stats && (
        <div className="bj-stat-row">
          <div><span>{t("Won")}</span><strong>{(stats.total_won || 0).toLocaleString()}</strong></div>
          <div><span>{t("Lost")}</span><strong>{(stats.total_lost || 0).toLocaleString()}</strong></div>
          <div><span>{t("Hands")}</span><strong>{(stats.games_played || 0).toLocaleString()}</strong></div>
        </div>
      )}
      {!stats && content && <pre className="bj-plain">{content}</pre>}
    </div>
  );
}

function LeaderboardPanel({ content }) {
  const t = useT();
  return (
    <div className="bj-shell bj-shell--info">
      <header className="bj-header">
        <div className="bj-brand">
          <BarChart3 size={18} />
          <div>
            <h3>{t("Leaderboard")}</h3>
            <p>{t("Top bankrolls")}</p>
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
  const t = useT();
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

  const targetChannelId = message.channelId || null;
  const targetGroupId = groupId || message.groupId || targetChannelId;

  const emitCommand = (command, args) => {
    if (!socket?.connected || !targetGroupId) return;
    setBusy(true);
    socket.emit("game:command", {
      groupId: targetChannelId ? undefined : targetGroupId,
      channelId: targetChannelId || undefined,
      command,
      args,
    });
    setTimeout(() => setBusy(false), 400);
  };

  const emitAction = (action) => {
    if (!socket?.connected || !targetGroupId) return;
    setBusy(true);
    socket.emit("game:action", {
      groupId: targetChannelId ? undefined : targetGroupId,
      channelId: targetChannelId || undefined,
      action,
      gameId: gameData?.id,
    });
    setTimeout(() => setBusy(false), 400);
  };

  if (type === "game_help") {
    return <HelpPanel credits={gameData?.credits ?? credits} />;
  }
  if (type === "game_credits") {
    return <CreditsPanel content={content} gameData={gameData} />;
  }
  if (type === "game_leaderboard" || type === "game_top") {
    return <LeaderboardPanel content={content} />;
  }

  const boardTypes = new Set(["game_start", "game_update", "game_end", "game_action"]);
  const isBoard =
    gameData &&
    boardTypes.has(type) &&
    (gameData.status === "playing" ||
      gameData.status === "dealer" ||
      gameData.status === "finished" ||
      gameData.status === "dealing");

  // Lobby only when explicitly requested / no live hand — never replace a live board
  if (type === "game_lobby" || !isBoard) {
    return (
      <LobbyTable
        credits={credits}
        onBet={(bet) => emitCommand("bj", String(bet))}
        onHelp={() => {}}
      />
    );
  }

  const isPlaying = gameData.status === "playing";
  const isFinished = gameData.status === "finished";
  const isMine = !gameData.userId || gameData.userId === currentUserId;
  const hideHole = Boolean(gameData.dealerHand?.holeHidden || isPlaying);
  const outcome = isFinished ? outcomeCopy(gameData.result, gameData.profit, gameData.bet, t) : null;

  let statusIcon = <Coins size={16} />;
  if (isPlaying) statusIcon = <Target size={16} />;
  else if (gameData.result === "blackjack") statusIcon = <Crown size={16} />;
  else if (gameData.result === "win") statusIcon = <Trophy size={16} />;
  else if (gameData.result === "loss") statusIcon = <AlertCircle size={16} />;
  else if (gameData.result === "push") statusIcon = <Coins size={16} />;

  const playerHighlight =
    isFinished && (gameData.result === "win" || gameData.result === "blackjack")
      ? "winner"
      : isFinished && gameData.result === "loss"
        ? "loser"
        : "";
  const dealerHighlight =
    isFinished && gameData.result === "loss"
      ? "winner"
      : isFinished && (gameData.result === "win" || gameData.result === "blackjack")
        ? "loser"
        : "";

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
            <h3>
              {isPlaying
                ? t("Live hand")
                : outcome?.title || t("Hand complete")}
            </h3>
            <p>
              @{gameData.username || t("Player")} · {t("Bet")} {gameData.bet?.toLocaleString()}
              {gameData.doubled ? ` · ${t("Doubled")}` : ""}
              {isFinished && outcome?.sub ? ` · ${outcome.sub}` : ""}
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

      <div className={`bj-felt ${isFinished ? `bj-felt--${gameData.result}` : ""}`}>
        <HandRow
          label={t("Dealer")}
          hand={gameData.dealerHand}
          hideHole={hideHole}
          highlight={dealerHighlight}
        />
        <div className="bj-felt-divider" />
        <HandRow
          label={t("You")}
          hand={gameData.playerHand}
          hideHole={false}
          highlight={playerHighlight}
        />
        <AnimatePresence>
          {isFinished && (
            <ResultStamp result={gameData.result} profit={gameData.profit} bet={gameData.bet} />
          )}
        </AnimatePresence>
      </div>

      {isPlaying && isMine && (
        <ActionBar
          actions={gameData.actions}
          onAction={emitAction}
          busy={busy}
        />
      )}

      {isPlaying && !isMine && (
        <div className="bj-spectator">{t("Watching this hand…")}</div>
      )}

      {isFinished && isMine && (
        <div className="bj-actions bj-actions--end">
          <motion.button
            type="button"
            className="bj-action bj-action--hit"
            whileTap={{ scale: 0.96 }}
            disabled={busy}
            onClick={() => emitCommand("bj", String(gameData.originalBet || gameData.bet))}
          >
            <RotateCcw size={16} />
            {t("Again")} ({(gameData.originalBet || gameData.bet)?.toLocaleString()})
          </motion.button>
          <motion.button
            type="button"
            className="bj-action bj-action--double"
            whileTap={{ scale: 0.96 }}
            disabled={busy || credits < (gameData.originalBet || gameData.bet) * 2}
            onClick={() =>
              emitCommand("bj", String(Math.min((gameData.originalBet || gameData.bet) * 2, credits)))
            }
          >
            <Coins size={16} />
            {t("Double stake")}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Descall Casino — Blackjack engine (server-authoritative)
 * Multi-deck shoe, proper soft totals, 3:2 blackjack, stake escrow.
 */

const crypto = require("crypto");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const VALUES = {
  A: 11, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "10": 10, J: 10, Q: 10, K: 10,
};

const MIN_BET = 10;
const MAX_BET = 25000;
const STARTING_CREDITS = 1000;
const SHOE_DECKS = 6;
const PENETRATION = 0.75; // reshuffle when 75% of shoe is dealt

function uid(prefix = "c") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = VALUES[rank];
    this.id = uid("card");
    this.color = suit === "♥" || suit === "♦" ? "red" : "black";
  }

  toJSON() {
    return {
      id: this.id,
      suit: this.suit,
      rank: this.rank,
      value: this.value,
      color: this.color,
    };
  }
}

class Shoe {
  constructor(decks = SHOE_DECKS) {
    this.decks = decks;
    this.cards = [];
    this.dealt = 0;
    this.reshuffle();
  }

  reshuffle() {
    this.cards = [];
    for (let d = 0; d < this.decks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push(new Card(suit, rank));
        }
      }
    }
    // Fisher–Yates
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.dealt = 0;
    this.cutIndex = Math.floor(this.cards.length * (1 - PENETRATION));
  }

  draw() {
    if (this.cards.length === 0 || this.cards.length <= this.cutIndex) {
      this.reshuffle();
    }
    this.dealt += 1;
    return this.cards.pop();
  }
}

class Hand {
  constructor() {
    this.cards = [];
  }

  add(card) {
    this.cards.push(card);
  }

  /** Soft/hard aware total */
  get value() {
    let total = 0;
    let aces = 0;
    for (const c of this.cards) {
      total += c.value;
      if (c.rank === "A") aces += 1;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  get isSoft() {
    let total = 0;
    let aces = 0;
    for (const c of this.cards) {
      total += c.value;
      if (c.rank === "A") aces += 1;
    }
    // Soft if at least one ace still counts as 11
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return aces > 0 && total <= 21;
  }

  get isBlackjack() {
    return this.cards.length === 2 && this.value === 21;
  }

  get isBust() {
    return this.value > 21;
  }

  toJSON() {
    return {
      cards: this.cards.map((c) => c.toJSON()),
      value: this.value,
      isSoft: this.isSoft,
      isBlackjack: this.isBlackjack,
      isBust: this.isBust,
    };
  }
}

class BlackjackGame {
  constructor({ userId, username, groupId, bet }) {
    this.id = uid("bj");
    this.userId = userId;
    this.username = username || "Player";
    this.groupId = groupId;
    this.bet = bet;
    this.originalBet = bet;
    this.shoe = new Shoe(SHOE_DECKS);
    this.playerHand = new Hand();
    this.dealerHand = new Hand();
    this.status = "dealing"; // dealing | playing | dealer | finished
    this.result = null; // blackjack | win | loss | push
    this.winAmount = 0; // credits returned to player (includes stake on win/push)
    this.profit = 0;
    this.doubled = false;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.history = []; // action log for UI
  }

  deal() {
    this.playerHand.add(this.shoe.draw());
    this.dealerHand.add(this.shoe.draw());
    this.playerHand.add(this.shoe.draw());
    this.dealerHand.add(this.shoe.draw());
    this.updatedAt = Date.now();
    this.history.push({ action: "deal", at: this.updatedAt });

    if (this.playerHand.isBlackjack) {
      if (this.dealerHand.isBlackjack) {
        this._finish("push");
      } else {
        this._finish("blackjack");
      }
      return this.getPublicState();
    }

    // Dealer peek for Ace / 10 upcard — auto resolve dealer BJ
    if (this.dealerHand.isBlackjack) {
      this._finish("loss");
      return this.getPublicState();
    }

    this.status = "playing";
    return this.getPublicState();
  }

  get canDouble() {
    return (
      this.status === "playing" &&
      this.playerHand.cards.length === 2 &&
      !this.doubled
    );
  }

  get canHit() {
    return this.status === "playing" && !this.playerHand.isBust;
  }

  get canStand() {
    return this.status === "playing";
  }

  hit() {
    if (!this.canHit) return { error: "HIT is not available right now." };
    this.playerHand.add(this.shoe.draw());
    this.updatedAt = Date.now();
    this.history.push({ action: "hit", at: this.updatedAt, value: this.playerHand.value });
    if (this.playerHand.isBust) {
      this._finish("loss");
    }
    return { state: this.getPublicState() };
  }

  stand() {
    if (!this.canStand) return { error: "STAND is not available right now." };
    this.updatedAt = Date.now();
    this.history.push({ action: "stand", at: this.updatedAt });
    return { state: this._dealerPlay() };
  }

  /**
   * Double down — caller must ensure player can afford extraBet === originalBet
   * and has already escrowed the additional stake.
   */
  double() {
    if (!this.canDouble) return { error: "DOUBLE is only available on your first two cards." };
    this.bet = this.originalBet * 2;
    this.doubled = true;
    this.playerHand.add(this.shoe.draw());
    this.updatedAt = Date.now();
    this.history.push({ action: "double", at: this.updatedAt, bet: this.bet });
    if (this.playerHand.isBust) {
      this._finish("loss");
      return { state: this.getPublicState() };
    }
    return { state: this._dealerPlay() };
  }

  _dealerPlay() {
    this.status = "dealer";
    // Dealer stands on all 17s (including soft 17) — H17 casino variant: hit soft 17
    while (
      this.dealerHand.value < 17 ||
      (this.dealerHand.value === 17 && this.dealerHand.isSoft)
    ) {
      this.dealerHand.add(this.shoe.draw());
    }
    this.updatedAt = Date.now();

    if (this.dealerHand.isBust) {
      this._finish("win");
    } else if (this.playerHand.value > this.dealerHand.value) {
      this._finish("win");
    } else if (this.playerHand.value < this.dealerHand.value) {
      this._finish("loss");
    } else {
      this._finish("push");
    }
    return this.getPublicState();
  }

  _finish(result) {
    this.status = "finished";
    this.result = result;
    this.updatedAt = Date.now();

    switch (result) {
      case "blackjack":
        // 3:2 — return stake + 1.5× stake
        this.winAmount = Math.floor(this.bet * 2.5);
        this.profit = this.winAmount - this.bet;
        break;
      case "win":
        this.winAmount = this.bet * 2;
        this.profit = this.bet;
        break;
      case "push":
        this.winAmount = this.bet;
        this.profit = 0;
        break;
      case "loss":
      default:
        this.winAmount = 0;
        this.profit = -this.bet;
        break;
    }
    this.history.push({ action: "finish", result, winAmount: this.winAmount, at: this.updatedAt });
  }

  getAvailableActions() {
    if (this.status !== "playing") return [];
    const actions = ["hit", "stand"];
    if (this.canDouble) actions.push("double");
    return actions;
  }

  getPublicState() {
    const hideHole = this.status === "playing";
    const dealerJson = this.dealerHand.toJSON();
    return {
      id: this.id,
      userId: this.userId,
      username: this.username,
      groupId: this.groupId,
      bet: this.bet,
      originalBet: this.originalBet,
      doubled: this.doubled,
      status: this.status,
      result: this.result,
      winAmount: this.winAmount,
      profit: this.profit,
      playerHand: this.playerHand.toJSON(),
      dealerHand: {
        cards: hideHole
          ? [dealerJson.cards[0], { id: "hole", suit: "?", rank: "?", hidden: true }]
          : dealerJson.cards,
        value: hideHole ? undefined : dealerJson.value,
        isSoft: hideHole ? undefined : dealerJson.isSoft,
        isBlackjack: hideHole ? false : dealerJson.isBlackjack,
        isBust: hideHole ? false : dealerJson.isBust,
        holeHidden: hideHole,
      },
      actions: this.getAvailableActions(),
      canHit: this.canHit,
      canStand: this.canStand,
      canDouble: this.canDouble,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Serialize for DB history (never call .toJSON on plain objects). */
  toHistoryPayload() {
    return {
      bet: this.bet,
      originalBet: this.originalBet,
      result: this.result,
      winAmount: this.winAmount,
      profit: this.profit,
      player_hand: this.playerHand.toJSON(),
      dealer_hand: this.dealerHand.toJSON(),
    };
  }
}

const activeGames = new Map(); // key: `${userId}:${groupId}` → BlackjackGame

function gameKey(userId, groupId) {
  return `${userId}:${groupId}`;
}

const GameManager = {
  MIN_BET,
  MAX_BET,
  STARTING_CREDITS,

  create(userId, groupId, bet, username) {
    const key = gameKey(userId, groupId);
    const existing = activeGames.get(key);
    if (existing && existing.status !== "finished") {
      return { error: "You already have an active hand. Use HIT / STAND / DOUBLE.", game: existing.getPublicState() };
    }

    const amount = Number(bet);
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      return { error: `Bet must be between ${MIN_BET} and ${MAX_BET.toLocaleString()}.` };
    }

    const game = new BlackjackGame({ userId, username, groupId, bet: Math.floor(amount) });
    const state = game.deal();
    activeGames.set(key, game);
    return { game: state, instance: game };
  },

  get(userId, groupId) {
    return activeGames.get(gameKey(userId, groupId)) || null;
  },

  remove(userId, groupId) {
    activeGames.delete(gameKey(userId, groupId));
  },

  action(userId, groupId, action) {
    const game = this.get(userId, groupId);
    if (!game) return { error: "No active game. Start with /bj <amount>." };
    if (game.status === "finished") {
      return { error: "This hand is already over.", game: game.getPublicState() };
    }

    let result;
    switch (String(action || "").toLowerCase()) {
      case "hit":
        result = game.hit();
        break;
      case "stand":
      case "stay":
        result = game.stand();
        break;
      case "double":
        result = game.double();
        break;
      default:
        return { error: "Unknown action." };
    }

    if (result.error) return { error: result.error, game: game.getPublicState() };
    return { game: result.state, instance: game };
  },

  cleanup(maxAgeMs = 10 * 60 * 1000) {
    const now = Date.now();
    for (const [key, game] of activeGames.entries()) {
      if (game.status === "finished" || now - game.updatedAt > maxAgeMs) {
        activeGames.delete(key);
      }
    }
  },
};

setInterval(() => GameManager.cleanup(), 5 * 60 * 1000).unref?.();

module.exports = {
  Card,
  Shoe,
  Hand,
  BlackjackGame,
  GameManager,
  MIN_BET,
  MAX_BET,
  STARTING_CREDITS,
  SUITS,
  RANKS,
};

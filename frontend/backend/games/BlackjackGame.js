/**
 * Blackjack Game Logic
 * Modern, casino-grade implementation
 */

const { v4: uuidv4 } = require('uuid');

// Kart destesi suit ve rank'leri
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Kart değerleri
const CARD_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11
};

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = CARD_VALUES[rank];
    this.id = uuidv4();
  }

  toString() {
    return `${this.suit}${this.rank}`;
  }

  toJSON() {
    return {
      suit: this.suit,
      rank: this.rank,
      value: this.value,
      color: this.suit === '♥' || this.suit === '♦' ? 'red' : 'black',
      id: this.id
    };
  }
}

class Deck {
  constructor(deckCount = 1) {
    this.deckCount = deckCount;
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (let d = 0; d < this.deckCount; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push(new Card(suit, rank));
        }
      }
    }
    this.shuffle();
  }

  shuffle() {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length === 0) {
      this.reset();
    }
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

  get value() {
    let value = 0;
    let aces = 0;

    for (const card of this.cards) {
      value += card.value;
      if (card.rank === 'A') aces++;
    }

    // As'ları 11'den 1'e çevir (bust olmamak için)
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  get isBlackjack() {
    return this.cards.length === 2 && this.value === 21;
  }

  get isBust() {
    return this.value > 21;
  }

  get isSoft() {
    // Soft hand: As 11 olarak sayılıyor
    let value = 0;
    let aces = 0;

    for (const card of this.cards) {
      value += card.value;
      if (card.rank === 'A') aces++;
    }

    return aces > 0 && value <= 21;
  }

  toJSON() {
    return {
      cards: this.cards.map(c => c.toJSON()),
      value: this.value,
      isBlackjack: this.isBlackjack,
      isBust: this.isBust,
      isSoft: this.isSoft
    };
  }
}

class BlackjackGame {
  constructor(userId, groupId, bet, deckCount = 1) {
    this.id = uuidv4();
    this.userId = userId;
    this.groupId = groupId;
    this.bet = bet;
    this.deck = new Deck(deckCount);
    this.playerHand = new Hand();
    this.dealerHand = new Hand();
    this.status = 'betting'; // betting, playing, dealer_turn, finished
    this.result = null; // win, loss, push, blackjack
    this.winAmount = 0;
    this.canDouble = false;
    this.canSplit = false;
    this.playerStand = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  start() {
    // İlk dağıtım
    this.playerHand.add(this.deck.draw());
    this.dealerHand.add(this.deck.draw());
    this.playerHand.add(this.deck.draw());
    this.dealerHand.add(this.deck.draw());

    this.status = 'playing';
    this.updatedAt = new Date();

    // Double kontrol (ilk iki kart toplamı 9, 10, 11 ise)
    const playerValue = this.playerHand.value;
    this.canDouble = [9, 10, 11].includes(playerValue);

    // Split kontrol (ilk iki kart aynı rank)
    this.canSplit = this.playerHand.cards[0].rank === this.playerHand.cards[1].rank;

    // Blackjack kontrol
    if (this.playerHand.isBlackjack) {
      if (this.dealerHand.isBlackjack) {
        this.endGame('push');
      } else {
        this.endGame('blackjack');
      }
    }

    return this.getState();
  }

  hit() {
    if (this.status !== 'playing') return null;

    this.playerHand.add(this.deck.draw());
    this.canDouble = false; // Hit sonrası double yok
    this.canSplit = false;
    this.updatedAt = new Date();

    if (this.playerHand.isBust) {
      this.endGame('loss');
    }

    return this.getState();
  }

  stand() {
    if (this.status !== 'playing') return null;

    this.playerStand = true;
    this.status = 'dealer_turn';
    this.updatedAt = new Date();

    return this.playDealerTurn();
  }

  double() {
    if (this.status !== 'playing' || !this.canDouble) return null;

    this.bet *= 2;
    this.playerHand.add(this.deck.draw());
    this.updatedAt = new Date();

    if (this.playerHand.isBust) {
      this.endGame('loss');
    } else {
      return this.stand();
    }

    return this.getState();
  }

  playDealerTurn() {
    // Dealer kuralları: 17'ye kadar çek, soft 17'de bile çek
    while (this.dealerHand.value < 17) {
      this.dealerHand.add(this.deck.draw());
    }

    this.updatedAt = new Date();

    // Sonuç hesaplama
    const playerValue = this.playerHand.value;
    const dealerValue = this.dealerHand.value;

    if (this.dealerHand.isBust) {
      this.endGame('win');
    } else if (playerValue > dealerValue) {
      this.endGame('win');
    } else if (playerValue < dealerValue) {
      this.endGame('loss');
    } else {
      this.endGame('push');
    }

    return this.getState();
  }

  endGame(result) {
    this.status = 'finished';
    this.result = result;
    this.updatedAt = new Date();

    switch (result) {
      case 'blackjack':
        this.winAmount = Math.floor(this.bet * 2.5); // 3:2 ödeme
        break;
      case 'win':
        this.winAmount = this.bet * 2; // 1:1 ödeme
        break;
      case 'push':
        this.winAmount = this.bet; // Bahis iade
        break;
      case 'loss':
        this.winAmount = 0;
        break;
    }

    return this.getState();
  }

  getState() {
    // Dealer'ın ilk kartı gizli (hole card)
    const dealerVisible = this.status === 'playing' 
      ? [this.dealerHand.cards[0].toJSON()]
      : this.dealerHand.toJSON().cards;

    return {
      id: this.id,
      userId: this.userId,
      groupId: this.groupId,
      bet: this.bet,
      status: this.status,
      result: this.result,
      winAmount: this.winAmount,
      playerHand: this.playerHand.toJSON(),
      dealerHand: {
        ...this.dealerHand.toJSON(),
        visibleCards: dealerVisible,
        hiddenCard: this.status === 'playing' && this.dealerHand.cards[1] 
          ? this.dealerHand.cards[1].toJSON() 
          : null
      },
      canHit: this.status === 'playing' && !this.playerHand.isBust,
      canStand: this.status === 'playing',
      canDouble: this.status === 'playing' && this.canDouble,
      canSplit: this.status === 'playing' && this.canSplit,
      actions: this.getAvailableActions()
    };
  }

  getAvailableActions() {
    if (this.status !== 'playing') return [];
    
    const actions = ['hit', 'stand'];
    if (this.canDouble) actions.push('double');
    // Split henüz implemente edilmedi, sadece göster
    // if (this.canSplit) actions.push('split');
    
    return actions;
  }

  // Dealer'ın hole card'ını aç (oyun bitince)
  revealDealerCard() {
    return this.dealerHand.cards[1]?.toJSON() || null;
  }
}

// Aktif oyunları saklama (bellekte - production'da Redis önerilir)
const activeGames = new Map();

// Game manager fonksiyonları
const GameManager = {
  createGame(userId, groupId, bet) {
    const key = `${userId}:${groupId}`;
    
    // Mevcut oyunu kontrol et
    if (activeGames.has(key)) {
      const existing = activeGames.get(key);
      if (existing.status !== 'finished') {
        return { error: 'Zaten aktif bir oyununuz var', game: existing.getState() };
      }
    }

    const game = new BlackjackGame(userId, groupId, bet);
    activeGames.set(key, game);
    return { game: game.start() };
  },

  getGame(userId, groupId) {
    const key = `${userId}:${groupId}`;
    return activeGames.get(key) || null;
  },

  removeGame(userId, groupId) {
    const key = `${userId}:${groupId}`;
    activeGames.delete(key);
  },

  action(userId, groupId, action) {
    const key = `${userId}:${groupId}`;
    const game = activeGames.get(key);
    
    if (!game) {
      return { error: 'Aktif oyun bulunamadı' };
    }

    if (game.status === 'finished') {
      return { error: 'Oyun zaten bitti', game: game.getState() };
    }

    let result;
    switch (action) {
      case 'hit':
        result = game.hit();
        break;
      case 'stand':
        result = game.stand();
        break;
      case 'double':
        result = game.double();
        break;
      default:
        return { error: 'Geçersiz aksiyon' };
    }

    // Oyun bittiyse temizle (opsiyonel - history için saklayabilirsiniz)
    if (game.status === 'finished') {
      // Oyun bitti, isterseniz burada history kaydedin
      // GameManager.removeGame(userId, groupId);
    }

    return { game: result };
  },

  // Tüm aktif oyunları listele (admin için)
  getAllActiveGames() {
    return Array.from(activeGames.values()).map(g => g.getState());
  },

  // Eski oyunları temizle (10 dakika inaktif)
  cleanupOldGames(maxAgeMinutes = 10) {
    const now = new Date();
    for (const [key, game] of activeGames.entries()) {
      const age = (now - game.updatedAt) / (1000 * 60);
      if (age > maxAgeMinutes || game.status === 'finished') {
        activeGames.delete(key);
      }
    }
  }
};

// Periyodik temizlik (her 5 dakikada bir)
setInterval(() => {
  GameManager.cleanupOldGames();
}, 5 * 60 * 1000);

module.exports = {
  Card,
  Deck,
  Hand,
  BlackjackGame,
  GameManager,
  SUITS,
  RANKS,
  CARD_VALUES
};

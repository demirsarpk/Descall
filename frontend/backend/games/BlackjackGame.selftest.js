/**
 * Run: node frontend/backend/games/BlackjackGame.selftest.js
 */
const { Hand, Card, GameManager, BlackjackGame } = require("./BlackjackGame");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Soft ace
const h = new Hand();
h.add(new Card("♠", "A"));
h.add(new Card("♥", "6"));
assert(h.value === 17 && h.isSoft, "soft 17");
h.add(new Card("♦", "K"));
assert(h.value === 17 && !h.isSoft, "soft→hard 17");

// Blackjack
const bj = new Hand();
bj.add(new Card("♠", "A"));
bj.add(new Card("♥", "K"));
assert(bj.isBlackjack && bj.value === 21, "blackjack");

// Bust
const bust = new Hand();
bust.add(new Card("♠", "K"));
bust.add(new Card("♥", "Q"));
bust.add(new Card("♦", "5"));
assert(bust.isBust && bust.value === 25, "bust");

// Manager create + hit path
const uid = "test-user-1";
const gid = "test-group-1";
GameManager.remove(uid, gid);
const created = GameManager.create(uid, gid, 100, "Tester");
assert(created.game && created.instance, "create game");
assert(created.game.bet === 100, "bet");
assert(["playing", "finished"].includes(created.game.status), "status after deal");

if (created.game.status === "playing") {
  const hit = GameManager.action(uid, gid, "hit");
  assert(hit.game, "hit state");
  if (hit.game.status === "playing") {
    const stand = GameManager.action(uid, gid, "stand");
    assert(stand.game.status === "finished", "stand finishes");
    assert(stand.instance.toHistoryPayload().player_hand.cards.length >= 2, "history payload");
  }
}

// Invalid bet
const bad = GameManager.create("u2", "g2", 5, "X");
assert(bad.error, "min bet enforced");

console.log("BlackjackGame.selftest.js: ok");

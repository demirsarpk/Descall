"use strict";

/**
 * Shared, in-memory "don't pay twice for the same spammed text" guard used
 * by both DM and group message DesCoin crediting. Kept separate from
 * descoin.js because it's a per-process anti-spam heuristic, not part of
 * the durable ledger/cap logic.
 */

const lastMessageTextByUser = new Map(); // userId -> { text, at }
const DEDUPE_WINDOW_MS = 60_000;

function shouldCreditMessage(userId, text) {
  const now = Date.now();
  const prev = lastMessageTextByUser.get(userId);
  lastMessageTextByUser.set(userId, { text, at: now });
  if (!text || !String(text).trim()) return false;
  if (prev && prev.text === text && now - prev.at < DEDUPE_WINDOW_MS) return false;
  return true;
}

module.exports = { shouldCreditMessage };

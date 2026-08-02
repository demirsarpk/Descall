/**
 * Casino socket handlers — Blackjack (server-authoritative credits + state).
 */

const { GameManager, MIN_BET, MAX_BET, STARTING_CREDITS } = require("../games/BlackjackGame");
const supabase = require("../db/supabase");

const BOT_USER = {
  id: "game-bot",
  username: "Casino",
  avatar_url: null,
  isBot: true,
};

const COMMAND_REGEX = /^\/(\w+)(?:\s+(\S+))?/;
const VALID_COMMANDS = new Set([
  "bj", "blackjack", "hit", "stand", "stay", "double",
  "credits", "bakiye", "balance", "top", "lider",
  "help", "yardım", "commands", "jb",
]);

function msgId() {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createGameMessage(content, gameData = null, type = "game_action") {
  // Stable id per hand so client upserts in place and bubbles don't flash away
  const handId = gameData?.id;
  return {
    id: handId ? `casino-hand-${handId}` : msgId(),
    sender: BOT_USER,
    content,
    type,
    gameData,
    created_at: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };
}

async function getUserCredits(userId) {
  try {
    const { data, error } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: created, error: insertError } = await supabase
        .from("user_credits")
        .insert({ user_id: userId, credits: STARTING_CREDITS })
        .select("*")
        .single();
      if (insertError) {
        // Race: another request created it
        const { data: again } = await supabase
          .from("user_credits")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (again) return again;
        throw insertError;
      }
      return created;
    }
    return data;
  } catch (err) {
    console.error("[Game] getUserCredits:", err.message || err);
    return {
      user_id: userId,
      credits: STARTING_CREDITS,
      total_won: 0,
      total_lost: 0,
      games_played: 0,
    };
  }
}

/**
 * Apply credit delta. Returns updated row or null.
 * delta > 0 credit in, delta < 0 debit.
 */
async function applyCreditDelta(userId, delta, meta = {}) {
  try {
    const current = await getUserCredits(userId);
    const next = Math.max(0, (current.credits || 0) + delta);
    const patch = {
      user_id: userId,
      credits: next,
      updated_at: new Date().toISOString(),
    };

    if (meta.gamesPlayedInc) {
      patch.games_played = (current.games_played || 0) + 1;
    }
    if (meta.wonInc) {
      patch.total_won = (current.total_won || 0) + meta.wonInc;
    }
    if (meta.lostInc) {
      patch.total_lost = (current.total_lost || 0) + meta.lostInc;
    }

    const { data, error } = await supabase
      .from("user_credits")
      .upsert(patch, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Game] applyCreditDelta:", err.message || err);
    return null;
  }
}

async function saveGameHistory(userId, groupId, instance) {
  try {
    const payload = instance.toHistoryPayload();
    const { error } = await supabase.from("game_history").insert({
      user_id: userId,
      game_type: "blackjack",
      group_id: groupId,
      bet_amount: payload.bet,
      result: payload.result,
      win_amount: payload.winAmount,
      player_hand: payload.player_hand,
      dealer_hand: payload.dealer_hand,
    });
    if (error) console.error("[Game] saveGameHistory:", error.message || error);
  } catch (err) {
    console.error("[Game] saveGameHistory exception:", err.message || err);
  }
}

function emitToGroup(io, socket, groupId, message) {
  const payload = { groupId, message };
  socket.emit("game:message", payload);
  socket.to(`group:${groupId}`).emit("game:message", payload);
}

function emitGameUpdate(io, socket, groupId, message) {
  const payload = { groupId, message };
  // Emit both: game:update (in-place) + game:message (first paint / older clients)
  socket.emit("game:update", payload);
  socket.to(`group:${groupId}`).emit("game:update", payload);
  socket.emit("game:message", payload);
  socket.to(`group:${groupId}`).emit("game:message", payload);
}

function registerGameHandlers(io, socket) {
  const myId = socket.user?.id;
  const myUsername = socket.user?.username;
  if (!myId) return;

  socket.on("game:command", async ({ groupId, command, args } = {}) => {
    if (!groupId || !command) return;
    const full = `/${command}${args != null && args !== "" ? ` ${args}` : ""}`.trim();
    await handleGameCommand(io, socket, myId, myUsername, groupId, full);
  });

  socket.on("game:action", async ({ groupId, action } = {}) => {
    if (!groupId || !action) return;
    const a = String(action).toLowerCase();
    if (a === "help") {
      await handleHelp(io, socket, myId, groupId);
      return;
    }
    if (a === "credits" || a === "balance") {
      await handleCreditsCheck(io, socket, myId, groupId);
      return;
    }
    await handleBlackjackAction(io, socket, myId, myUsername, groupId, a);
  });

  socket.on("game:credits", async (callback) => {
    const row = await getUserCredits(myId);
    if (typeof callback === "function") {
      callback({
        credits: row.credits,
        total_won: row.total_won || 0,
        total_lost: row.total_lost || 0,
        games_played: row.games_played || 0,
      });
    }
  });

  socket.on("game:status", ({ groupId } = {}, callback) => {
    const game = groupId ? GameManager.get(myId, groupId) : null;
    if (typeof callback === "function") {
      callback({
        active: Boolean(game && game.status !== "finished"),
        game: game ? game.getPublicState() : null,
      });
    }
  });
}

async function handleGameCommand(io, socket, userId, username, groupId, fullCommand) {
  const match = String(fullCommand || "").trim().match(COMMAND_REGEX);
  if (!match) return;

  const command = match[1].toLowerCase();
  const arg = match[2];

  switch (command) {
    case "bj":
    case "blackjack":
      await handleBlackjackStart(io, socket, userId, username, groupId, arg);
      break;
    case "hit":
      await handleBlackjackAction(io, socket, userId, username, groupId, "hit");
      break;
    case "stand":
    case "stay":
      await handleBlackjackAction(io, socket, userId, username, groupId, "stand");
      break;
    case "double":
      await handleBlackjackAction(io, socket, userId, username, groupId, "double");
      break;
    case "credits":
    case "bakiye":
    case "balance":
      await handleCreditsCheck(io, socket, userId, groupId);
      break;
    case "top":
    case "lider":
      await handleLeaderboard(io, socket, userId, groupId);
      break;
    case "help":
    case "yardım":
    case "commands":
      await handleHelp(io, socket, userId, groupId);
      break;
    case "jb":
      emitToGroup(
        io,
        socket,
        groupId,
        createGameMessage(
          "Did you mean **/bj**?\n\nStart a hand: `/bj 100`\nAll commands: `/help`",
          null,
          "game_help"
        )
      );
      break;
    default:
      if (VALID_COMMANDS.has(command)) break;
      await handleHelp(io, socket, userId, groupId, command);
  }
}

async function handleBlackjackStart(io, socket, userId, username, groupId, betArg) {
  const bet = parseInt(betArg, 10);

  if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(
        `**Blackjack**\n\nInvalid bet.\nUsage: \`/bj <amount>\`\nMin **${MIN_BET}** · Max **${MAX_BET.toLocaleString()}**`,
        { status: "lobby", actions: [] },
        "game_lobby"
      )
    );
    return;
  }

  const existing = GameManager.get(userId, groupId);
  if (existing && existing.status !== "finished") {
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(
        "You already have an active hand. Use **HIT**, **STAND**, or **DOUBLE**.",
        existing.getPublicState(),
        "game_update"
      )
    );
    return;
  }

  const credits = await getUserCredits(userId);
  if ((credits.credits || 0) < bet) {
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(
        `Insufficient balance.\nYou have **${(credits.credits || 0).toLocaleString()}** · need **${bet.toLocaleString()}**`,
        { status: "lobby", credits: credits.credits },
        "game_lobby"
      )
    );
    return;
  }

  // Escrow stake
  const afterDebit = await applyCreditDelta(userId, -bet);
  if (!afterDebit || afterDebit.credits < 0) {
    emitToGroup(io, socket, groupId, createGameMessage("Could not place bet. Try again."));
    return;
  }

  const created = GameManager.create(userId, groupId, bet, username);
  if (created.error) {
    // Refund escrow
    await applyCreditDelta(userId, bet);
    emitToGroup(io, socket, groupId, createGameMessage(`❌ ${created.error}`));
    return;
  }

  const state = created.game;
  const instance = created.instance;

  // Natural blackjack / dealer peek resolved immediately
  if (state.status === "finished") {
    await settleFinishedHand(userId, groupId, instance);
    const msg = createGameMessage(
      buildResultText(username, state),
      { ...state, credits: (await getUserCredits(userId)).credits },
      "game_end"
    );
    emitGameUpdate(io, socket, groupId, msg);
    return;
  }

  const msg = createGameMessage(
    `**Blackjack** — @${username}\nBet **${bet.toLocaleString()}** · Balance **${afterDebit.credits.toLocaleString()}**`,
    { ...state, credits: afterDebit.credits },
    "game_start"
  );
  emitGameUpdate(io, socket, groupId, msg);
}

async function handleBlackjackAction(io, socket, userId, username, groupId, action) {
  const instance = GameManager.get(userId, groupId);
  if (!instance) {
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage("No active hand. Start with `/bj 100`.", { status: "lobby" }, "game_lobby")
    );
    return;
  }

  if (action === "double") {
    const extra = instance.originalBet;
    const credits = await getUserCredits(userId);
    if ((credits.credits || 0) < extra) {
      emitToGroup(
        io,
        socket,
        groupId,
        createGameMessage(
          `Not enough credits to double (need **${extra.toLocaleString()}** more).`,
          instance.getPublicState(),
          "game_update"
        )
      );
      return;
    }
    const debited = await applyCreditDelta(userId, -extra);
    if (!debited) {
      emitToGroup(io, socket, groupId, createGameMessage("Could not double bet."));
      return;
    }
  }

  const result = GameManager.action(userId, groupId, action);
  if (result.error) {
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(`❌ ${result.error}`, result.game || instance.getPublicState(), "game_update")
    );
    return;
  }

  const state = result.game;
  const live = result.instance || instance;

  if (state.status === "finished") {
    await settleFinishedHand(userId, groupId, live);
    const credits = await getUserCredits(userId);
    const msg = createGameMessage(
      buildResultText(username, state),
      { ...state, credits: credits.credits },
      "game_end"
    );
    emitGameUpdate(io, socket, groupId, msg);
    return;
  }

  const credits = await getUserCredits(userId);
  const msg = createGameMessage(
    `**${action.toUpperCase()}** — @${username}`,
    { ...state, credits: credits.credits },
    "game_update"
  );
  emitGameUpdate(io, socket, groupId, msg);
}

async function settleFinishedHand(userId, groupId, instance) {
  const payout = instance.winAmount || 0;
  const meta = { gamesPlayedInc: true };
  if (instance.result === "win" || instance.result === "blackjack") {
    meta.wonInc = Math.max(0, instance.profit || 0);
  }
  if (instance.result === "loss") {
    meta.lostInc = instance.bet;
  }

  if (payout > 0) {
    await applyCreditDelta(userId, payout, meta);
  } else {
    await applyCreditDelta(userId, 0, meta);
  }

  await saveGameHistory(userId, groupId, instance);
  GameManager.remove(userId, groupId);
}

function buildResultText(username, state) {
  const lines = [`**Blackjack** — @${username}`];
  lines.push(`Player **${state.playerHand?.value}** · Dealer **${state.dealerHand?.value}**`);
  switch (state.result) {
    case "blackjack":
      lines.push(`BLACKJACK · +${(state.profit || 0).toLocaleString()} credits`);
      break;
    case "win":
      lines.push(`You win · +${(state.profit || 0).toLocaleString()} credits`);
      break;
    case "push":
      lines.push("Push — stake returned");
      break;
    case "loss":
      lines.push(`Dealer wins · −${(state.bet || 0).toLocaleString()} credits`);
      break;
    default:
      break;
  }
  return lines.join("\n");
}

async function handleCreditsCheck(io, socket, userId, groupId) {
  const credits = await getUserCredits(userId);
  const content =
    `**Balance**\n\n` +
    `Credits: **${(credits.credits || 0).toLocaleString()}**\n` +
    `Won: **${(credits.total_won || 0).toLocaleString()}**\n` +
    `Lost: **${(credits.total_lost || 0).toLocaleString()}**\n` +
    `Hands: **${(credits.games_played || 0).toLocaleString()}**\n\n` +
    `Play: \`/bj 100\``;

  emitToGroup(
    io,
    socket,
    groupId,
    createGameMessage(content, { credits: credits.credits, stats: credits }, "game_credits")
  );
}

async function handleLeaderboard(io, socket, userId, groupId) {
  try {
    const { data: topUsers, error } = await supabase
      .from("user_credits")
      .select("user_id, credits, total_won, games_played")
      .order("credits", { ascending: false })
      .limit(10);

    if (error) throw error;

    let content = "**Leaderboard** — Top 10\n\n";
    if (!topUsers?.length) {
      content += "No hands played yet. Be first: `/bj 100`";
    } else {
      const ids = topUsers.map((u) => u.user_id);
      const { data: users } = await supabase
        .from("users")
        .select("id, username")
        .in("id", ids);
      const nameById = new Map((users || []).map((u) => [u.id, u.username]));
      const medals = ["🥇", "🥈", "🥉"];
      topUsers.forEach((row, i) => {
        const name = nameById.get(row.user_id) || "Player";
        const medal = medals[i] || `${i + 1}.`;
        content += `${medal} **${name}** — ${(row.credits || 0).toLocaleString()}\n`;
      });
    }

    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(content, { leaders: topUsers || [] }, "game_leaderboard")
    );
  } catch (err) {
    console.error("[Game] leaderboard:", err.message || err);
    emitToGroup(io, socket, groupId, createGameMessage("Could not load leaderboard."));
  }
}

async function handleHelp(io, socket, userId, groupId, unknownCommand = null) {
  const credits = await getUserCredits(userId);
  let content = "**Casino Help**\n\n";
  if (unknownCommand) content += `Unknown command: \`/${unknownCommand}\`\n\n`;
  content +=
    `Balance: **${(credits.credits || 0).toLocaleString()}**\n\n` +
    `**Play**\n` +
    `\`/bj <amount>\` — deal a hand\n` +
    `\`/hit\` · \`/stand\` · \`/double\`\n\n` +
    `**Info**\n` +
    `\`/credits\` · \`/top\` · \`/help\`\n\n` +
    `**Rules**\n` +
    `• Beat the dealer without busting (21)\n` +
    `• Dealer hits soft 17\n` +
    `• Blackjack pays 3:2\n` +
    `• Win pays 1:1 · Push returns stake\n` +
    `• Starting bankroll: ${STARTING_CREDITS.toLocaleString()} credits`;

  emitToGroup(
    io,
    socket,
    groupId,
    createGameMessage(
      content,
      { credits: credits.credits },
      "game_help"
    )
  );
}

module.exports = {
  registerGameHandlers,
  getUserCredits,
  BOT_USER,
  handleGameCommand,
  createGameMessage,
  VALID_COMMANDS,
  MIN_BET,
  MAX_BET,
};

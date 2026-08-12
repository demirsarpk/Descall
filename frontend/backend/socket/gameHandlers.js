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
  "help", "yardım", "commands", "jb", "daily",
]);

const DAILY_BONUS = 250;

function msgId() {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * One casino bubble per player in a group.
 * Lobby → deal → hit/stand → result → again all upsert the same message.
 */
function sessionIdFor(ownerUserId) {
  return ownerUserId ? `casino-session-${ownerUserId}` : null;
}

function createGameMessage(content, gameData = null, type = "game_action", ownerUserId = null) {
  const owner = ownerUserId || gameData?.userId || null;
  const sid = sessionIdFor(owner);
  const handId = gameData?.id;
  const data =
    gameData == null
      ? null
      : {
          ...gameData,
          sessionOwnerId: owner || gameData.sessionOwnerId || null,
        };
  return {
    id: sid || (handId ? `casino-hand-${handId}` : msgId()),
    sessionOwnerId: owner || null,
    sender: BOT_USER,
    content,
    type,
    gameData: data,
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
    const opts = currentEmitRoom();
    const payload = instance.toHistoryPayload();
    // Server text channels reuse roomId as channelId — omit FK group_id there
    const row = {
      user_id: userId,
      game_type: "blackjack",
      bet_amount: payload.bet,
      result: payload.result,
      win_amount: payload.winAmount,
      player_hand: payload.player_hand,
      dealer_hand: payload.dealer_hand,
    };
    if (!opts.channelId && groupId) {
      row.group_id = groupId;
    }
    const { error } = await supabase.from("game_history").insert(row);
    if (error) console.error("[Game] saveGameHistory:", error.message || error);
  } catch (err) {
    console.error("[Game] saveGameHistory exception:", err.message || err);
  }
}

/** Stack so server-channel games can reuse group emit helpers. */
const emitRoomStack = [];
function pushEmitRoom(opts) {
  emitRoomStack.push(opts || {});
}
function popEmitRoom() {
  emitRoomStack.pop();
}
function currentEmitRoom() {
  return emitRoomStack[emitRoomStack.length - 1] || {};
}

function emitToGroup(io, socket, groupId, message) {
  const opts = currentEmitRoom();
  const channelId = opts.channelId || null;
  const roomId = channelId || groupId;
  const payload = {
    groupId: roomId,
    channelId: channelId || null,
    serverId: opts.serverId || null,
    message,
  };
  const room = channelId ? `server-channel:${channelId}` : `group:${groupId}`;
  socket.emit("game:message", payload);
  socket.to(room).emit("game:message", payload);
}

function emitGameUpdate(io, socket, groupId, message) {
  const opts = currentEmitRoom();
  const channelId = opts.channelId || null;
  const roomId = channelId || groupId;
  const payload = {
    groupId: roomId,
    channelId: channelId || null,
    serverId: opts.serverId || null,
    message,
  };
  const room = channelId ? `server-channel:${channelId}` : `group:${groupId}`;
  // Emit both: game:update (in-place) + game:message (first paint / older clients)
  socket.emit("game:update", payload);
  socket.to(room).emit("game:update", payload);
  socket.emit("game:message", payload);
  socket.to(room).emit("game:message", payload);
}

function registerGameHandlers(io, socket) {
  const myId = socket.user?.id;
  const myUsername = socket.user?.username;
  if (!myId) return;

  socket.on("game:command", async ({ groupId, channelId, command, args } = {}) => {
    const roomId = channelId || groupId;
    if (!roomId || !command) return;
    const full = `/${command}${args != null && args !== "" ? ` ${args}` : ""}`.trim();
    await handleGameCommand(
      io,
      socket,
      myId,
      myUsername,
      roomId,
      full,
      channelId ? { channelId } : {}
    );
  });

  socket.on("game:action", async ({ groupId, channelId, action } = {}) => {
    const roomId = channelId || groupId;
    if (!roomId || !action) return;
    const a = String(action).toLowerCase();
    const opts = channelId ? { channelId } : {};
    pushEmitRoom(opts);
    try {
      if (a === "help") {
        await handleHelp(io, socket, myId, roomId);
        return;
      }
      if (a === "credits" || a === "balance") {
        await handleCreditsCheck(io, socket, myId, roomId);
        return;
      }
      await handleBlackjackAction(io, socket, myId, myUsername, roomId, a);
    } finally {
      popEmitRoom();
    }
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

async function handleGameCommand(io, socket, userId, username, groupId, fullCommand, opts = {}) {
  const match = String(fullCommand || "").trim().match(COMMAND_REGEX);
  if (!match) return;

  const command = match[1].toLowerCase();
  const arg = match[2];
  pushEmitRoom(opts);
  try {
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
    case "daily":
      await handleDailyClaim(io, socket, userId, username, groupId);
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
          { userId },
          "game_help",
          userId
        )
      );
      break;
    default:
      if (VALID_COMMANDS.has(command)) break;
      await handleHelp(io, socket, userId, groupId, command);
  }
  } finally {
    popEmitRoom();
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
        { status: "lobby", actions: [], userId },
        "game_lobby",
        userId
      )
    );
    return;
  }

  const existing = GameManager.get(userId, groupId);
  if (existing && existing.status !== "finished") {
    emitGameUpdate(
      io,
      socket,
      groupId,
      createGameMessage(
        "You already have an active hand. Use **HIT**, **STAND**, or **DOUBLE**.",
        existing.getPublicState(),
        "game_update",
        userId
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
        { status: "lobby", credits: credits.credits, userId },
        "game_lobby",
        userId
      )
    );
    return;
  }

  // Escrow stake
  const afterDebit = await applyCreditDelta(userId, -bet);
  if (!afterDebit || afterDebit.credits < 0) {
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage("Could not place bet. Try again.", { status: "lobby", userId }, "game_lobby", userId)
    );
    return;
  }

  const created = GameManager.create(userId, groupId, bet, username);
  if (created.error) {
    // Refund escrow
    await applyCreditDelta(userId, bet);
    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(
        `❌ ${created.error}`,
        { status: "lobby", credits: (await getUserCredits(userId)).credits, userId },
        "game_lobby",
        userId
      )
    );
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
      "game_end",
      userId
    );
    emitGameUpdate(io, socket, groupId, msg);
    return;
  }

  const msg = createGameMessage(
    `**Blackjack** — @${username}\nBet **${bet.toLocaleString()}** · Balance **${afterDebit.credits.toLocaleString()}**`,
    { ...state, credits: afterDebit.credits },
    "game_start",
    userId
  );
  emitGameUpdate(io, socket, groupId, msg);
}

async function handleBlackjackAction(io, socket, userId, username, groupId, action) {
  const instance = GameManager.get(userId, groupId);
  if (!instance) {
    // Soft notice only — do not wipe a finished board with a fresh lobby
    socket.emit("game:notice", {
      groupId,
      text: "No active hand. Start with `/bj 100` or tap Again.",
    });
    return;
  }

  let result;
  if (action === "double") {
    if (!instance.canDouble) {
      emitGameUpdate(
        io,
        socket,
        groupId,
        createGameMessage(
          `❌ DOUBLE is only available on your first two cards.`,
          instance.getPublicState(),
          "game_update",
          userId
        )
      );
      return;
    }
    const extra = instance.originalBet;
    const credits = await getUserCredits(userId);
    if ((credits.credits || 0) < extra) {
      emitGameUpdate(
        io,
        socket,
        groupId,
        createGameMessage(
          `Not enough credits to double (need **${extra.toLocaleString()}** more).`,
          instance.getPublicState(),
          "game_update",
          userId
        )
      );
      return;
    }
    const debited = await applyCreditDelta(userId, -extra);
    if (!debited) {
      socket.emit("game:notice", { groupId, text: "Could not double bet." });
      return;
    }

    result = GameManager.action(userId, groupId, action);
    if (result.error) {
      // Refund the double stake — action failed after debit
      await applyCreditDelta(userId, extra);
      emitGameUpdate(
        io,
        socket,
        groupId,
        createGameMessage(
          `❌ ${result.error}`,
          result.game || instance.getPublicState(),
          "game_update",
          userId
        )
      );
      return;
    }
  } else {
    result = GameManager.action(userId, groupId, action);
    if (result.error) {
      emitGameUpdate(
        io,
        socket,
        groupId,
        createGameMessage(
          `❌ ${result.error}`,
          result.game || instance.getPublicState(),
          "game_update",
          userId
        )
      );
      return;
    }
  }

  const state = result.game;
  const live = result.instance || instance;

  if (state.status === "finished") {
    await settleFinishedHand(userId, groupId, live);
    const credits = await getUserCredits(userId);
    const msg = createGameMessage(
      buildResultText(username, state),
      { ...state, credits: credits.credits },
      "game_end",
      userId
    );
    emitGameUpdate(io, socket, groupId, msg);
    return;
  }

  const credits = await getUserCredits(userId);
  const msg = createGameMessage(
    `**${action.toUpperCase()}** — @${username}`,
    { ...state, credits: credits.credits },
    "game_update",
    userId
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

async function handleDailyClaim(io, socket, userId, username, groupId) {
  try {
    const credits = await getUserCredits(userId);
    const last = credits.last_daily_claim ? new Date(credits.last_daily_claim) : null;
    const now = new Date();
    const sameUtcDay =
      last &&
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() === now.getUTCDate();

    if (sameUtcDay) {
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const hours = Math.max(1, Math.ceil((next - now) / (60 * 60 * 1000)));
      emitToGroup(
        io,
        socket,
        groupId,
        createGameMessage(
          `**Daily bonus** already claimed today.\n\nCome back in about **${hours}h**.\nBalance: **${(credits.credits || 0).toLocaleString()}**`,
          { credits: credits.credits, userId, dailyClaimed: true },
          "game_credits",
          userId
        )
      );
      return;
    }

    // Atomic-ish claim: only succeed if last claim is older than today (or null)
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const nextCredits = Math.max(0, (credits.credits || 0) + DAILY_BONUS);
    let query = supabase
      .from("user_credits")
      .update({
        credits: nextCredits,
        last_daily_claim: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);

    if (credits.last_daily_claim) {
      query = query.lt("last_daily_claim", todayStart);
    } else {
      query = query.is("last_daily_claim", null);
    }

    const { data, error } = await query.select("*").maybeSingle();

    if (error) {
      // Column may not exist yet — fall back to applyCreditDelta + best-effort stamp
      console.warn("[Game] daily claim update:", error.message || error);
      const updated = await applyCreditDelta(userId, DAILY_BONUS);
      await supabase
        .from("user_credits")
        .update({ last_daily_claim: now.toISOString() })
        .eq("user_id", userId);
      emitToGroup(
        io,
        socket,
        groupId,
        createGameMessage(
          `**Daily bonus** claimed!\n\n+**${DAILY_BONUS.toLocaleString()}** credits\nBalance: **${(updated?.credits ?? nextCredits).toLocaleString()}**\n\nCome back tomorrow for more.`,
          { credits: updated?.credits ?? nextCredits, userId, dailyClaimed: true },
          "game_credits",
          userId
        )
      );
      return;
    }

    if (!data) {
      // Lost race or already claimed
      const fresh = await getUserCredits(userId);
      emitToGroup(
        io,
        socket,
        groupId,
        createGameMessage(
          `**Daily bonus** already claimed today.\n\nBalance: **${(fresh.credits || 0).toLocaleString()}**`,
          { credits: fresh.credits, userId, dailyClaimed: true },
          "game_credits",
          userId
        )
      );
      return;
    }

    emitToGroup(
      io,
      socket,
      groupId,
      createGameMessage(
        `🎁 **@${username}** claimed the daily bonus!\n\n+**${DAILY_BONUS.toLocaleString()}** credits\nBalance: **${(data.credits || 0).toLocaleString()}**`,
        { credits: data.credits, userId, dailyClaimed: true },
        "game_credits",
        userId
      )
    );
  } catch (err) {
    console.error("[Game] daily:", err.message || err);
    socket.emit("game:notice", { groupId, text: "Could not claim daily bonus." });
  }
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
    createGameMessage(content, { credits: credits.credits, stats: credits, userId }, "game_credits", userId)
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
      createGameMessage(content, { leaders: topUsers || [], userId }, "game_leaderboard", userId)
    );
  } catch (err) {
    console.error("[Game] leaderboard:", err.message || err);
    socket.emit("game:notice", { groupId, text: "Could not load leaderboard." });
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
    `\`/credits\` · \`/top\` · \`/daily\` · \`/help\`\n\n` +
    `**Rules**\n` +
    `• Beat the dealer without busting (21)\n` +
    `• Dealer hits soft 17\n` +
    `• Blackjack pays 3:2\n` +
    `• Win pays 1:1 · Push returns stake\n` +
    `• Daily bonus: **${DAILY_BONUS.toLocaleString()}** credits once per day\n` +
    `• Starting bankroll: ${STARTING_CREDITS.toLocaleString()} credits`;

  emitToGroup(
    io,
    socket,
    groupId,
    createGameMessage(
      content,
      { credits: credits.credits, userId },
      "game_help",
      userId
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

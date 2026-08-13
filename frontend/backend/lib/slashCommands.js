"use strict";

const supabase = require("../db/supabase");
const {
  Permissions,
  hasPermission,
  assertHierarchy,
} = require("./serverPermissions");
const { handleGameCommand, VALID_COMMANDS } = require("../socket/gameHandlers");

const APP_BOT = {
  id: "descall-apps",
  username: "Descall Apps",
  displayName: "Descall Apps",
  display_name: "Descall Apps",
  avatar_url: "/brand/descall-logo.png",
  avatarUrl: "/brand/descall-logo.png",
  isBot: true,
};

const EMBED_COLORS = {
  default: 0x5865f2,
  success: 0x57f287,
  danger: 0xed4245,
  warn: 0xfee75c,
  pink: 0xeb459e,
  blurple: 0x5865f2,
};

const MAX_NICKNAME_LENGTH = 32;
const MAX_TIMEOUT_SECONDS = 60 * 60 * 24 * 28;
const COMMAND_REGEX = /^\/([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i;
const USER_MENTION_REGEX = /^<@!?([0-9a-f-]{20,})>$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function option(name, description, { required = false } = {}) {
  return { name, description, required };
}

function defineCommand(def) {
  return Object.freeze({
    permission: null,
    chatOnly: true,
    voiceOnly: false,
    contexts: ["server", "group"],
    casino: false,
    options: [],
    ...def,
  });
}

const slashCommands = [
  defineCommand({
    name: "bj",
    description: "Start a blackjack hand.",
    options: [option("amount", "Credits to wager.", { required: true })],
    casino: true,
  }),
  defineCommand({ name: "blackjack", description: "Start a blackjack hand.", casino: true }),
  defineCommand({ name: "hit", description: "Take another blackjack card.", casino: true }),
  defineCommand({ name: "stand", description: "Stand in blackjack.", casino: true }),
  defineCommand({ name: "stay", description: "Stand in blackjack.", casino: true }),
  defineCommand({ name: "double", description: "Double your blackjack bet.", casino: true }),
  defineCommand({ name: "credits", description: "Check your casino credits.", casino: true }),
  defineCommand({ name: "balance", description: "Check your casino credits.", casino: true }),
  defineCommand({ name: "daily", description: "Claim your daily casino bonus.", casino: true }),
  defineCommand({ name: "top", description: "Show the casino leaderboard.", casino: true }),
  defineCommand({
    name: "help",
    description: "List commands available in this chat.",
    permission: "USE_APPLICATION_COMMANDS",
    handler: handleHelpCommand,
  }),
  defineCommand({
    name: "server",
    description: "Show server information.",
    contexts: ["server"],
    permission: "USE_APPLICATION_COMMANDS",
    handler: handleServerCommand,
  }),
  defineCommand({
    name: "user",
    description: "Show a member card.",
    options: [option("user", "@user, username, or id.")],
    permission: "USE_APPLICATION_COMMANDS",
    handler: handleUserCommand,
  }),
  defineCommand({
    name: "avatar",
    description: "Show a user's avatar.",
    options: [option("user", "@user, username, or id.")],
    permission: "USE_APPLICATION_COMMANDS",
    handler: handleAvatarCommand,
  }),
  defineCommand({
    name: "nick",
    description: "Change your server nickname.",
    contexts: ["server"],
    options: [option("name", "New nickname, or blank to clear.")],
    permission: "USE_APPLICATION_COMMANDS",
    handler: handleNickCommand,
  }),
  defineCommand({
    name: "poll",
    description: "Create a simple poll. Use: /poll question | option 1 | option 2",
    options: [option("question | options", "Poll question followed by pipe-separated options.", { required: true })],
    permission: "USE_APPLICATION_COMMANDS",
    handler: handlePollCommand,
  }),
  defineCommand({
    name: "timeout",
    description: "Timeout a member. Use: /timeout @user 5m reason",
    contexts: ["server"],
    options: [
      option("user", "Member mention, username, or id.", { required: true }),
      option("duration", "60s, 5m, 1h, 1d, 1w, or seconds.", { required: true }),
      option("reason", "Optional audit reason."),
    ],
    permission: "MODERATE_MEMBERS",
    handler: handleTimeoutCommand,
  }),
];

const registry = new Map(slashCommands.map((cmd) => [cmd.name, cmd]));

function parseSlashCommand(content) {
  const match = String(content || "").trim().match(COMMAND_REGEX);
  if (!match) return null;
  return {
    name: match[1].toLowerCase(),
    args: (match[2] || "").trim(),
    raw: String(content || "").trim(),
  };
}

function isCasinoCommand(name) {
  return VALID_COMMANDS.has(String(name || "").toLowerCase());
}

function commandCatalog({ context = "server" } = {}) {
  return slashCommands
    .filter((cmd) => cmd.contexts.includes(context))
    .map(({ name, description, options, permission, chatOnly, voiceOnly, casino }) => ({
      name,
      description,
      options,
      permission,
      chatOnly,
      voiceOnly,
      casino,
    }));
}

function makeEmbed({
  title = null,
  description = null,
  color = EMBED_COLORS.default,
  fields = [],
  thumbnail = null,
  image = null,
  footer = null,
  author = null,
} = {}) {
  return {
    type: "rich",
    title,
    description,
    color: Number(color) || EMBED_COLORS.default,
    fields: Array.isArray(fields) ? fields.filter(Boolean) : [],
    thumbnail: thumbnail ? { url: String(thumbnail.url || thumbnail) } : null,
    image: image ? { url: String(image.url || image) } : null,
    footer: footer
      ? { text: String(footer.text || footer), iconUrl: footer.iconUrl || footer.icon_url || null }
      : null,
    author: author
      ? {
          name: String(author.name || ""),
          iconUrl: author.iconUrl || author.icon_url || null,
          url: author.url || null,
        }
      : null,
  };
}

function field(name, value, inline = true) {
  return { name: String(name || ""), value, inline: Boolean(inline) };
}

function userFieldValue(user) {
  if (!user?.id) return "Unknown";
  return {
    kind: "user",
    id: user.id,
    username: user.username || null,
    displayName: user.display_name || user.displayName || user.username || null,
    avatarUrl: user.avatar_url || user.avatarUrl || null,
  };
}

function createSlashBotMessage(content, type = "app_command", embed = null) {
  const now = new Date().toISOString();
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender: { ...APP_BOT },
    sender_id: APP_BOT.id,
    content: content || "",
    type,
    embed: embed || null,
    isBot: true,
    isAppMessage: true,
    created_at: now,
    timestamp: now,
  };
}

function emitAppMessage({ io, socket, context, roomId, message }) {
  if (!message) return;
  if (context === "server") {
    socket.emit("server:channel:message", {
      serverId: message.server_id,
      channelId: roomId,
      message,
    });
    return;
  }
  io.to(`group:${roomId}`).emit("group:message", {
    groupId: roomId,
    message,
  });
}

async function executeSlashCommand(ctx) {
  const parsed = parseSlashCommand(ctx.content);
  if (!parsed) return { handled: false };
  const command = registry.get(parsed.name);
  if (!command && !isCasinoCommand(parsed.name)) return { handled: false };

  if (command?.casino || isCasinoCommand(parsed.name)) {
    const username = ctx.socket.user?.username || "Player";
    await handleGameCommand(ctx.io, ctx.socket, ctx.userId, username, ctx.roomId, parsed.raw, ctx.gameOptions || {});
    return { handled: true, suppress: true, isGameCommand: true };
  }

  if (!command.contexts.includes(ctx.context)) return { handled: false };
  await assertCommandPermission(ctx, command);
  const result = await command.handler({ ...ctx, parsed, command });
  return { handled: true, suppress: Boolean(result?.suppress), message: result?.message || null };
}

async function assertCommandPermission(ctx, command) {
  if (ctx.context !== "server") return;
  if (!hasPermission(ctx.permissions, Permissions.USE_APPLICATION_COMMANDS)) {
    const err = new Error("Missing permission: USE_APPLICATION_COMMANDS.");
    err.status = 403;
    err.code = "MISSING_PERMISSION";
    err.permission = "USE_APPLICATION_COMMANDS";
    throw err;
  }
  if (command.permission && command.permission !== "USE_APPLICATION_COMMANDS" && !hasPermission(ctx.permissions, Permissions[command.permission] || command.permission)) {
    const err = new Error(`Missing permission: ${command.permission}.`);
    err.status = 403;
    err.code = "MISSING_PERMISSION";
    err.permission = command.permission;
    throw err;
  }
}

async function handleHelpCommand(ctx) {
  const commands = commandCatalog({ context: ctx.context })
    .filter((cmd) => cmd.casino || !cmd.permission || ctx.context !== "server" || hasPermission(ctx.permissions, Permissions[cmd.permission]))
    .map((cmd) => {
      const opts = (cmd.options || []).map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(" ");
      return {
        name: `/${cmd.name}${opts ? ` ${opts}` : ""}`,
        value: cmd.description,
        inline: false,
      };
    });

  return {
    message: createContextMessage(ctx, {
      content: "Slash commands",
      type: "app_help",
      embed: makeEmbed({
        title: "Slash commands",
        description: "Commands you can use in this chat.",
        color: EMBED_COLORS.blurple,
        fields: commands.slice(0, 20),
        footer: { text: "Tip: start typing / to open the command picker" },
      }),
    }),
  };
}

async function handleServerCommand(ctx) {
  const [{ data: server }, { count: channelCount }, { count: memberCount }] = await Promise.all([
    supabase
      .from("servers")
      .select("id, name, owner_id, created_at, icon_url, description, banner_url")
      .eq("id", ctx.serverId)
      .maybeSingle(),
    supabase.from("server_channels").select("id", { count: "exact", head: true }).eq("server_id", ctx.serverId),
    supabase.from("server_members").select("user_id", { count: "exact", head: true }).eq("server_id", ctx.serverId),
  ]);
  if (!server) {
    return {
      message: createContextMessage(ctx, {
        content: "Server not found.",
        type: "app_error",
        embed: makeEmbed({
          title: "Server not found",
          color: EMBED_COLORS.danger,
          description: "This server could not be loaded.",
        }),
      }),
    };
  }
  const owner = server.owner_id ? await loadUserWithMembership(ctx.serverId, server.owner_id) : null;
  const created = server.created_at ? new Date(server.created_at).toLocaleDateString("en-US") : "Unknown";
  const name = server.name || "Server";
  return {
    message: createContextMessage(ctx, {
      content: name,
      type: "app_server",
      embed: makeEmbed({
        title: name,
        description: server.description || null,
        color: EMBED_COLORS.blurple,
        thumbnail: server.icon_url ? { url: server.icon_url } : null,
        fields: [
          field("Owner", userFieldValue(owner), true),
          field("Members", String(memberCount ?? "?"), true),
          field("Channels", String(channelCount ?? "?"), true),
          field("Created", created, true),
        ],
        footer: { text: "Server info" },
      }),
    }),
  };
}

async function handleUserCommand(ctx) {
  const user = await resolveUserArg(ctx, ctx.parsed.args);
  if (!user) {
    return {
      message: createContextMessage(ctx, {
        content: "User not found.",
        type: "app_error",
        embed: makeEmbed({
          title: "User not found",
          color: EMBED_COLORS.danger,
          description: "No member matched that lookup.",
        }),
      }),
    };
  }
  const display = user.display_name || user.username || "User";
  const joined = user.member?.joined_at ? new Date(user.member.joined_at).toLocaleDateString("en-US") : null;
  const fields = [
    field("Username", `@${user.username || "unknown"}`, true),
  ];
  if (user.member?.nickname) fields.push(field("Nickname", user.member.nickname, true));
  if (joined) fields.push(field("Joined", joined, true));
  if (user.member?.timeout_until && new Date(user.member.timeout_until) > new Date()) {
    fields.push(field("Timeout until", new Date(user.member.timeout_until).toLocaleString("en-US"), false));
  }
  return {
    message: createContextMessage(ctx, {
      content: display,
      type: "app_user",
      embed: makeEmbed({
        author: {
          name: display,
          iconUrl: user.avatar_url || null,
        },
        color: EMBED_COLORS.success,
        thumbnail: user.avatar_url ? { url: user.avatar_url } : null,
        fields,
        footer: { text: "Member card" },
      }),
    }),
  };
}

async function handleAvatarCommand(ctx) {
  const user = await resolveUserArg(ctx, ctx.parsed.args);
  if (!user) {
    return {
      message: createContextMessage(ctx, {
        content: "User not found.",
        type: "app_error",
        embed: makeEmbed({
          title: "User not found",
          color: EMBED_COLORS.danger,
          description: "No member matched that lookup.",
        }),
      }),
    };
  }
  const display = user.display_name || user.username || "User";
  if (!user.avatar_url) {
    return {
      message: createContextMessage(ctx, {
        content: `${display}'s avatar`,
        type: "app_avatar",
        embed: makeEmbed({
          title: `${display}'s avatar`,
          description: "No avatar set.",
          color: EMBED_COLORS.pink,
          footer: { text: "Avatar" },
        }),
      }),
    };
  }
  return {
    message: createContextMessage(ctx, {
      content: `${display}'s avatar`,
      type: "app_avatar",
      embed: makeEmbed({
        title: `${display}'s avatar`,
        color: EMBED_COLORS.pink,
        image: { url: user.avatar_url },
        thumbnail: { url: user.avatar_url },
        footer: { text: `@${user.username || "unknown"}` },
      }),
    }),
  };
}

async function handleNickCommand(ctx) {
  const nickname = String(ctx.parsed.args || "").trim().slice(0, MAX_NICKNAME_LENGTH) || null;
  if (nickname && nickname.length < 1) {
    return {
      message: createContextMessage(ctx, {
        content: "Nickname must be 1-32 characters.",
        type: "app_error",
        embed: makeEmbed({
          title: "Invalid nickname",
          description: "Nickname must be 1-32 characters.",
          color: EMBED_COLORS.danger,
        }),
      }),
    };
  }
  if (!hasPermission(ctx.permissions, Permissions.CHANGE_NICKNAME)) {
    const err = new Error("You need Change Nickname to edit your nickname.");
    err.status = 403;
    err.code = "MISSING_PERMISSION";
    err.permission = "CHANGE_NICKNAME";
    throw err;
  }
  await updateMemberNickname({
    serverId: ctx.serverId,
    actorId: ctx.userId,
    targetUserId: ctx.userId,
    nickname,
  });
  return {
    message: createContextMessage(ctx, {
      content: nickname ? `Nickname updated to ${nickname}.` : "Nickname cleared.",
      type: "app_nick",
      embed: makeEmbed({
        title: nickname ? "Nickname updated" : "Nickname cleared",
        description: nickname ? `Your nickname is now **${nickname}**.` : "Your server nickname was cleared.",
        color: EMBED_COLORS.blurple,
      }),
    }),
  };
}

async function handlePollCommand(ctx) {
  const parts = ctx.parsed.args.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) {
    return {
      message: createContextMessage(ctx, {
        content: "Usage: /poll question | option 1 | option 2",
        type: "app_error",
        embed: makeEmbed({
          title: "Poll usage",
          description: "Use: `/poll question | option 1 | option 2`",
          color: EMBED_COLORS.warn,
        }),
      }),
    };
  }
  const [question, ...rawOptions] = parts;
  const options = rawOptions.slice(0, 10);
  const content = [
    `**Poll: ${escapeMd(question.slice(0, 180))}**`,
    ...options.map((opt, index) => `${index + 1}. ${escapeMd(opt.slice(0, 80))}`),
  ].join("\n");
  const message = await persistPollMessage(ctx, content);
  return { message };
}

async function handleTimeoutCommand(ctx) {
  const [targetRaw, durationRaw, ...reasonParts] = ctx.parsed.args.split(/\s+/).filter(Boolean);
  if (!targetRaw || !durationRaw) {
    return {
      message: createContextMessage(ctx, {
        content: "Usage: /timeout @user 5m reason",
        type: "app_error",
        embed: makeEmbed({
          title: "Timeout usage",
          description: "Use: `/timeout @user 5m reason`",
          color: EMBED_COLORS.warn,
        }),
      }),
    };
  }
  const target = await resolveUserArg(ctx, targetRaw);
  if (!target?.id) {
    return {
      message: createContextMessage(ctx, {
        content: "Member not found.",
        type: "app_error",
        embed: makeEmbed({
          title: "Member not found",
          color: EMBED_COLORS.danger,
          description: "No member matched that lookup.",
        }),
      }),
    };
  }
  const durationSeconds = parseDurationSeconds(durationRaw);
  if (!durationSeconds) {
    return {
      message: createContextMessage(ctx, {
        content: "Invalid duration.",
        type: "app_error",
        embed: makeEmbed({
          title: "Invalid duration",
          description: "Duration must look like `60s`, `5m`, `1h`, `1d`, or `1w`.",
          color: EMBED_COLORS.danger,
        }),
      }),
    };
  }
  const reason = reasonParts.join(" ").trim().slice(0, 512) || null;
  const timeout = await applyServerTimeout({
    serverId: ctx.serverId,
    actorId: ctx.userId,
    targetUserId: target.id,
    durationSeconds,
    reason,
  });
  const display = target.display_name || target.username || "member";
  return {
    message: createContextMessage(ctx, {
      content: `Timed out ${display}`,
      type: "app_timeout",
      embed: makeEmbed({
        title: "Member timed out",
        color: EMBED_COLORS.danger,
        thumbnail: target.avatar_url ? { url: target.avatar_url } : null,
        fields: [
          field("Member", userFieldValue(target), true),
          field("Until", new Date(timeout.until).toLocaleString("en-US"), true),
          reason ? field("Reason", reason, false) : null,
        ],
      }),
    }),
  };
}

async function persistPollMessage(ctx, content) {
  if (ctx.context === "server") {
    const { data: row, error } = await supabase
      .from("server_messages")
      .insert({
        server_id: ctx.serverId,
        channel_id: ctx.roomId,
        sender_id: ctx.userId,
        content,
        media_type: "poll",
      })
      .select("id, created_at")
      .single();
    if (error) throw error;
    return {
      id: row.id,
      server_id: ctx.serverId,
      channel_id: ctx.roomId,
      sender_id: ctx.userId,
      content,
      media_type: "poll",
      created_at: row.created_at,
      sender: ctx.sender,
    };
  }

  const { data: row, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: ctx.roomId,
      sender_id: ctx.userId,
      content,
      media_type: "poll",
      message_type: "text",
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return {
    id: row.id,
    group_id: ctx.roomId,
    sender_id: ctx.userId,
    content,
    media_type: "poll",
    created_at: row.created_at,
    sender: ctx.sender,
  };
}

function createContextMessage(ctx, contentOrOpts, maybeType) {
  const opts =
    contentOrOpts && typeof contentOrOpts === "object"
      ? contentOrOpts
      : { content: contentOrOpts, type: maybeType || "app_command", embed: null };
  const type = opts.type || "app_command";
  const message = createSlashBotMessage(opts.content || "", type, opts.embed || null);
  if (ctx.context === "server") {
    return {
      ...message,
      server_id: ctx.serverId,
      channel_id: ctx.roomId,
      sender_id: APP_BOT.id,
      sender: { ...APP_BOT },
    };
  }
  return {
    ...message,
    group_id: ctx.roomId,
    sender_id: APP_BOT.id,
    sender: { ...APP_BOT },
  };
}

async function resolveUserArg(ctx, rawArg) {
  const raw = String(rawArg || "").trim();
  const token = raw.split(/\s+/)[0] || "";
  const id = token.match(USER_MENTION_REGEX)?.[1] || (UUID_REGEX.test(token) ? token : null);

  if (id) {
    return loadUserWithMembership(ctx.serverId, id);
  }

  const username = token.replace(/^@/, "").trim();
  if (!username) return loadUserWithMembership(ctx.serverId, ctx.userId);

  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .ilike("username", username)
    .limit(1);
  if (error) throw error;
  if (!users?.[0]?.id) return null;
  return loadUserWithMembership(ctx.serverId, users[0].id);
}

async function loadUserWithMembership(serverId, userId) {
  const [{ data: user, error: uErr }, { data: member, error: mErr }] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    serverId
      ? supabase
          .from("server_members")
          .select("user_id, nickname, joined_at, timeout_until")
          .eq("server_id", serverId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (uErr) throw uErr;
  if (mErr) throw mErr;
  if (!user) return null;
  return { ...user, member: member || null };
}

async function updateMemberNickname({ serverId, actorId, targetUserId, nickname }) {
  const targetIsActor = String(actorId) === String(targetUserId);
  if (!targetIsActor) {
    await assertHierarchy(supabase, serverId, actorId, targetUserId);
  }

  const { data: member, error } = await supabase
    .from("server_members")
    .update({ nickname })
    .eq("server_id", serverId)
    .eq("user_id", targetUserId)
    .select("server_id, user_id, nickname")
    .single();
  if (error) throw error;
  return member;
}

async function applyServerTimeout({ serverId, actorId, targetUserId, until, durationSeconds, reason }) {
  await assertHierarchy(supabase, serverId, actorId, targetUserId);
  const untilDate = until ? new Date(until) : new Date(Date.now() + clampTimeoutSeconds(durationSeconds) * 1000);
  if (!Number.isFinite(untilDate.getTime()) || untilDate <= new Date()) {
    const err = new Error("Timeout expiry must be in the future.");
    err.status = 400;
    err.code = "INVALID_TIMEOUT";
    throw err;
  }

  const cappedUntil = new Date(Math.min(untilDate.getTime(), Date.now() + MAX_TIMEOUT_SECONDS * 1000));
  const { data, error } = await supabase
    .from("server_members")
    .update({
      timeout_until: cappedUntil.toISOString(),
      timeout_reason: reason || null,
      timed_out_by: actorId,
    })
    .eq("server_id", serverId)
    .eq("user_id", targetUserId)
    .select("server_id, user_id, timeout_until, timeout_reason, timed_out_by")
    .single();
  if (error) throw error;
  return {
    member: data,
    until: data.timeout_until,
    reason: data.timeout_reason,
    timedOutBy: data.timed_out_by,
  };
}

async function clearServerTimeout({ serverId, actorId, targetUserId }) {
  await assertHierarchy(supabase, serverId, actorId, targetUserId);
  const { data, error } = await supabase
    .from("server_members")
    .update({ timeout_until: null, timeout_reason: null, timed_out_by: null })
    .eq("server_id", serverId)
    .eq("user_id", targetUserId)
    .select("server_id, user_id, timeout_until")
    .single();
  if (error) throw error;
  return data;
}

function parseDurationSeconds(raw) {
  const text = String(raw || "").trim().toLowerCase();
  const match = text.match(/^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2] || "s";
  const mult =
    unit.startsWith("w") ? 604800 :
    unit.startsWith("d") ? 86400 :
    unit.startsWith("h") ? 3600 :
    unit.startsWith("m") ? 60 :
    1;
  return clampTimeoutSeconds(n * mult);
}

function clampTimeoutSeconds(value) {
  const n = Math.floor(Number(value) || 0);
  return Math.max(1, Math.min(MAX_TIMEOUT_SECONDS, n));
}

function escapeMd(value) {
  return String(value || "").replace(/([\\*_`~])/g, "\\$1");
}

module.exports = {
  slashCommands,
  commandCatalog,
  parseSlashCommand,
  executeSlashCommand,
  emitAppMessage,
  isCasinoCommand,
  applyServerTimeout,
  clearServerTimeout,
  updateMemberNickname,
  parseDurationSeconds,
};

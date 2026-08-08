"use strict";

const supabase = require("../db/supabase");
const {
  loadUserProfile,
  savePresenceStatus,
  cacheUserProfile,
  broadcastUserProfileUpdate,
  enrichFriendEntry,
  toPublicUser,
  getCachedPublicUser,
  publicPresenceStatus,
} = require("../lib/userProfile");
const {
  presence,
  socketToUser,
  friends,
  pendingRequests,
  lastSeenByUserId,
  usernameById,
  dmUnreadByUser,
  notificationsByUser,
  dmHistory,
  MAX_DM_PER_CONV,
  MAX_NOTIFICATIONS,
  systemConfig,
  profanityWords,
  bannedUserIds,
  userRoles,
  rateLimitDm,
  userSessionStartMs,
  userOnlineAccumMs,
  dmBlockPairs,
  appendAudit,
  appendErrorLog,
} = require("../runtime/sharedState");
const { setupAdminSocket, notifyAdminRoom } = require("./adminHandlers");
const { registerGroupHandlers, removeUserFromAllGroupCalls } = require("./groupHandlers");
const { trackOffer, markAnswered, finalizeCall } = require("../lib/dmCallLog");

async function notifyCallHistory(io, record) {
  if (!record) return;
  const payload = { call: record };
  emitToUser(io, record.callerId, "calls:updated", payload);
  emitToUser(io, record.calleeId, "calls:updated", payload);
}

function ensureSet(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

function ensurePending(userId) {
  if (!pendingRequests.has(userId)) pendingRequests.set(userId, new Map());
  return pendingRequests.get(userId);
}

function ensureDmUnreadMap(userId) {
  if (!dmUnreadByUser.has(userId)) dmUnreadByUser.set(userId, new Map());
  return dmUnreadByUser.get(userId);
}

function convKey(a, b) {
  return [a, b].sort().join("::");
}

/** Last-message preview text for DM list rows. */
function formatDmPreview(msg) {
  if (!msg) return null;
  const raw = String(msg.text || "").trim();
  if (raw && !raw.startsWith("__voice__:")) return raw;
  if (msg.mediaType === "image") return "📷 Photo";
  if (msg.mediaType === "voice" || msg.mediaType === "audio" || raw.startsWith("__voice__:")) {
    return "🎤 Voice message";
  }
  if (msg.mediaUrl) return "📎 Attachment";
  return null;
}

function getLastDmMessage(myId, peerId) {
  const arr = dmHistory.get(convKey(myId, peerId));
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[arr.length - 1];
}

function cacheDmMessages(key, messages) {
  const cached = dmHistory.get(key) || [];
  const byId = new Map(cached.map((message) => [message.id, message]));
  for (const message of messages) byId.set(message.id, message);
  const merged = Array.from(byId.values())
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-MAX_DM_PER_CONV);
  dmHistory.set(key, merged);
  return merged;
}

function mapDmRow(row, usersById) {
  const profile = usersById.get(row.from_user_id);
  if (profile) cacheUserProfile(profile);
  return {
    id: row.id,
    from: messageSender(row.from_user_id, profile?.username || usernameById.get(row.from_user_id)),
    to: { id: row.to_user_id },
    text: row.content || "",
    mediaUrl: row.media_url || null,
    mediaType: row.media_type || null,
    mimeType: row.mime_type || null,
    size: row.file_size ?? null,
    originalName: row.original_name || null,
    duration: row.duration ?? null,
    replyTo: row.reply_to || null,
    timestamp: row.created_at,
    deliveredAt: row.delivered_at || null,
    readAt: row.read_at || null,
    editedAt: row.edited_at || null,
    editHistory: row.edit_history || [],
  };
}

async function loadDmMessages(myId, peerId, { before, limit = 100 } = {}) {
  const pageSize = Math.min(Math.max(Number(limit) || 100, 1), 100);
  let query = supabase
    .from("dm_messages")
    .select("id, from_user_id, to_user_id, content, media_url, media_type, mime_type, file_size, original_name, duration, reply_to, delivered_at, read_at, edited_at, edit_history, created_at")
    .or(`and(from_user_id.eq.${myId},to_user_id.eq.${peerId}),and(from_user_id.eq.${peerId},to_user_id.eq.${myId})`)
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);
  if (before) query = query.lt("created_at", before);

  const { data: rows, error } = await query;
  if (error) throw error;

  const hasMore = (rows || []).length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : (rows || []);
  const userIds = [...new Set(page.map((row) => row.from_user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, updated_at, is_admin")
      .in("id", userIds)
    : { data: [], error: null };
  if (profileError) console.warn("[DM] Sender profile lookup failed:", profileError.message);

  const usersById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const messages = page.reverse().map((row) => mapDmRow(row, usersById));
  cacheDmMessages(convKey(myId, peerId), messages);
  return { messages, hasMore };
}

/** Build preview + activity maps for every DM thread involving this user. */
function buildDmPreviewMaps(userId) {
  const dmPreviewsByPeer = {};
  const dmLastActivityByPeer = {};
  for (const [key, arr] of dmHistory) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const parts = String(key).split("::");
    if (parts.length !== 2 || !parts.includes(userId)) continue;
    const peerId = parts[0] === userId ? parts[1] : parts[0];
    const last = arr[arr.length - 1];
    const preview = formatDmPreview(last);
    if (preview) dmPreviewsByPeer[peerId] = preview;
    const ts = last?.timestamp || last?.created_at || null;
    if (ts) dmLastActivityByPeer[peerId] = ts;
  }
  return { dmPreviewsByPeer, dmLastActivityByPeer };
}

/** Attach persisted emoji reactions onto an in-memory message list. */
async function attachReactions(messages, conversationType, conversationId) {
  if (!Array.isArray(messages) || messages.length === 0 || !conversationType || !conversationId) {
    return messages || [];
  }
  const ids = messages.map((m) => m?.id).filter(Boolean);
  if (ids.length === 0) return messages;
  try {
    const { data, error } = await supabase
      .from("reactions")
      .select("message_id, emoji, user_id")
      .eq("conversation_type", conversationType)
      .eq("conversation_id", conversationId)
      .in("message_id", ids);
    if (error) {
      console.warn("[reactions] attach failed (run reactionsMigration.sql?):", error.message);
      return messages;
    }
    const byMsg = new Map();
    for (const r of data || []) {
      if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, []);
      byMsg.get(r.message_id).push({
        emoji: r.emoji,
        userId: r.user_id,
        messageId: r.message_id,
      });
    }
    return messages.map((m) => ({
      ...m,
      reactions: byMsg.get(m.id) || m.reactions || [],
    }));
  } catch (err) {
    console.warn("[reactions] attach error:", err.message);
    return messages;
  }
}

function getNotifications(userId) {
  return notificationsByUser.get(userId) || [];
}

function pushNotification(io, userId, n) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry = {
    id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: false,
    createdAt: new Date().toISOString(),
    meta: n.meta || {},
  };
  const list = notificationsByUser.get(userId) || [];
  list.unshift(entry);
  if (list.length > MAX_NOTIFICATIONS) list.length = MAX_NOTIFICATIONS;
  notificationsByUser.set(userId, list);
  emitToUser(io, userId, "notification:new", { notification: entry });
}

function broadcastUsers(io) {
  const list = [];
  for (const [id, p] of presence) {
    // Invisible users must not appear in the online roster at all —
    // remapping status to "offline" still leaked them via membership checks.
    if (p.status === "invisible") continue;
    const cached = getCachedPublicUser(id);
    const username = cached?.username || p.username;
    const isAdmin = Boolean(cached?.is_admin || cached?.isAdmin) || username === "admin";
    list.push({
      id,
      username,
      displayName: cached?.displayName || null,
      display_name: cached?.displayName || null,
      status: publicPresenceStatus(p.status),
      avatarUrl: cached?.avatarUrl || p.avatar_url || null,
      avatar_url: cached?.avatarUrl || p.avatar_url || null,
      avatarVersion: cached?.avatarVersion || cached?.updated_at || null,
      updated_at: cached?.updated_at || null,
      is_admin: isAdmin,
      isAdmin,
    });
  }
  io.emit("users:update", list);
}

function messageSender(userId, fallbackUsername, fallbackAvatar) {
  const cached = getCachedPublicUser(userId);
  if (cached) {
    const isAdmin = Boolean(cached.is_admin || cached.isAdmin) || cached.username === "admin";
    return {
      id: userId,
      username: cached.username,
      displayName: cached.displayName || null,
      display_name: cached.displayName || null,
      avatarUrl: cached.avatarUrl,
      avatar_url: cached.avatarUrl,
      avatarVersion: cached.avatarVersion,
      updated_at: cached.updated_at,
      is_admin: isAdmin,
      isAdmin,
    };
  }
  const isAdmin = fallbackUsername === "admin";
  return {
    id: userId,
    username: fallbackUsername,
    displayName: null,
    display_name: null,
    avatarUrl: fallbackAvatar || null,
    avatar_url: fallbackAvatar || null,
    is_admin: isAdmin,
    isAdmin,
  };
}

function getSocketForUser(io, userId) {
  const p = presence.get(userId);
  if (!p?.socketId) return null;
  return io.sockets.sockets.get(p.socketId);
}

function getFriendList(userId) {
  const set = friends.get(userId);
  if (!set) return [];
  const out = [];
  for (const fid of set) {
    const last = getLastDmMessage(userId, fid);
    out.push({
      ...enrichFriendEntry(fid),
      lastMessage: formatDmPreview(last),
      lastActivity: last?.timestamp || last?.created_at || null,
    });
  }
  return out.sort((a, b) => a.username.localeCompare(b.username));
}

function getPendingList(userId) {
  const m = pendingRequests.get(userId);
  if (!m) return [];
  return Array.from(m.keys()).map((id) => enrichFriendEntry(id));
}

function emitToUser(io, userId, event, payload) {
  if (!userId) return;
  // Prefer durable per-user room so call invites survive presence-map races
  // and multi-tab sessions (socket always joins `user:${id}` on connect).
  const room = `user:${userId}`;
  const roomSet = io.sockets?.adapter?.rooms?.get(room);
  if (roomSet && roomSet.size > 0) {
    io.to(room).emit(event, payload);
    return;
  }
  const p = presence.get(userId);
  if (p?.socketId) {
    io.to(p.socketId).emit(event, payload);
  }
}

function buildSyncState(userId) {
  const dmMap = ensureDmUnreadMap(userId);
  const dmUnreadByPeer = {};
  for (const [k, v] of dmMap) {
    dmUnreadByPeer[k] = v;
  }
  const { dmPreviewsByPeer, dmLastActivityByPeer } = buildDmPreviewMaps(userId);
  return {
    dmUnreadByPeer,
    dmPreviewsByPeer,
    dmLastActivityByPeer,
    notifications: getNotifications(userId),
  };
}

async function findUserByUsername(username) {
  const clean = String(username || "").trim();
  if (!clean) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .ilike("username", clean)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Load friends from database into memory
async function loadFriendsFromDB(userId) {
  try {
    // Fetch all accepted friendship rows involving this user
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (error) {
      console.error("[FRIENDS] loadFriendsFromDB query error:", error);
      return new Set();
    }

    // Collect the IDs of the OTHER party in each row
    const friendIds = [];
    for (const row of (rows || [])) {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      if (otherId && otherId !== userId) friendIds.push(otherId);
    }

    if (friendIds.length === 0) {
      friends.set(userId, new Set());
      console.log(`[FRIENDS] No friends found for user ${userId}`);
      return new Set();
    }

    // Batch-fetch profile fields for friend rows / hover cards
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at")
      .in("id", friendIds);

    if (usersError) console.error("[FRIENDS] loadFriendsFromDB users fetch error:", usersError);

    const friendSet = new Set();
    for (const u of (users || [])) {
      friendSet.add(u.id);
      usernameById.set(u.id, u.username);
      cacheUserProfile(u);
    }

    friends.set(userId, friendSet);
    console.log(`[FRIENDS] Loaded ${friendSet.size} friends for user ${userId}`);
    return friendSet;
  } catch (e) {
    console.error("[FRIENDS] Error in loadFriendsFromDB:", e);
    return new Set();
  }
}

async function isAcceptedFriend(userId, otherUserId) {
  let friendSet = friends.get(userId);
  // A socket can receive dm:history before its asynchronous boot-time friend
  // load completes. Hydrate from the durable source instead of treating the
  // temporary cache miss as a denial.
  if (!friendSet) friendSet = await loadFriendsFromDB(userId);
  return Boolean(friendSet?.has(otherUserId));
}

// Load pending friend requests from DB into memory
async function loadPendingRequestsFromDB(userId) {
  try {
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("user_id")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("[FRIENDS] loadPendingRequestsFromDB error:", error);
      return;
    }

    if (!rows || rows.length === 0) return;

    const senderIds = rows.map((r) => r.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, updated_at")
      .in("id", senderIds);

    if (usersError) {
      console.error("[FRIENDS] loadPendingRequestsFromDB users error:", usersError);
      return;
    }

    const pending = ensurePending(userId);
    for (const u of (users || [])) {
      if (!pending.has(u.id)) {
        pending.set(u.id, {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatar_url || null,
        });
        usernameById.set(u.id, u.username);
        cacheUserProfile(u);
      }
    }
  } catch (e) {
    console.error("[FRIENDS] Error in loadPendingRequestsFromDB:", e);
  }
}

// Accept the pending friend request in the 'friendships' table (one row, requester → acceptor)
async function saveFriendshipToDB(requesterId, acceptorId) {
  try {
    const { data, error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_id", requesterId)
      .eq("friend_id", acceptorId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error("[FRIENDS] Error accepting friendship in DB:", error);
      return false;
    }
    if (Array.isArray(data) && data.length > 0) return true;

    // No pending row (e.g. socket-only legacy request) — upsert accepted friendship.
    const { error: upsertError } = await supabase.from("friendships").upsert(
      {
        user_id: requesterId,
        friend_id: acceptorId,
        status: "accepted",
      },
      { onConflict: "user_id,friend_id" }
    );
    if (upsertError) {
      console.error("[FRIENDS] Error upserting accepted friendship:", upsertError);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[FRIENDS] Error in saveFriendshipToDB:", e);
    return false;
  }
}

/** Persist a pending friend request (requester → target). */
async function createPendingFriendshipInDB(requesterId, targetId) {
  try {
    // Clear any stale non-accepted rows either direction, then insert pending.
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${requesterId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${requesterId})`
      )
      .neq("status", "accepted");

    const { data: existingAccepted } = await supabase
      .from("friendships")
      .select("id")
      .or(
        `and(user_id.eq.${requesterId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${requesterId})`
      )
      .eq("status", "accepted")
      .limit(1);

    if (existingAccepted?.length) return { ok: false, reason: "already_friends" };

    const { error } = await supabase.from("friendships").insert({
      user_id: requesterId,
      friend_id: targetId,
      status: "pending",
    });

    if (error) {
      // Unique conflict — treat as already pending
      if (String(error.code) === "23505" || /duplicate|unique/i.test(error.message || "")) {
        return { ok: false, reason: "already_pending" };
      }
      console.error("[FRIENDS] Error creating pending friendship:", error);
      return { ok: false, reason: "db_error", error };
    }
    return { ok: true };
  } catch (e) {
    console.error("[FRIENDS] Error in createPendingFriendshipInDB:", e);
    return { ok: false, reason: "db_error", error: e };
  }
}

// Remove friendship from the 'friends' table (both directions)
async function removeFriendshipFromDB(userId, friendId) {
  try {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

    if (error) console.error("[FRIENDS] Error removing friendship from DB:", error);
    return !error;
  } catch (e) {
    console.error("[FRIENDS] Error in removeFriendshipFromDB:", e);
    return false;
  }
}

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    const me = socket.user;
    const myId = me.id;

    if (systemConfig.maintenanceMode && me.username !== "admin") {
      socket.emit("system:maintenance", { message: "Server is in maintenance mode." });
      socket.disconnect(true);
      return;
    }

    if (!userRoles.has(myId)) {
      userRoles.set(myId, me.username === "admin" || me.is_admin ? "admin" : "user");
    }
    userSessionStartMs.set(myId, Date.now());

    usernameById.set(myId, me.username);

    const existingPresence = presence.get(myId);
    presence.set(myId, {
      username: me.username,
      status: existingPresence?.status || "online",
      socketId: socket.id,
      avatar_url: existingPresence?.avatar_url || me.avatar_url || null,
    });
    socket.join(`user:${myId}`);
    socketToUser.set(socket.id, myId);
    socket.data.activeDmPeer = null;

    setupAdminSocket(io, socket);

    // Load friends + full profile, then emit connected with displayName etc.
    Promise.all([
      loadFriendsFromDB(myId),
      loadPendingRequestsFromDB(myId),
      loadUserProfile(myId),
    ]).then(([, , profile]) => {
      if (profile) {
        me.avatar_url = profile.avatar_url;
        me.display_name = profile.display_name;
        me.displayName = profile.display_name;
        me.bio = profile.bio;
        me.custom_status = profile.custom_status;
        me.banner_url = profile.banner_url;
        me.updated_at = profile.updated_at;
        me.is_admin = Boolean(profile.is_admin);
        socket.user.avatar_url = profile.avatar_url;
        socket.user.display_name = profile.display_name;
        socket.user.displayName = profile.display_name;
        socket.user.is_admin = Boolean(profile.is_admin);
        if (profile.is_admin || me.username === "admin") {
          userRoles.set(myId, "admin");
        }
        const p = presence.get(myId);
        if (p) {
          p.avatar_url = profile.avatar_url;
          if (!existingPresence) {
            const allowed = ["online", "idle", "dnd", "invisible"];
            const restored = allowed.includes(profile.presence_status)
              ? profile.presence_status
              : "online";
            p.status = restored;
          }
          presence.set(myId, p);
        }
      }

      socket.emit("connected", {
        user: profile ? toPublicUser(profile) : me,
        message: "Socket connected successfully.",
      });
      socket.emit("status:current", { status: presence.get(myId)?.status || "online" });
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      broadcastUsers(io);
    });

    socket.on("status:set", async ({ status } = {}) => {
      const allowed = ["online", "idle", "dnd", "invisible"];
      const s = allowed.includes(status) ? status : "online";
      const p = presence.get(myId);
      if (p) {
        p.status = s;
        presence.set(myId, p);
      }
      await savePresenceStatus(myId, s);
      socket.emit("status:current", { status: s });
      broadcastUsers(io);
      io.to(socket.id).emit("friend:list", getFriendList(myId));
    });

    socket.on("friend:list", async () => {
      // Reload from DB only if memory is empty (handles edge cases)
      if (!friends.has(myId)) await loadFriendsFromDB(myId);
      if (!pendingRequests.has(myId)) await loadPendingRequestsFromDB(myId);
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
    });

    socket.on("friend:request", async ({ toUsername } = {}) => {
      try {
        const target = await findUserByUsername(toUsername);
        if (!target) {
          appendErrorLog("friend:request", "User not found", { toUsername }, myId, me.username);
          return socket.emit("friend:error", { message: "User not found." });
        }
        if (target.id === myId) {
          appendErrorLog("friend:request", "Cannot add self", {}, myId, me.username);
          return socket.emit("friend:error", { message: "You cannot add yourself." });
        }
        const myFriends = ensureSet(friends, myId);
        if (myFriends.has(target.id) || ensureSet(friends, target.id).has(myId)) {
          appendErrorLog("friend:request", "Already friends", { targetId: target.id, targetUsername: target.username }, myId, me.username);
          return socket.emit("friend:error", { message: "Already friends." });
        }

        // DB is source of truth — also catches REST-sent / cross-instance pending rows
        const { data: existingRows } = await supabase
          .from("friendships")
          .select("id, status, user_id, friend_id")
          .or(
            `and(user_id.eq.${myId},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${myId})`
          );

        if (existingRows?.some((r) => r.status === "accepted")) {
          ensureSet(friends, myId).add(target.id);
          ensureSet(friends, target.id).add(myId);
          return socket.emit("friend:error", { message: "Already friends." });
        }
        if (existingRows?.some((r) => r.status === "pending")) {
          return socket.emit("friend:error", { message: "Request already pending." });
        }

        const theirPending = ensurePending(target.id);
        if (theirPending.has(myId)) {
          appendErrorLog("friend:request", "Request already pending", { targetId: target.id }, myId, me.username);
          return socket.emit("friend:error", { message: "Request already pending." });
        }

        const created = await createPendingFriendshipInDB(myId, target.id);
        if (!created.ok) {
          if (created.reason === "already_friends") {
            return socket.emit("friend:error", { message: "Already friends." });
          }
          if (created.reason === "already_pending") {
            return socket.emit("friend:error", { message: "Request already pending." });
          }
          return socket.emit("friend:error", { message: "Could not send request." });
        }

        theirPending.set(myId, { id: myId, username: me.username, avatarUrl: me.avatar_url || null });
        usernameById.set(myId, me.username);
        emitToUser(io, target.id, "friend:request:incoming", {
          from: enrichFriendEntry(myId),
        });
        // Keep recipient's pending list in sync even if they missed the incoming event
        emitToUser(io, target.id, "friend:requests", getPendingList(target.id));
        pushNotification(io, target.id, {
          type: "friend_request",
          title: "Friend request",
          body: `${me.username} sent you a friend request`,
          meta: { fromUserId: myId },
        });
        socket.emit("friend:request:sent", { to: target.username });
      } catch (e) {
        console.error("[Friends] request error:", e);
        socket.emit("friend:error", { message: "Could not send request." });
      }
    });

    socket.on("friend:accept", async (payload = {}) => {
      const fromUserId = String(payload?.fromUserId || payload?.userId || "").trim();
      if (!fromUserId) {
        socket.emit("friend:error", { message: "Invalid user ID" });
        return;
      }

      // Verify pending request exists in DB (handles REST-sent requests not in memory)
      const { data: pendingRow, error: checkError } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", fromUserId)
        .eq("friend_id", myId)
        .eq("status", "pending")
        .maybeSingle();

      if (checkError) {
        console.error("[Friends] Accept check error:", checkError);
        socket.emit("friend:error", { message: "Database error checking request" });
        return;
      }

      const theirPending = pendingRequests.get(myId);
      const inMemory = Boolean(theirPending?.has(fromUserId));

      if (!pendingRow && !inMemory) {
        console.log("[Friends] No pending request found:", { fromUserId, myId });
        socket.emit("friend:error", { message: "Friend request not found or already processed" });
        socket.emit("friend:requests", getPendingList(myId));
        return;
      }

      // Update memory
      const fromProf = theirPending?.get(fromUserId);
      if (theirPending?.has(fromUserId)) {
        theirPending.delete(fromUserId);
        if (theirPending.size === 0) pendingRequests.delete(myId);
      }

      ensureSet(friends, myId).add(fromUserId);
      ensureSet(friends, fromUserId).add(myId);
      if (fromProf?.username) usernameById.set(fromUserId, fromProf.username);

      // Accept in DB — update pending, or upsert accepted for legacy memory-only requests
      const saved = await saveFriendshipToDB(fromUserId, myId);
      if (!saved) {
        // Roll back memory so UI can restore the pending request
        ensureSet(friends, myId).delete(fromUserId);
        ensureSet(friends, fromUserId).delete(myId);
        ensurePending(myId).set(fromUserId, fromProf || { id: fromUserId, username: usernameById.get(fromUserId) || "?" });
        socket.emit("friend:error", { message: "Failed to save friendship" });
        socket.emit("friend:requests", getPendingList(myId));
        return;
      }

      emitToUser(io, fromUserId, "friend:accepted", { by: { id: myId, username: me.username } });
      pushNotification(io, fromUserId, {
        type: "friend_accepted",
        title: "Friend request accepted",
        body: `${me.username} accepted your friend request`,
        meta: { userId: myId },
      });

      socket.emit("friend:accepted", { by: { id: fromUserId } });
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      emitToUser(io, fromUserId, "friend:list", getFriendList(fromUserId));
      emitToUser(io, fromUserId, "friend:requests", getPendingList(fromUserId));
      emitToUser(io, fromUserId, "sync:state", buildSyncState(fromUserId));
      
      console.log("[Friends] Request accepted:", { fromUserId, by: myId });
    });

    socket.on("friend:decline", async (payload = {}) => {
      const fromUserId = String(payload?.fromUserId || payload?.userId || "").trim();
      if (!fromUserId) {
        socket.emit("friend:error", { message: "Invalid user ID" });
        return;
      }
      
      try {
        // First delete from database
        const { error: deleteError } = await supabase
          .from("friendships")
          .delete()
          .eq("user_id", fromUserId)
          .eq("friend_id", myId)
          .eq("status", "pending");
        
        if (deleteError) {
          console.error("[Friends] Decline error:", deleteError);
          socket.emit("friend:error", { message: "Failed to decline request" });
          return;
        }
        
        // Then remove from memory
        const theirPending = pendingRequests.get(myId);
        if (theirPending?.has(fromUserId)) {
          theirPending.delete(fromUserId);
          if (theirPending.size === 0) pendingRequests.delete(myId);
        }
        
        // Update friend list for the sender to remove pending status
        io.to(`user:${fromUserId}`).emit("friend:list", getFriendList(fromUserId));
        
        socket.emit("friend:requests", getPendingList(myId));
        socket.emit("friend:list", getFriendList(myId));
        
        console.log("[Friends] Request declined:", { fromUserId, by: myId });
      } catch (err) {
        console.error("[Friends] Decline error:", err);
        socket.emit("friend:error", { message: "Failed to decline request" });
      }
    });

    socket.on("friend:remove", async ({ friendId } = {}) => {
      if (typeof friendId !== "string") return;
      const a = friends.get(myId);
      const b = friends.get(friendId);
      if (a) a.delete(friendId);
      if (b) b.delete(myId);
      ensureDmUnreadMap(myId).delete(friendId);
      ensureDmUnreadMap(friendId).delete(myId);
      
      // Remove friendship from database
      await removeFriendshipFromDB(myId, friendId);
      
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      emitToUser(io, friendId, "friend:list", getFriendList(friendId));
      emitToUser(io, friendId, "sync:state", buildSyncState(friendId));
    });

    socket.on("dm:set_active", ({ withUserId } = {}) => {
      socket.data.activeDmPeer = typeof withUserId === "string" ? withUserId : null;
    });

    socket.on("typing:start", (payload = {}) => {
      const { context = "dm", toUserId, groupId } = payload;
      const fromUser = { id: myId, username: me.username };
      if (context === "dm" && typeof toUserId === "string") {
        emitToUser(io, toUserId, "typing:update", { context: "dm", fromUser, typing: true });
      } else if (context === "group" && typeof groupId === "string") {
        socket.to(`group:${groupId}`).emit("typing:update", { context: "group", groupId, fromUser, typing: true });
      }
    });

    socket.on("typing:stop", (payload = {}) => {
      const { context = "dm", toUserId, groupId } = payload;
      const fromUser = { id: myId, username: me.username };
      if (context === "dm" && typeof toUserId === "string") {
        emitToUser(io, toUserId, "typing:update", { context: "dm", fromUser, typing: false });
      } else if (context === "group" && typeof groupId === "string") {
        socket.to(`group:${groupId}`).emit("typing:update", { context: "group", groupId, fromUser, typing: false });
      }
    });

    socket.on("dm:send", async ({ toUserId, tempId, text, mediaUrl, mediaType, mimeType, size, originalName, duration, replyTo } = {}) => {
      if (bannedUserIds.has(myId)) {
        appendErrorLog("dm:send", "User is banned", { toUserId }, myId, me.username);
        return socket.emit("dm:error", { message: "You are banned.", tempId: tempId || null, toUserId });
      }
      if (dmBlockPairs.has(convKey(myId, toUserId))) {
        appendErrorLog("dm:send", "Conversation blocked", { toUserId }, myId, me.username);
        return socket.emit("dm:error", { message: "Conversation blocked.", tempId: tempId || null, toUserId });
      }
      const now = Date.now();
      const last = rateLimitDm.get(myId) || 0;
      if (now - last < systemConfig.dmRateLimitMs) {
        appendErrorLog("dm:send", "Rate limited", { toUserId }, myId, me.username);
        return socket.emit("dm:error", { message: "Rate limited.", tempId: tempId || null, toUserId });
      }
      rateLimitDm.set(myId, now);
      socket.data.activeDmPeer = toUserId;
      const sender = messageSender(myId, me.username, me.avatar_url || socket.user?.avatar_url);
      const replyMeta = replyTo && typeof replyTo === "object"
        ? {
            id: replyTo.id || null,
            text: replyTo.text || "",
            mediaType: replyTo.mediaType || null,
            from: replyTo.from || null,
          }
        : null;
      const isVoice = mediaType === "voice" || mediaType === "audio";
      const voiceDuration = isVoice ? Math.max(0, Math.round(Number(duration) || 0)) : null;
      const storedText = isVoice
        ? (String(text || "").startsWith("__voice__:") ? text : `__voice__:${voiceDuration || 1}`)
        : (text || "");
      const { data: row, error: persistError } = await supabase
        .from("dm_messages")
        .insert({
          from_user_id: myId,
          to_user_id: toUserId,
          content: storedText,
          media_url: mediaUrl || null,
          media_type: isVoice ? "voice" : (mediaType || null),
          mime_type: mimeType || null,
          file_size: size ?? null,
          original_name: originalName || null,
          duration: voiceDuration,
          reply_to: replyMeta,
        })
        .select("id, created_at")
        .single();
      if (persistError || !row) {
        console.error("[DM] Database insert failed:", persistError?.message || "No row returned");
        return socket.emit("dm:error", {
          message: "Failed to send message. Please try again.",
          tempId: tempId || null,
          toUserId,
        });
      }
      const messageId = row.id;
      const timestamp = row.created_at;

      // Unread for recipient — skip if they currently have this DM open
      const recipientSocket = getSocketForUser(io, toUserId);
      const recipientActivePeer = recipientSocket?.data?.activeDmPeer;
      let unreadCount = 0;
      if (recipientActivePeer !== myId) {
        const unreadMap = ensureDmUnreadMap(toUserId);
        unreadCount = (unreadMap.get(myId) || 0) + 1;
        unreadMap.set(myId, unreadCount);
      } else {
        ensureDmUnreadMap(toUserId).delete(myId);
      }

      const messagePayload = {
        id: messageId,
        from: sender,
        text: isVoice ? "" : storedText,
        mediaUrl,
        mediaType: isVoice ? "voice" : mediaType,
        mimeType,
        size,
        originalName,
        duration: voiceDuration,
        replyTo: replyMeta,
        timestamp,
      };
      cacheDmMessages(convKey(myId, toUserId), [{ ...messagePayload, to: { id: toUserId } }]);
      emitToUser(io, toUserId, "dm:message", { ...messagePayload, convWith: myId });
      // Echo back to sender with tempId so client can replace the optimistic message
      socket.emit("dm:message", { ...messagePayload, tempId, convWith: toUserId });

      // Sync unread after the message so the list can reorder first, then badge updates
      if (recipientActivePeer !== myId) {
        emitToUser(io, toUserId, "dm:unread:sync", { peerId: myId, count: unreadCount });
      } else {
        emitToUser(io, toUserId, "dm:unread:sync", { peerId: myId, count: 0 });
      }

      // Emit mention:received if text contains @recipient — used by notification service
      if (text) {
        const recipientUsername = usernameById.get(toUserId);
        const mentionPattern = new RegExp(`@${recipientUsername}\\b`, "i");
        if (recipientUsername && mentionPattern.test(text)) {
          emitToUser(io, toUserId, "mention:received", {
            dmConversationId: myId,
            from: me.username,
            text,
          });
        }
      }
    });

    socket.on("dm:delivered", async ({ msgId, fromUserId } = {}) => {
      if (typeof msgId !== "string" || typeof fromUserId !== "string") return;
      const key = convKey(myId, fromUserId);
      const arr = dmHistory.get(key);
      const m = arr?.find((x) => x.id === msgId);
      const at = new Date().toISOString();
      const { error } = await supabase
        .from("dm_messages")
        .update({ delivered_at: at })
        .eq("id", msgId)
        .eq("from_user_id", fromUserId)
        .eq("to_user_id", myId)
        .is("delivered_at", null);
      if (error) return console.error("[DM] Delivery update failed:", error.message);
      if (m) m.deliveredAt = m.deliveredAt || at;
      emitToUser(io, fromUserId, "dm:message:update", {
        msgId,
        convWith: myId,
        deliveredAt: m?.deliveredAt || at,
      });
    });

    socket.on("dm:mark_read", async ({ withUserId } = {}) => {
      if (typeof withUserId !== "string") return;
      const key = convKey(myId, withUserId);
      const arr = dmHistory.get(key);
      const at = new Date().toISOString();
      const { error } = await supabase
        .from("dm_messages")
        .update({ read_at: at })
        .eq("from_user_id", withUserId)
        .eq("to_user_id", myId)
        .is("read_at", null);
      if (error) return console.error("[DM] Read update failed:", error.message);
      if (arr) {
        for (const m of arr) {
          if (m.from?.id === withUserId && m.to?.id === myId) {
            m.readAt = m.readAt || at;
          }
        }
      }
      const umap = ensureDmUnreadMap(myId);
      umap.delete(withUserId);
      emitToUser(io, myId, "dm:unread:sync", { peerId: withUserId, count: 0 });
      emitToUser(io, withUserId, "dm:peer_read", { peerId: myId, at });
    });

    socket.on("dm:history", async ({ withUserId } = {}) => {
      if (typeof withUserId !== "string") return;
      if (!(await isAcceptedFriend(myId, withUserId))) {
        return socket.emit("dm:history", { withUserId, messages: [] });
      }
      try {
        const { messages } = await loadDmMessages(myId, withUserId);
        const withReactions = await attachReactions(messages, "dm", convKey(myId, withUserId));
        socket.emit("dm:history", { withUserId, messages: withReactions });
      } catch (error) {
        console.error("[DM] History load failed:", error.message);
        socket.emit("dm:error", { message: "Failed to load message history.", toUserId: withUserId });
      }
    });

    socket.on("dm:fetch", async ({ withUserId, before, limit = 50 } = {}) => {
      if (typeof withUserId !== "string") return;
      if (!(await isAcceptedFriend(myId, withUserId))) {
        return socket.emit("dm:page", { withUserId, messages: [], hasMore: false });
      }
      try {
        const { messages, hasMore } = await loadDmMessages(myId, withUserId, {
          before: typeof before === "string" ? before : null,
          limit,
        });
        const withReactions = await attachReactions(messages, "dm", convKey(myId, withUserId));
        socket.emit("dm:page", { withUserId, messages: withReactions, hasMore });
      } catch (error) {
        console.error("[DM] Page load failed:", error.message);
        socket.emit("dm:error", { message: "Failed to load older messages.", toUserId: withUserId });
      }
    });

    socket.on("notification:read", ({ id } = {}) => {
      if (typeof id !== "string") return;
      const list = notificationsByUser.get(myId);
      if (!list) return;
      const n = list.find((x) => x.id === id);
      if (n) n.read = true;
      emitToUser(io, myId, "notifications:sync", { notifications: getNotifications(myId) });
    });

    socket.on("notification:read_all", () => {
      const list = notificationsByUser.get(myId);
      if (list) for (const n of list) n.read = true;
      emitToUser(io, myId, "notifications:sync", { notifications: getNotifications(myId) });
    });

    socket.on("call:offer", ({ toUserId, offer, callType } = {}) => {
      if (typeof toUserId !== "string" || !offer) return;
      const targetId = toUserId.trim();
      if (!targetId) return;

      // Always attempt delivery via durable user room + presence fallback.
      const room = io.sockets?.adapter?.rooms?.get(`user:${targetId}`);
      const presenceHit = Boolean(presence.get(targetId)?.socketId);
      const delivered = (room && room.size > 0) || presenceHit;

      trackOffer({
        callerId: myId,
        calleeId: targetId,
        callType: callType || "voice",
      });

      emitToUser(io, targetId, "call:offer", {
        fromUser: {
          id: myId,
          username: me.username,
          avatar_url: me.avatar_url || socket.user?.avatar_url || null,
          avatarUrl: me.avatar_url || socket.user?.avatar_url || null,
        },
        offer,
        callType: callType || "voice",
      });

      // Inform caller only when we truly have no socket for the callee.
      // Do not block the offer attempt — emitToUser is best-effort.
      if (!delivered) {
        console.warn(`[Call] offer — callee may be offline: ${targetId}`);
        socket.emit("call:unreachable", {
          toUserId: targetId,
          reason: "offline_or_no_socket",
        });
      }
    });

    socket.on("call:answer", ({ toUserId, answer } = {}) => {
      if (typeof toUserId !== "string" || !answer) return;
      // Callee answers → caller is toUserId
      markAnswered({ callerId: toUserId, calleeId: myId });
      emitToUser(io, toUserId, "call:answer", {
        fromUserId: myId,
        answer,
      });
    });

    socket.on("call:ice-candidate", ({ toUserId, candidate } = {}) => {
      if (typeof toUserId !== "string" || !candidate) return;
      emitToUser(io, toUserId, "call:ice-candidate", {
        fromUserId: myId,
        candidate,
      });
    });

    socket.on("call:end", async ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:ended", { fromUserId: myId });
      try {
        const record = await finalizeCall(myId, toUserId, "completed");
        await notifyCallHistory(io, record);
      } catch (err) {
        console.warn("[Call] finalize end failed:", err?.message || err);
      }
    });

    socket.on("call:cancel", async ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:cancelled", { fromUserId: myId });
      try {
        // Unanswered cancel = missed for the callee history
        const record = await finalizeCall(myId, toUserId, "missed");
        await notifyCallHistory(io, record);
      } catch (err) {
        console.warn("[Call] finalize cancel failed:", err?.message || err);
      }
    });

    socket.on("call:decline", async ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:declined", { fromUserId: myId });
      try {
        const record = await finalizeCall(myId, toUserId, "declined");
        await notifyCallHistory(io, record);
      } catch (err) {
        console.warn("[Call] finalize decline failed:", err?.message || err);
      }
    });

    socket.on("screen:share-start", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "screen:share-start", { fromUserId: myId });
    });

    socket.on("screen:share-stop", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "screen:share-stop", { fromUserId: myId });
    });

    socket.on("room:join", (roomId) => {
      if (typeof roomId !== "string" || !roomId.trim()) return;
      socket.join(roomId);
      socket.to(roomId).emit("room:user_joined", { user: me, roomId });
    });

    socket.on("room:message", ({ roomId, text } = {}) => {
      if (typeof roomId !== "string" || typeof text !== "string") return;
      const trimmed = text.trim();
      if (!trimmed) return;
      io.to(roomId).emit("room:message:new", {
        id: String(Date.now()),
        roomId,
        username: me.username,
        userId: myId,
        text: trimmed,
        timestamp: new Date().toISOString(),
      });
    });

    // Emoji Reactions
    socket.on("reaction:add", async ({ messageId, conversationType, conversationId, emoji } = {}) => {
      console.log("[reaction:add] Received:", { messageId, conversationType, conversationId, emoji, myId });
      if (!messageId || !conversationType || !conversationId || !emoji) {
        console.log("[reaction:add] Missing params, returning");
        return;
      }
      
      // Verify user is part of this conversation
      let otherId = null;
      let dmKey = conversationId;
      if (conversationType === "dm") {
        // Accept either "a::b" or a bare peer user id
        if (typeof conversationId === "string" && conversationId.includes("::")) {
          const ids = conversationId.split("::");
          if (ids.length !== 2) {
            console.log("[reaction:add] Invalid conversationId format");
            return;
          }
          otherId = ids[0] === myId ? ids[1] : ids[0];
          dmKey = convKey(myId, otherId);
        } else {
          otherId = conversationId;
          dmKey = convKey(myId, otherId);
        }
        console.log("[reaction:add] otherId:", otherId, "isFriend:", friends.get(myId)?.has(otherId));
        if (!otherId || otherId === myId) {
          console.log("[reaction:add] Invalid DM peer, returning");
          return;
        }
        // Soft-check friendship: still allow if already in an open DM thread
        const knownThread = dmHistory.has(dmKey);
        if (!friends.get(myId)?.has(otherId) && !knownThread) {
          console.log("[reaction:add] Not friends / no DM thread, returning");
          return;
        }
        conversationId = dmKey;
      } else if (conversationType === "group") {
        // Check group membership - room has 'group:' prefix
        const roomId = `group:${conversationId}`;
        console.log("[reaction:add] Checking group membership, roomId:", roomId);
        console.log("[reaction:add] socket.rooms:", Array.from(socket.rooms));
        const isMember = socket.rooms.has(roomId);
        console.log("[reaction:add] isMember:", isMember);
        if (!isMember) {
          // Fallback: allow if user is in the group's member list in DB / previously joined
          try {
            const { data: mem } = await supabase
              .from("group_members")
              .select("user_id")
              .eq("group_id", conversationId)
              .eq("user_id", myId)
              .maybeSingle();
            if (!mem) {
              console.log("[reaction:add] Not a member of this group, returning");
              return;
            }
            socket.join(roomId);
          } catch {
            console.log("[reaction:add] Not a member of this group, returning");
            return;
          }
        }
      }

      try {
        const { data, error } = await supabase
          .from("reactions")
          .upsert({
            message_id: messageId,
            conversation_type: conversationType,
            conversation_id: conversationId,
            user_id: myId,
            emoji: emoji,
          }, { onConflict: "message_id,user_id,emoji" })
          .select();

        if (error) {
          console.error("[reaction:add] Supabase error:", error);
          throw error;
        }

        console.log("[reaction:add] Saved to DB:", data);

        // Broadcast to all users in conversation
        const reactionData = {
          messageId,
          emoji,
          userId: myId,
          username: me.username,
          conversationType,
          conversationId,
        };

        console.log("[reaction:add] Broadcasting:", reactionData);

        if (conversationType === "dm" && otherId) {
          const otherPresence = presence.get(otherId);
          console.log("[reaction:add] Other user presence:", otherPresence);
          emitToUser(io, otherId, "reaction:update", reactionData);
          console.log("[reaction:add] Emitted to other user:", otherId);
        } else {
          io.to(`group:${conversationId}`).emit("reaction:update", reactionData);
          console.log("[reaction:add] Emitted to group room:", `group:${conversationId}`);
        }
        socket.emit("reaction:update", reactionData);
        console.log("[reaction:add] Emitted to sender");
      } catch (err) {
        console.error("[reaction:add] Error:", err);
      }
    });

    socket.on("reaction:remove", async ({ messageId, conversationType, conversationId, emoji } = {}) => {
      if (!messageId || !conversationType || !conversationId || !emoji) return;

      // Get otherId for DM
      let otherId = null;
      if (conversationType === "dm") {
        if (typeof conversationId === "string" && conversationId.includes("::")) {
          const ids = conversationId.split("::");
          if (ids.length === 2) {
            otherId = ids[0] === myId ? ids[1] : ids[0];
            conversationId = convKey(myId, otherId);
          }
        } else {
          otherId = conversationId;
          conversationId = convKey(myId, otherId);
        }
      }

      try {
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", myId)
          .eq("emoji", emoji);

        if (error) throw error;

        const reactionData = {
          messageId,
          emoji,
          userId: myId,
          username: me.username,
          removed: true,
          conversationType,
          conversationId,
        };

        if (conversationType === "dm" && otherId) {
          emitToUser(io, otherId, "reaction:update", reactionData);
        } else {
          io.to(`group:${conversationId}`).emit("reaction:update", reactionData);
        }
        socket.emit("reaction:update", reactionData);
      } catch (err) {
        console.error("[reaction:remove] Error:", err);
      }
    });

    // Message Edit - DM
    socket.on("dm:message:edit", async ({ messageId, newText, toUserId } = {}) => {
      if (!messageId || !newText || !toUserId) return;

      // Verify friendship
      if (!friends.get(myId)?.has(toUserId)) return;

      const key = convKey(myId, toUserId);
      const arr = dmHistory.get(key) || [];
      const msg = arr.find((message) => message.id === messageId && message.from?.id === myId);
      const editedAt = new Date().toISOString();
      const nextEditHistory = [
        ...(msg?.editHistory || []),
        ...(msg ? [{ text: msg.text, editedAt }] : []),
      ];
      const { data, error } = await supabase
        .from("dm_messages")
        .update({
          content: newText,
          edited_at: editedAt,
          edit_history: nextEditHistory,
        })
        .eq("id", messageId)
        .eq("from_user_id", myId)
        .eq("to_user_id", toUserId)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        console.error("[DM] Edit failed:", error?.message || "Message not found");
        return socket.emit("dm:error", { message: "Failed to edit message.", toUserId });
      }
      if (msg) {
        msg.editHistory = nextEditHistory;
        msg.text = newText;
        msg.editedAt = editedAt;
      }
      // Broadcast to other user
      emitToUser(io, toUserId, "dm:message:edited", {
        messageId,
        newText,
        editedAt: msg.editedAt,
        from: myId
      });
      
      socket.emit("dm:message:edited", {
        messageId,
        newText,
        editedAt: msg.editedAt
      });
    });

    // Message Edit - Group
    socket.on("group:message:edit", async ({ messageId, newText, groupId } = {}) => {
      if (!messageId || !newText || !groupId) return;
      
      // Check membership
      if (!socket.rooms.has(`group:${groupId}`)) return;
      
      const editedAt = new Date().toISOString();
      
      try {
        // Update message in Supabase
        const { error } = await supabase
          .from("group_messages")
          .update({
            content: newText,
            edited_at: editedAt,
            edited_by: myId,
            is_edited: true
          })
          .eq("id", messageId)
          .eq("sender_id", myId); // Only edit own messages
        
        if (error) {
          console.error("[group:message:edit] Error updating message:", error);
          return;
        }
        
        // Broadcast edit to group room
        const editData = {
          messageId,
          newText,
          editedAt,
          editedBy: myId,
          username: me.username
        };
        
        io.to(`group:${groupId}`).emit("group:message:edited", editData);
      } catch (err) {
        console.error("[group:message:edit] Error:", err);
      }
    });

    socket.on("disconnect", async () => {
      // Only drop group-call participation when THIS user has no other live
      // sockets (other tabs / reconnect). Removing on every socket disconnect
      // kicked the remaining participant out of the room on brief blips and
      // made "peer hangup" look like mutual disconnect.
      const remaining = io.sockets?.adapter?.rooms?.get(`user:${myId}`);
      const hasOtherSockets = Boolean(remaining && remaining.size > 0);
      if (!hasOtherSockets) {
        await removeUserFromAllGroupCalls(io, myId, socket);
      }
      socketToUser.delete(socket.id);

      // Keep presence if another tab/socket for this user is still connected.
      if (hasOtherSockets) {
        const nextSocketId = remaining.values().next().value;
        const prev = presence.get(myId);
        if (prev) {
          presence.set(myId, { ...prev, socketId: nextSocketId, status: prev.status || "online" });
        } else {
          presence.set(myId, {
            username: me.username,
            status: "online",
            socketId: nextSocketId,
          });
        }
        broadcastUsers(io);
        notifyAdminRoom(io, { type: "presence", online: presence.size });
        return;
      }

      const sessStart = userSessionStartMs.get(myId);
      if (sessStart) {
        userOnlineAccumMs.set(myId, (userOnlineAccumMs.get(myId) || 0) + (Date.now() - sessStart));
      }
      userSessionStartMs.delete(myId);
      const p = presence.get(myId);
      if (p?.username) usernameById.set(myId, p.username);
      lastSeenByUserId.set(myId, new Date().toISOString());
      presence.delete(myId);
      broadcastUsers(io);
      notifyAdminRoom(io, { type: "presence", online: presence.size });
    });

    // Grup DM handlerları
    registerGroupHandlers(io, socket, {
      presence,
      socketToUser,
      friends,
    });
  });
}

module.exports = { registerSocketHandlers, loadFriendsFromDB };

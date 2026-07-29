"use strict";

const supabase = require("../db/supabase");
const {
  loadUserProfile,
  cacheUserProfile,
  broadcastUserProfileUpdate,
  enrichFriendEntry,
  toPublicUser,
  getCachedPublicUser,
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
    const cached = getCachedPublicUser(id);
    list.push({
      id,
      username: cached?.username || p.username,
      status: p.status || "online",
      avatarUrl: cached?.avatarUrl || p.avatar_url || null,
      avatar_url: cached?.avatarUrl || p.avatar_url || null,
      avatarVersion: cached?.avatarVersion || cached?.updated_at || null,
      updated_at: cached?.updated_at || null,
    });
  }
  io.emit("users:update", list);
}

function messageSender(userId, fallbackUsername, fallbackAvatar) {
  const cached = getCachedPublicUser(userId);
  if (cached) {
    return {
      id: userId,
      username: cached.username,
      avatarUrl: cached.avatarUrl,
      avatar_url: cached.avatarUrl,
      avatarVersion: cached.avatarVersion,
      updated_at: cached.updated_at,
    };
  }
  return {
    id: userId,
    username: fallbackUsername,
    avatarUrl: fallbackAvatar || null,
    avatar_url: fallbackAvatar || null,
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
    out.push(enrichFriendEntry(fid));
  }
  return out.sort((a, b) => a.username.localeCompare(b.username));
}

function getPendingList(userId) {
  const m = pendingRequests.get(userId);
  if (!m) return [];
  return Array.from(m.keys()).map((id) => enrichFriendEntry(id));
}

function emitToUser(io, userId, event, payload) {
  const p = presence.get(userId);
  if (!p?.socketId) return;
  io.to(p.socketId).emit(event, payload);
}

function buildSyncState(userId) {
  const dmMap = ensureDmUnreadMap(userId);
  const dmUnreadByPeer = {};
  for (const [k, v] of dmMap) {
    dmUnreadByPeer[k] = v;
  }
  return {
    dmUnreadByPeer,
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

    // Batch-fetch usernames
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, updated_at")
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

// Accept the pending friend request in the 'friends' table (one row, requester → acceptor)
async function saveFriendshipToDB(requesterId, acceptorId) {
  try {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_id", requesterId)
      .eq("friend_id", acceptorId)
      .eq("status", "pending");

    if (error) console.error("[FRIENDS] Error accepting friendship in DB:", error);
    return !error;
  } catch (e) {
    console.error("[FRIENDS] Error in saveFriendshipToDB:", e);
    return false;
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
      userRoles.set(myId, me.username === "admin" ? "admin" : "user");
    }
    userSessionStartMs.set(myId, Date.now());

    usernameById.set(myId, me.username);

    presence.set(myId, {
      username: me.username,
      status: "online",
      socketId: socket.id,
      avatar_url: me.avatar_url || null,
    });
    socket.join(`user:${myId}`);
    socketToUser.set(socket.id, myId);
    socket.data.activeDmPeer = null;

    // Load full profile from DB (avatar, display name, etc.)
    loadUserProfile(myId).then((profile) => {
      if (!profile) return;
      me.avatar_url = profile.avatar_url;
      socket.user.avatar_url = profile.avatar_url;
      const p = presence.get(myId);
      if (p) {
        p.avatar_url = profile.avatar_url;
        presence.set(myId, p);
      }
    }).catch(() => {});

    setupAdminSocket(io, socket);

    // Load friends and pending requests from DB, then fire all initial events together
    Promise.all([
      loadFriendsFromDB(myId),
      loadPendingRequestsFromDB(myId),
    ]).then(() => {
      socket.emit("connected", {
        user: me,
        message: "Socket connected successfully.",
      });
      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      broadcastUsers(io);
    });

    socket.on("status:set", ({ status } = {}) => {
      const allowed = ["online", "idle", "dnd", "invisible"];
      const s = allowed.includes(status) ? status : "online";
      const p = presence.get(myId);
      if (p) {
        p.status = s;
        presence.set(myId, p);
      }
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
        if (myFriends.has(target.id)) {
          appendErrorLog("friend:request", "Already friends", { targetId: target.id, targetUsername: target.username }, myId, me.username);
          return socket.emit("friend:error", { message: "Already friends." });
        }
        const theirPending = ensurePending(target.id);
        if (theirPending.has(myId)) {
          appendErrorLog("friend:request", "Request already pending", { targetId: target.id }, myId, me.username);
          return socket.emit("friend:error", { message: "Request already pending." });
        }

        theirPending.set(myId, { id: myId, username: me.username });
        usernameById.set(myId, me.username);
        emitToUser(io, target.id, "friend:request:incoming", {
          from: enrichFriendEntry(myId),
        });
        pushNotification(io, target.id, {
          type: "friend_request",
          title: "Friend request",
          body: `${me.username} sent you a friend request`,
          meta: { fromUserId: myId },
        });
        socket.emit("friend:request:sent", { to: target.username });
      } catch (e) {
        socket.emit("friend:error", { message: "Could not send request." });
      }
    });

    socket.on("friend:accept", async ({ fromUserId } = {}) => {
      if (typeof fromUserId !== "string") {
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

      if (!pendingRow) {
        console.log("[Friends] No pending request found:", { fromUserId, myId });
        socket.emit("friend:error", { message: "Friend request not found or already processed" });
        return;
      }

      // Update memory
      const theirPending = pendingRequests.get(myId);
      const fromProf = theirPending?.get(fromUserId);
      if (theirPending?.has(fromUserId)) {
        theirPending.delete(fromUserId);
        if (theirPending.size === 0) pendingRequests.delete(myId);
      }

      ensureSet(friends, myId).add(fromUserId);
      ensureSet(friends, fromUserId).add(myId);
      if (fromProf?.username) usernameById.set(fromUserId, fromProf.username);

      // Accept in DB — only one pending row (requester → acceptor)
      try {
        await saveFriendshipToDB(fromUserId, myId);
      } catch (err) {
        console.error("[Friends] Accept save error:", err);
        socket.emit("friend:error", { message: "Failed to save friendship" });
        return;
      }

      emitToUser(io, fromUserId, "friend:accepted", { by: { id: myId, username: me.username } });
      pushNotification(io, fromUserId, {
        type: "friend_accepted",
        title: "Friend request accepted",
        body: `${me.username} accepted your friend request`,
        meta: { userId: myId },
      });

      socket.emit("friend:list", getFriendList(myId));
      socket.emit("friend:requests", getPendingList(myId));
      socket.emit("sync:state", buildSyncState(myId));
      emitToUser(io, fromUserId, "friend:list", getFriendList(fromUserId));
      emitToUser(io, fromUserId, "sync:state", buildSyncState(fromUserId));
      
      console.log("[Friends] Request accepted:", { fromUserId, by: myId });
    });

    socket.on("friend:decline", async ({ fromUserId } = {}) => {
      if (typeof fromUserId !== "string") {
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

    socket.on("dm:send", async ({ toUserId, tempId, text, mediaUrl, mediaType, mimeType, size, originalName } = {}) => {
      if (bannedUserIds.has(myId)) {
        appendErrorLog("dm:send", "User is banned", { toUserId }, myId, me.username);
        return socket.emit("dm:error", { message: "You are banned." });
      }
      if (dmBlockPairs.has(convKey(myId, toUserId))) {
        appendErrorLog("dm:send", "Conversation blocked", { toUserId }, myId, me.username);
        return socket.emit("dm:error", { message: "Conversation blocked." });
      }
      const now = Date.now();
      const last = rateLimitDm.get(myId) || 0;
      if (now - last < systemConfig.dmRateLimitMs) {
        appendErrorLog("dm:send", "Rate limited", { toUserId }, myId, me.username);
        return socket.emit("dm:error", { message: "Rate limited." });
      }
      rateLimitDm.set(myId, now);
      socket.data.activeDmPeer = toUserId;
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const arr = dmHistory.get(convKey(myId, toUserId)) || [];
      const sender = messageSender(myId, me.username, me.avatar_url || socket.user?.avatar_url);
      arr.push({
        id: messageId,
        from: sender,
        to: { id: toUserId },
        text: text || "",
        mediaUrl,
        mediaType,
        mimeType,
        size,
        originalName,
        timestamp: new Date().toISOString(),
      });
      if (arr.length > MAX_DM_PER_CONV) arr.length = MAX_DM_PER_CONV;
      dmHistory.set(convKey(myId, toUserId), arr);

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
        text,
        mediaUrl,
        mediaType,
        mimeType,
        size,
        originalName,
        timestamp: new Date().toISOString(),
      };
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

    socket.on("dm:delivered", ({ msgId, fromUserId } = {}) => {
      if (typeof msgId !== "string" || typeof fromUserId !== "string") return;
      const key = convKey(myId, fromUserId);
      const arr = dmHistory.get(key);
      const m = arr?.find((x) => x.id === msgId);
      if (!m || m.from?.id !== fromUserId || m.to?.id !== myId) return;
      const at = new Date().toISOString();
      m.deliveredAt = m.deliveredAt || at;
      emitToUser(io, fromUserId, "dm:message:update", {
        msgId,
        convWith: myId,
        deliveredAt: m.deliveredAt,
      });
    });

    socket.on("dm:mark_read", ({ withUserId } = {}) => {
      if (typeof withUserId !== "string") return;
      const key = convKey(myId, withUserId);
      const arr = dmHistory.get(key);
      const at = new Date().toISOString();
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

    socket.on("dm:history", ({ withUserId } = {}) => {
      if (typeof withUserId !== "string") return;
      const key = convKey(myId, withUserId);
      const all = dmHistory.get(key) || [];
      socket.emit("dm:history", {
        withUserId,
        messages: all.slice(-100),
      });
    });

    socket.on("dm:fetch", ({ withUserId, before, limit = 50 } = {}) => {
      if (typeof withUserId !== "string") return;
      if (!friends.get(myId)?.has(withUserId)) {
        return socket.emit("dm:page", { withUserId, messages: [], hasMore: false });
      }
      const key = convKey(myId, withUserId);
      const arr = dmHistory.get(key) || [];
      const pool = typeof before === "string" ? arr.filter((m) => m.timestamp < before) : arr;
      const slice = pool.slice(-limit);
      socket.emit("dm:page", {
        withUserId,
        messages: slice,
        hasMore: slice.length === limit,
      });
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
      emitToUser(io, toUserId, "call:offer", {
        fromUser: {
          id: myId,
          username: me.username,
          avatar_url: me.avatar_url || socket.user?.avatar_url || null,
          avatarUrl: me.avatar_url || socket.user?.avatar_url || null,
        },
        offer,
        callType: callType || "voice",
      });
    });

    socket.on("call:answer", ({ toUserId, answer } = {}) => {
      if (typeof toUserId !== "string" || !answer) return;
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

    socket.on("call:end", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:ended", { fromUserId: myId });
    });

    socket.on("call:cancel", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:cancelled", { fromUserId: myId });
    });

    socket.on("call:decline", ({ toUserId } = {}) => {
      if (typeof toUserId !== "string") return;
      emitToUser(io, toUserId, "call:declined", { fromUserId: myId });
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
      if (conversationType === "dm") {
        // conversationId should be in format "smallerId::largerId"
        const ids = conversationId.split("::");
        console.log("[reaction:add] DM ids:", ids);
        if (ids.length !== 2) {
          console.log("[reaction:add] Invalid conversationId format");
          return;
        }
        otherId = ids[0] === myId ? ids[1] : ids[0];
        console.log("[reaction:add] otherId:", otherId, "isFriend:", friends.get(myId)?.has(otherId));
        if (!otherId || !friends.get(myId)?.has(otherId)) {
          console.log("[reaction:add] Not friends, returning");
          return;
        }
      } else if (conversationType === "group") {
        // Check group membership - room has 'group:' prefix
        const roomId = `group:${conversationId}`;
        console.log("[reaction:add] Checking group membership, roomId:", roomId);
        console.log("[reaction:add] socket.rooms:", Array.from(socket.rooms));
        const isMember = socket.rooms.has(roomId);
        console.log("[reaction:add] isMember:", isMember);
        if (!isMember) {
          console.log("[reaction:add] Not a member of this group, returning");
          return;
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
        const ids = conversationId.split("::");
        if (ids.length === 2) {
          otherId = ids[0] === myId ? ids[1] : ids[0];
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
      
      const convKey = [myId, toUserId].sort().join("::");
      const arr = dmHistory.get(convKey) || [];
      const msg = arr.find(m => m.id === messageId && m.from === myId);
      
      if (!msg) return;
      
      // Save old version to edit history
      if (!msg.editHistory) msg.editHistory = [];
      msg.editHistory.push({
        text: msg.text,
        editedAt: new Date().toISOString()
      });
      
      msg.text = newText;
      msg.editedAt = new Date().toISOString();
      
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
      await removeUserFromAllGroupCalls(io, myId, socket);

      const sessStart = userSessionStartMs.get(myId);
      if (sessStart) {
        userOnlineAccumMs.set(myId, (userOnlineAccumMs.get(myId) || 0) + (Date.now() - sessStart));
      }
      userSessionStartMs.delete(myId);
      socketToUser.delete(socket.id);
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

const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { pendingRequests, presence, usernameById } = require("../runtime/sharedState");
const { blockUser, unblockUser, getBlockedList } = require("../lib/blocking");

const router = express.Router();

function ensurePending(userId) {
  if (!pendingRequests.has(userId)) pendingRequests.set(userId, new Map());
  return pendingRequests.get(userId);
}

function emitToUserViaIo(io, userId, event, payload) {
  const p = presence.get(userId);
  if (p?.socketId) io.to(p.socketId).emit(event, payload);
}

// Send friend request
router.post("/request", requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.id;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }

    const trimmedUsername = username.trim();

    // Find target user
    const { data: targetUser, error: lookupError } = await supabase
      .from("users")
      .select("id, username")
      .ilike("username", trimmedUsername)
      .maybeSingle();

    if (lookupError || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ error: "Cannot add yourself as a friend" });
    }

    // Check if already friends or request already pending
    const { data: existingRows } = await supabase
      .from("friendships")
      .select("id, status")
      .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`);

    if (existingRows && existingRows.length > 0) {
      const statuses = existingRows.map((r) => r.status);
      if (statuses.includes("accepted")) {
        return res.status(400).json({ error: "Already friends" });
      }
      if (statuses.includes("pending")) {
        return res.status(400).json({ error: "Friend request already pending" });
      }
      // Stale declined/other row — delete and re-insert
      await supabase
        .from("friendships")
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`);
    }

    // Create friend request
    const { error: insertError } = await supabase
      .from("friendships")
      .insert({
        user_id: userId,
        friend_id: targetUser.id,
        status: "pending"
      });

    if (insertError) {
      console.error("Friend request insert error:", insertError);
      return res.status(500).json({ error: insertError.message || "Failed to send friend request" });
    }

    // Sync socket memory so real-time accept/reject works
    const senderUsername = req.user.username || usernameById.get(userId) || "Unknown";
    ensurePending(targetUser.id).set(userId, { id: userId, username: senderUsername });
    usernameById.set(userId, senderUsername);

    const io = req.app.get("io");
    if (io) {
      emitToUserViaIo(io, targetUser.id, "friend:request:incoming", {
        from: { id: userId, username: senderUsername },
      });
    }

    res.json({ success: true, message: "Friend request sent" });
  } catch (err) {
    console.error("Friend request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept friend request
router.post("/accept", requireAuth, async (req, res) => {
  try {
    const { fromUserId } = req.body;
    const userId = req.user.id;

    if (!fromUserId) {
      return res.status(400).json({ error: "fromUserId is required" });
    }

    // Check if request exists first
    const { data: existingRequest, error: checkError } = await supabase
      .from("friendships")
      .select("id")
      .eq("user_id", fromUserId)
      .eq("friend_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (checkError) {
      console.error("[Friends] Check request error:", checkError);
      return res.status(500).json({ error: "Database error checking request" });
    }

    if (!existingRequest) {
      return res.status(404).json({ error: "Friend request not found or already processed" });
    }

    // Update the request
    const { data: updated, error: updateError } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("user_id", fromUserId)
      .eq("friend_id", userId)
      .eq("status", "pending")
      .select()
      .single();

    if (updateError) {
      console.error("[Friends] Accept error:", updateError);
      return res.status(500).json({ error: updateError.message || "Failed to accept friend request" });
    }

    if (!updated) {
      return res.status(400).json({ error: "Request could not be accepted" });
    }

    // Sync socket memory so both sides see each other immediately
    const { friends: friendsMap } = require("../runtime/sharedState");
    if (!friendsMap.has(userId)) friendsMap.set(userId, new Set());
    if (!friendsMap.has(fromUserId)) friendsMap.set(fromUserId, new Set());
    friendsMap.get(userId).add(fromUserId);
    friendsMap.get(fromUserId).add(userId);

    // Also update pendingRequests map
    const { pendingRequests } = require("../runtime/sharedState");
    const pendingForUser = pendingRequests.get(userId);
    if (pendingForUser && pendingForUser.has(fromUserId)) {
      pendingForUser.delete(fromUserId);
    }

    // Notify both sides to refresh their friend list
    const io = req.app.get("io");
    if (io) {
      // Prefer durable user rooms (multi-tab safe)
      io.to(`user:${userId}`).emit("friend:accepted", { by: { id: fromUserId } });
      io.to(`user:${fromUserId}`).emit("friend:accepted", { by: { id: userId } });
      emitToUserViaIo(io, userId, "friend:accepted", { by: { id: fromUserId } });
      emitToUserViaIo(io, fromUserId, "friend:accepted", { by: { id: userId } });
    }

    console.log("[Friends] Request accepted:", { fromUserId, userId });
    res.json({ success: true, message: "Friend request accepted" });
  } catch (err) {
    console.error("[Friends] Accept error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Decline friend request
router.post("/decline", requireAuth, async (req, res) => {
  try {
    const { fromUserId } = req.body;
    const userId = req.user.id;

    if (!fromUserId) {
      return res.status(400).json({ error: "fromUserId is required" });
    }

    // Delete friend request
    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("user_id", fromUserId)
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (deleteError) {
      return res.status(500).json({ error: "Failed to decline friend request" });
    }

    res.json({ success: true, message: "Friend request declined" });
  } catch (err) {
    console.error("Decline friend error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove friend
router.post("/remove", requireAuth, async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.id;

    if (!friendId) {
      return res.status(400).json({ error: "friendId is required" });
    }

    // Delete friendship
    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

    if (deleteError) {
      return res.status(500).json({ error: "Failed to remove friend" });
    }

    res.json({ success: true, message: "Friend removed" });
  } catch (err) {
    console.error("Remove friend error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get friends list
router.get("/list", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: rows, error } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (error) {
      console.error("Friends list query error:", error);
      return res.status(500).json({ error: "Failed to fetch friends" });
    }

    const friendIds = [];
    for (const row of (rows || [])) {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      if (otherId && !friendIds.includes(otherId)) friendIds.push(otherId);
    }

    if (friendIds.length === 0) return res.json({ friends: [] });

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, is_admin")
      .in("id", friendIds);

    if (usersError) {
      console.error("Friends list users fetch error:", usersError);
      return res.status(500).json({ error: "Failed to fetch friend details" });
    }

    const formattedFriends = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name || null,
      display_name: u.display_name || null,
      avatarUrl: u.avatar_url || null,
      avatar_url: u.avatar_url || null,
      bio: u.bio || null,
      customStatus: u.custom_status || null,
      custom_status: u.custom_status || null,
      bannerUrl: u.banner_url || null,
      banner_url: u.banner_url || null,
      updated_at: u.updated_at || null,
      is_admin: Boolean(u.is_admin),
      isAdmin: Boolean(u.is_admin),
      status: "offline",
    }));

    res.json({ friends: formattedFriends });
  } catch (err) {
    console.error("Get friends error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get pending friend requests
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: rows, error } = await supabase
      .from("friendships")
      .select("user_id")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("Get friend requests query error:", error);
      return res.status(500).json({ error: "Failed to fetch friend requests" });
    }

    if (!rows || rows.length === 0) return res.json({ requests: [] });

    const senderIds = rows.map((r) => r.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, updated_at")
      .in("id", senderIds);

    if (usersError) {
      console.error("Get friend requests users fetch error:", usersError);
      return res.status(500).json({ error: "Failed to fetch requester details" });
    }

    const formattedRequests = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name || null,
      display_name: u.display_name || null,
      avatarUrl: u.avatar_url || null,
      avatar_url: u.avatar_url || null,
      updated_at: u.updated_at || null,
    }));

    res.json({ requests: formattedRequests });
  } catch (err) {
    console.error("Get friend requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get mutual friends with a target user
router.get("/mutual/:username", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id;
    const { username } = req.params;

    const { data: targetUser, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (lookupError || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.id === myId) {
      return res.json({ mutualFriends: [], count: 0 });
    }

    // Fetch accepted friends of current user
    const { data: myRows } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`)
      .eq("status", "accepted");

    const myFriendIds = new Set(
      (myRows || []).map((r) => (r.user_id === myId ? r.friend_id : r.user_id))
    );

    // Fetch accepted friends of target user
    const { data: theirRows } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${targetUser.id},friend_id.eq.${targetUser.id}`)
      .eq("status", "accepted");

    const theirFriendIds = new Set(
      (theirRows || []).map((r) => (r.user_id === targetUser.id ? r.friend_id : r.user_id))
    );

    const mutualIds = [...myFriendIds].filter((id) => theirFriendIds.has(id));

    if (mutualIds.length === 0) {
      return res.json({ mutualFriends: [], count: 0 });
    }

    const { data: mutualUsers } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", mutualIds);

    const mutualFriends = (mutualUsers || []).map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url || null,
    }));

    res.json({ mutualFriends, count: mutualFriends.length });
  } catch (err) {
    console.error("Mutual friends error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Quick-add suggestions: ranks people by mutual friends and shared groups
// (friends-of-friends and fellow group members are the closest thing this
// app has to "nearby" — there's no real geolocation), then tops the list up
// with a handful of random active users so the panel is never empty for a
// brand-new account with no connections yet.
router.get("/suggestions", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));

    const [{ data: relRows, error: relError }, blockedIds, { data: blockedByRows }] = await Promise.all([
      supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
      getBlockedList(userId),
      supabase.from("users").select("id").contains("blocked_users", [userId]),
    ]);
    if (relError) {
      console.error("[Friends] suggestions relationship query error:", relError);
      return res.status(500).json({ error: "Failed to load suggestions" });
    }

    const excluded = new Set([userId, ...blockedIds, ...((blockedByRows || []).map((r) => r.id))]);
    const myFriendIds = new Set();
    for (const row of relRows || []) {
      const other = row.user_id === userId ? row.friend_id : row.user_id;
      if (!other) continue;
      excluded.add(other); // any existing relationship (accepted or pending, either direction)
      if (row.status === "accepted") myFriendIds.add(other);
    }

    // Score candidates: mutual friends (friends-of-friends) weighted highest,
    // shared groups next, so the closest social connections surface first.
    const scoreById = new Map(); // id -> { mutualFriends, sharedGroups }
    const bump = (id, key) => {
      if (excluded.has(id)) return;
      if (!scoreById.has(id)) scoreById.set(id, { mutualFriends: 0, sharedGroups: 0 });
      scoreById.get(id)[key] += 1;
    };

    if (myFriendIds.size > 0) {
      const friendIdList = [...myFriendIds];
      const { data: fofRows } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .eq("status", "accepted")
        .or(`user_id.in.(${friendIdList.join(",")}),friend_id.in.(${friendIdList.join(",")})`);
      for (const row of fofRows || []) {
        if (myFriendIds.has(row.user_id)) bump(row.friend_id, "mutualFriends");
        else if (myFriendIds.has(row.friend_id)) bump(row.user_id, "mutualFriends");
      }
    }

    const { data: myGroupRows } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    const myGroupIds = (myGroupRows || []).map((r) => r.group_id).filter(Boolean);
    if (myGroupIds.length > 0) {
      const { data: coMemberRows } = await supabase
        .from("group_members")
        .select("user_id")
        .in("group_id", myGroupIds)
        .neq("user_id", userId);
      for (const row of coMemberRows || []) bump(row.user_id, "sharedGroups");
    }

    const ranked = [...scoreById.entries()]
      .map(([id, s]) => ({ id, ...s, weight: s.mutualFriends * 3 + s.sharedGroups }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

    let filler = [];
    if (ranked.length < limit) {
      const excludeAll = new Set([...excluded, ...ranked.map((r) => r.id)]);
      const { data: randomPool } = await supabase
        .from("users")
        .select("id, username, avatar_url, display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const candidates = (randomPool || []).filter((u) => !excludeAll.has(u.id));
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      filler = candidates.slice(0, limit - ranked.length).map((u) => ({
        id: u.id,
        mutualFriends: 0,
        sharedGroups: 0,
        weight: 0,
      }));
    }

    const combined = [...ranked, ...filler];
    if (combined.length === 0) return res.json({ suggestions: [] });

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name")
      .in("id", combined.map((c) => c.id));
    if (usersError) {
      console.error("[Friends] suggestions user fetch error:", usersError);
      return res.status(500).json({ error: "Failed to load suggestions" });
    }
    const userById = new Map((users || []).map((u) => [u.id, u]));

    const suggestions = combined
      .map((c) => {
        const u = userById.get(c.id);
        if (!u) return null;
        return {
          id: u.id,
          username: u.username,
          displayName: u.display_name || null,
          avatarUrl: u.avatar_url || null,
          mutualFriends: c.mutualFriends,
          sharedGroups: c.sharedGroups,
          reason: c.mutualFriends > 0 ? "mutual" : c.sharedGroups > 0 ? "group" : "suggested",
        };
      })
      .filter(Boolean);

    res.json({ suggestions });
  } catch (err) {
    console.error("[Friends] suggestions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Blocking ────────────────────────────────────────────────────────
// Blocking a user severs the friendship and silently prevents DMs, direct
// calls, and future friend requests in both directions (see lib/blocking.js
// and its use in socket/handlers.js for dm:send / call:offer / friend:request).

router.post("/block", requireAuth, async (req, res) => {
  try {
    const { userId: targetId } = req.body ?? {};
    if (typeof targetId !== "string" || !targetId) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }
    const result = await blockUser(req.user.id, targetId);
    if (!result.ok) return res.status(400).json({ error: result.error });

    const io = req.app.get("io");
    if (io) {
      // Server-side friends/pending maps were already cleaned in blockUser();
      // ask both clients to re-pull their lists from the (now consistent) server state.
      io.to(`user:${req.user.id}`).emit("friend:blocked", { userId: targetId });
      io.to(`user:${targetId}`).emit("friend:blocked", { userId: req.user.id });
    }

    res.json({ success: true, blockedUsers: result.blockedUsers });
  } catch (err) {
    console.error("Block user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/unblock", requireAuth, async (req, res) => {
  try {
    const { userId: targetId } = req.body ?? {};
    if (typeof targetId !== "string" || !targetId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const result = await unblockUser(req.user.id, targetId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ success: true, blockedUsers: result.blockedUsers });
  } catch (err) {
    console.error("Unblock user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/blocked", requireAuth, async (req, res) => {
  try {
    const ids = await getBlockedList(req.user.id);
    if (ids.length === 0) return res.json({ blocked: [] });

    const { data: users } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name")
      .in("id", ids);

    const blocked = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url || null,
      displayName: u.display_name || null,
    }));
    res.json({ blocked });
  } catch (err) {
    console.error("List blocked users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

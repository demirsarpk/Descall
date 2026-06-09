const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { pendingRequests, presence, usernameById } = require("../runtime/sharedState");

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
      .select("id, username, avatar_url")
      .in("id", friendIds);

    if (usersError) {
      console.error("Friends list users fetch error:", usersError);
      return res.status(500).json({ error: "Failed to fetch friend details" });
    }

    const formattedFriends = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url || null,
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
      .select("id, username, avatar_url")
      .in("id", senderIds);

    if (usersError) {
      console.error("Get friend requests users fetch error:", usersError);
      return res.status(500).json({ error: "Failed to fetch requester details" });
    }

    const formattedRequests = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url || null,
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

module.exports = router;

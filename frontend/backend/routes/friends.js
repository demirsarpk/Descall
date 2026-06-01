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
      .from("friends")
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
        .from("friends")
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`);
    }

    // Create friend request
    const { error: insertError } = await supabase
      .from("friends")
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

    const { error: updateError } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("user_id", fromUserId)
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (updateError) {
      console.error("Accept friend error:", updateError);
      return res.status(500).json({ error: updateError.message || "Failed to accept friend request" });
    }

    // Sync socket memory so both sides see each other immediately
    const { friends: friendsMap } = require("../runtime/sharedState");
    if (!friendsMap.has(userId)) friendsMap.set(userId, new Set());
    if (!friendsMap.has(fromUserId)) friendsMap.set(fromUserId, new Set());
    friendsMap.get(userId).add(fromUserId);
    friendsMap.get(fromUserId).add(userId);

    // Notify both sides to refresh their friend list
    const io = req.app.get("io");
    if (io) {
      emitToUserViaIo(io, userId, "friend:accepted", { by: { id: fromUserId } });
      emitToUserViaIo(io, fromUserId, "friend:accepted", { by: { id: userId } });
    }

    res.json({ success: true, message: "Friend request accepted" });
  } catch (err) {
    console.error("Accept friend error:", err);
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
      .from("friends")
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
      .from("friends")
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
      .from("friends")
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
      .from("friends")
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

module.exports = router;

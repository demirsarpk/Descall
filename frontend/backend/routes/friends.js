const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

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

    // Check if already friends
    const { data: existingFriend } = await supabase
      .from("friends")
      .select("*")
      .or(`and(user_id.eq.${userId},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${userId})`)
      .maybeSingle();

    if (existingFriend) {
      return res.status(400).json({ error: "Already friends or request pending" });
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
      return res.status(500).json({ error: "Failed to send friend request" });
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

    // Update friend request status
    const { error: updateError } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("user_id", fromUserId)
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (updateError) {
      return res.status(500).json({ error: "Failed to accept friend request" });
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

    // Rows where current user sent the request — other party is friend_id
    const { data: sentRows, error: sentErr } = await supabase
      .from("friends")
      .select("friend_id, users!friends_friend_id_fkey (id, username, avatar_url)")
      .eq("user_id", userId)
      .eq("status", "accepted");

    // Rows where current user received the request — other party is user_id
    const { data: receivedRows, error: receivedErr } = await supabase
      .from("friends")
      .select("user_id, users!friends_user_id_fkey (id, username, avatar_url)")
      .eq("friend_id", userId)
      .eq("status", "accepted");

    if (sentErr || receivedErr) {
      console.error("Friends list error:", sentErr || receivedErr);
      return res.status(500).json({ error: "Failed to fetch friends" });
    }

    const seen = new Set();
    const formattedFriends = [];

    for (const row of (sentRows || [])) {
      const u = row.users;
      if (u && !seen.has(u.id)) {
        seen.add(u.id);
        formattedFriends.push({ id: u.id, username: u.username, avatarUrl: u.avatar_url });
      }
    }
    for (const row of (receivedRows || [])) {
      const u = row.users;
      if (u && !seen.has(u.id)) {
        seen.add(u.id);
        formattedFriends.push({ id: u.id, username: u.username, avatarUrl: u.avatar_url });
      }
    }

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

    const { data: requests, error } = await supabase
      .from("friends")
      .select(`
        user_id,
        users!friends_user_id_fkey (id, username, avatar_url)
      `)
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      return res.status(500).json({ error: "Failed to fetch friend requests" });
    }

    const formattedRequests = requests.map(r => ({
      id: r.users.id,
      username: r.users.username,
      avatarUrl: r.users.avatar_url
    }));

    res.json({ requests: formattedRequests });
  } catch (err) {
    console.error("Get friend requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

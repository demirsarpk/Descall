"use strict";

/**
 * DESCALL BACKEND - CLEAN VERSION
 * Simple, robust, error-proof
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const mediaRoutes = require("./routes/media");
const groupRoutes = require("./routes/groups");
const reactionRoutes = require("./routes/reactions");
const friendsRoutes = require("./routes/friends");
const activityRoutes = require("./routes/activity");
const guildRoutes = require("./routes/guilds");
const webrtcRoutes = require("./routes/webrtc");
const appReleaseRoutes = require("./routes/appRelease");
const errorRoutes = require("./routes/errors");
const callsRoutes = require("./routes/calls");
const lfgRoutes = require("./routes/lfg");
const riotRoutes = require("./routes/riot");
const { sitemapRouter } = require("./routes/sitemap");
const webPushRoutes = require("./routes/webPush");
const state = require("./runtime/sharedState");

// Inline feedback - no external file needed
const { requireAuth } = require("./middleware/auth");
const supabase = require("./db/supabase");

// Socket
const { socketAuthMiddleware } = require("./middleware/socketAuth");
const { registerSocketHandlers } = require("./socket/handlers");
const { cacheUserProfile, broadcastUserProfileUpdate, toPublicUser } = require("./lib/userProfile");
const { registerActivityHandlers } = require("./socket/activityHandlers");
const { registerGuildHandlers } = require("./socket/guildHandlers");
const { registerGameHandlers } = require("./socket/gameHandlers");

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"], credentials: false },
  transports: ["websocket", "polling"],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.set("io", io);

// Middleware
app.use(cors({ origin: true, credentials: false }));
app.use(express.json());
app.use("/api/web-push", webPushRoutes);

// Debug - log all requests (skip noise in production)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.path}`);
    next();
  });
}

const debugRoutesEnabled =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEBUG_ROUTES === "true";

// TEMP DEBUG: list all tables in public schema
if (debugRoutesEnabled) app.get("/debug/tables", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public");
    if (error) {
      // fallback: try raw SQL via rpc
      const { data: d2, error: e2 } = await supabase.rpc("list_tables");
      return res.json({ rpcResult: d2, rpcError: e2?.message, originalError: error?.message });
    }
    return res.json({ tables: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// TEMP DEBUG: show first 5 rows of any table
if (debugRoutesEnabled) app.get("/debug/peek/:tableName", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(req.params.tableName)
      .select("*")
      .limit(5);
    return res.json({ data, error: error?.message });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// API status (not served at / — root serves the React app)
app.get("/api/status", (_req, res) => {
  res.json({
    status: "ok",
    message: "Descall API",
    timestamp: new Date().toISOString(),
    version: "3.0.0"
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// SEO: robots + advanced sitemap (index, pages, invites, announcements, HTML)
app.use(sitemapRouter);

// Test endpoint - no auth required
app.post("/api/test", (req, res) => {
  console.log("[TEST] POST /api/test received");
  res.json({
    success: true,
    message: "Test endpoint works",
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// Register main routes (both with and without /api prefix)
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/media", mediaRoutes);
app.use("/groups", groupRoutes);
app.use("/reactions", reactionRoutes);
app.use("/friends", friendsRoutes);
app.use("/guilds", guildRoutes);
app.use("/calls", callsRoutes);
app.use("/lfg", lfgRoutes);
app.use("/riot", riotRoutes);

// /api/* aliases — frontend calls mix /api/... and /... so support both
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/reactions", reactionRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/guilds", guildRoutes);
app.use("/api/webrtc", webrtcRoutes);
app.use("/api/errors", errorRoutes);
app.use("/api/app", appReleaseRoutes);
app.use("/api/calls", callsRoutes);
app.use("/api/lfg", lfgRoutes);
app.use("/api/riot", riotRoutes);

// ============================================================================
// INLINE FEEDBACK ENDPOINTS - Direct in server.js (most reliable)
// ============================================================================

// Submit feedback - POST /api/feedback/submit
app.post("/api/feedback/submit", requireAuth, async (req, res) => {
  console.log("[FEEDBACK] POST /api/feedback/submit - START");
  console.log("[FEEDBACK] User:", req.user?.username);
  
  try {
    const { category, priority, message, attachments } = req.body;
    
    // Validation
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }
    
    // Prepare data
    const feedbackData = {
      user_id: String(req.user.id),
      username: req.user.username || "Anonymous",
      category: String(category || "general").toLowerCase(),
      priority: String(priority || "medium").toLowerCase(),
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      status: "new",
      viewed: false,
      admin_replies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log("[FEEDBACK] Inserting...");
    
    // Insert to Supabase
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(feedbackData)
      .select()
      .single();
    
    if (error) {
      console.error("[FEEDBACK] Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log("[FEEDBACK] SUCCESS! ID:", data?.id);
    
    return res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
      feedbackId: data?.id
    });
    
  } catch (err) {
    console.error("[FEEDBACK] ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// List feedback - GET /api/feedback/list
app.get("/api/feedback/list", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, feedback: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Mark as viewed - POST /api/feedback/:id/view
app.post("/api/feedback/:id/view", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from("user_feedback")
      .update({ viewed: true, viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin reply - POST /api/feedback/:id/reply
app.post("/api/feedback/:id/reply", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Reply message required" });
    }
    
    // Get current
    const { data: current, error: fetchError } = await supabase
      .from("user_feedback")
      .select("admin_replies")
      .eq("id", id)
      .single();
    
    if (fetchError) return res.status(500).json({ success: false, error: fetchError.message });
    
    // Add reply
    const replies = current?.admin_replies || [];
    replies.push({
      id: Date.now().toString(),
      admin_id: req.user.id,
      admin_username: req.user.username,
      message: message.trim(),
      created_at: new Date().toISOString()
    });
    
    // Update
    const { data, error } = await supabase
      .from("user_feedback")
      .update({ admin_replies: replies, status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.status(200).json({ success: true, feedback: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete feedback - DELETE /api/feedback/:id
app.delete("/api/feedback/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase.from("user_feedback").delete().eq("id", id);
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.status(200).json({ success: true, message: "Feedback deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ========== PROFILE SETTINGS ENDPOINTS ==========

// Update profile - PUT /api/user/profile
app.put("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const { displayName, bio, customStatus, accentColor, fontSize, uiDensity, bubbleStyle, avatarUrl, bannerUrl } = req.body;
    
    const updateData = {};
    if (displayName !== undefined) {
      const trimmed = typeof displayName === "string" ? displayName.trim() : "";
      updateData.display_name = trimmed || null;
    }
    if (bio !== undefined) updateData.bio = bio;
    if (customStatus !== undefined) updateData.custom_status = customStatus;
    if (accentColor !== undefined) updateData.accent_color = accentColor;
    if (fontSize !== undefined) updateData.font_size = fontSize;
    if (uiDensity !== undefined) updateData.ui_density = uiDensity;
    if (bubbleStyle !== undefined) updateData.bubble_style = bubbleStyle;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (bannerUrl !== undefined) updateData.banner_url = bannerUrl;
    if (avatarUrl !== undefined || displayName !== undefined || bio !== undefined || customStatus !== undefined) {
      updateData.updated_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", req.user.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });

    cacheUserProfile(data);
    const io = req.app.get("io");
    if (io) await broadcastUserProfileUpdate(io, req.user.id);

    return res.json({ success: true, user: toPublicUser(cacheUserProfile(data)) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update notification settings - PUT /api/user/notifications
app.put("/api/user/notifications", requireAuth, async (req, res) => {
  try {
    const { soundEnabled, soundVolume, desktopNotifications, callNotifications, mentionNotifications } = req.body;
    
    const updateData = {};
    if (soundEnabled !== undefined) updateData.sound_enabled = soundEnabled;
    if (soundVolume !== undefined) updateData.sound_volume = soundVolume;
    if (desktopNotifications !== undefined) updateData.desktop_notifications = desktopNotifications;
    if (callNotifications !== undefined) updateData.call_notifications = callNotifications;
    if (mentionNotifications !== undefined) updateData.mention_notifications = mentionNotifications;
    
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", req.user.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update privacy settings - PUT /api/user/privacy
app.put("/api/user/privacy", requireAuth, async (req, res) => {
  try {
    const { onlineStatusVisible, lastSeenVisible, typingIndicatorVisible, profileVisibleTo, allowFriendRequests, allowGroupInvites } = req.body;
    
    const updateData = {};
    if (onlineStatusVisible !== undefined) updateData.online_status_visible = onlineStatusVisible;
    if (lastSeenVisible !== undefined) updateData.last_seen_visible = lastSeenVisible;
    if (typingIndicatorVisible !== undefined) updateData.typing_indicator_visible = typingIndicatorVisible;
    if (profileVisibleTo !== undefined) updateData.profile_visible_to = profileVisibleTo;
    if (allowFriendRequests !== undefined) updateData.allow_friend_requests = allowFriendRequests;
    if (allowGroupInvites !== undefined) updateData.allow_group_invites = allowGroupInvites;
    
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", req.user.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update regional settings - PUT /api/user/regional
app.put("/api/user/regional", requireAuth, async (req, res) => {
  try {
    const { language, timezone } = req.body;
    
    const updateData = {};
    if (language !== undefined) updateData.language = language;
    if (timezone !== undefined) updateData.timezone = timezone;
    
    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", req.user.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ANNOUNCEMENTS ENDPOINTS ==========

// Get all active announcements - GET /api/announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, content, created_at, priority, color, emoji, pinned, target, author")
      .eq("is_active", true)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.json({ success: true, announcements: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create announcement - POST /api/admin/announcements
app.post("/api/admin/announcements", requireAuth, async (req, res) => {
  try {
    const { data: requester } = await supabase
      .from("users")
      .select("username, is_admin")
      .eq("id", req.user.id)
      .single();
    
    const isAdmin = requester?.is_admin || req.user.username === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    
    const { title, content, priority = "normal", color = "#5865F2", emoji = "📢", pinned = false, target = "all" } = req.body;
    
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, error: "Title and content are required" });
    }

    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: title.trim(),
        content: content.trim(),
        created_by: req.user.id,
        author: requester.username,
        priority,
        color,
        emoji,
        pinned,
        target,
      })
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    // Broadcast to all connected users
    const io = req.app.get("io");
    io.emit("announcement:new", data);
    
    return res.json({ success: true, announcement: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle pin on announcement - PATCH /api/admin/announcements/:id
app.patch("/api/admin/announcements/:id", requireAuth, async (req, res) => {
  try {
    const { data: requester } = await supabase
      .from("users")
      .select("username, is_admin")
      .eq("id", req.user.id)
      .single();
    
    const isAdmin = requester?.is_admin || req.user.username === "admin";
    if (!isAdmin) return res.status(403).json({ success: false, error: "Not authorized" });

    const { pinned } = req.body;
    if (typeof pinned !== "boolean") {
      return res.status(400).json({ success: false, error: "pinned must be a boolean" });
    }

    const { data, error } = await supabase
      .from("announcements")
      .update({ pinned })
      .eq("id", req.params.id)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });

    const io = req.app.get("io");
    io.emit("announcement:updated", data);

    return res.json({ success: true, announcement: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete announcement - DELETE /api/admin/announcements/:id
app.delete("/api/admin/announcements/:id", requireAuth, async (req, res) => {
  try {
    const { data: requester } = await supabase
      .from("users")
      .select("username, is_admin")
      .eq("id", req.user.id)
      .single();
    
    const isAdmin = requester?.is_admin || req.user.username === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: false })
      .eq("id", req.params.id);
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    // Broadcast deletion
    const io = req.app.get("io");
    io.emit("announcement:deleted", { id: req.params.id });
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Mark announcement as read - POST /api/announcements/:id/read
app.post("/api/announcements/:id/read", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("announcement_reads")
      .upsert({
        user_id: req.user.id,
        announcement_id: req.params.id,
        read_at: new Date().toISOString(),
      }, { onConflict: ["user_id", "announcement_id"] });
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get unread announcement count - GET /api/announcements/unread/count
app.get("/api/announcements/unread/count", requireAuth, async (req, res) => {
  try {
    // Get all active announcements
    const { data: announcements, error: annError } = await supabase
      .from("announcements")
      .select("id")
      .eq("is_active", true);
    
    if (annError) return res.status(500).json({ success: false, error: annError.message });
    
    // Get read announcements for this user
    const { data: reads, error: readError } = await supabase
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", req.user.id);
    
    if (readError) return res.status(500).json({ success: false, error: readError.message });
    
    const readIds = new Set((reads || []).map((r) => r.announcement_id));
    const unreadCount = (announcements || []).filter((a) => !readIds.has(a.id)).length;
    
    return res.json({ success: true, count: unreadCount });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ADMIN ENDPOINTS ==========

// Make user admin - PUT /api/admin/make-admin/:userId
app.put("/api/admin/make-admin/:userId", requireAuth, async (req, res) => {
  try {
    // Check if requester is admin (by username or is_admin field)
    const { data: requester } = await supabase
      .from("users")
      .select("username, is_admin")
      .eq("id", req.user.id)
      .single();
    
    const isAdmin = requester?.is_admin || req.user.username === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from("users")
      .update({ is_admin: true })
      .eq("id", userId)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    // Notify the user via Socket.IO to refresh their data
    const io = req.app.get("io");
    io.to(`user:${userId}`).emit("user:updated", { is_admin: true });
    
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Remove admin - PUT /api/admin/remove-admin/:userId
app.put("/api/admin/remove-admin/:userId", requireAuth, async (req, res) => {
  try {
    // Check if requester is admin (by username or is_admin field)
    const { data: requester } = await supabase
      .from("users")
      .select("username, is_admin")
      .eq("id", req.user.id)
      .single();
    
    const isAdmin = requester?.is_admin || req.user.username === "admin";
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from("users")
      .update({ is_admin: false })
      .eq("id", userId)
      .select()
      .single();
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    return res.json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get all users - GET /api/admin/users
app.get("/api/admin/users", requireAuth, async (req, res) => {
  try {
    console.log("[ADMIN-USERS] Request from user ID:", req.user.id);
    console.log("[ADMIN-USERS] Token username:", req.user.username);
    
    // Check if requester is admin (by username or is_admin field)
    const { data: requester } = await supabase
      .from("users")
      .select("username, is_admin")
      .eq("id", req.user.id)
      .single();
    
    console.log("[ADMIN-USERS] Requester from DB:", requester);
    
    // Use token username if DB lookup fails
    const isAdmin = requester?.is_admin || req.user.username === "admin";
    
    if (!isAdmin) {
      console.log("[ADMIN-USERS] Authorization failed - is_admin:", requester?.is_admin, "username:", req.user.username);
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    
    const { data, error, count } = await supabase
      .from("users")
      .select("id, username, avatar_url, is_admin, created_at", { count: "exact" })
      .order("username", { ascending: true });
    
    if (error) return res.status(500).json({ success: false, error: error.message });
    
    // Add online status from Socket.IO presence
    const state = require("./runtime/sharedState");
    const usersWithStatus = (data || []).map(user => ({
      ...user,
      isOnline: state.presence.has(user.id),
      status: state.presence.get(user.id)?.status || "offline"
    }));
    
    console.log("[ADMIN-USERS] Returning", usersWithStatus.length, "users");
    return res.json({
      success: true,
      users: usersWithStatus,
      total: count ?? usersWithStatus.length,
    });
  } catch (err) {
    console.error("[ADMIN-USERS] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

console.log("[SERVER] Routes registered:");
console.log("  - /auth");
console.log("  - /admin");
console.log("  - /media");
console.log("  - /groups");
console.log("  - /api/feedback");
console.log("  - /api/announcements");
console.log("  - /api/admin/announcements");
console.log("  - /api/user/profile");
console.log("  - /api/user/notifications");
console.log("  - /api/user/privacy");
console.log("  - /api/user/regional");
console.log("  - /api/admin/make-admin/:userId");
console.log("  - /api/admin/remove-admin/:userId");
console.log("  - /api/admin/users");
console.log("  - /api/test (no auth)");
console.log("  - /api/status");
console.log("  - /health");
console.log("  - /robots.txt");
console.log("  - /sitemap.xml (+ pages/html; invites/announcements excluded from index)");

// Static files
app.use("/media/files", express.static(path.join(__dirname, "uploads")));

// Discord-style invite deep links → root query.
// Vite builds with base "./", so serving the SPA under /invite/:code breaks
// relative asset URLs (./assets/...) and leaves the boot splash stuck.
app.get(["/invite/:code", "/i/:code"], (req, res) => {
  const code = String(req.params.code || "").trim();
  if (!code) return res.redirect(302, "/");
  return res.redirect(302, `/?invite=${encodeURIComponent(code)}`);
});

// Serve React frontend (Vite build output: frontend/dist)
const fs = require("fs");
const distPath = path.join(__dirname, "..", "dist");
const indexPath = path.join(distPath, "index.html");
const hasFrontend = fs.existsSync(indexPath);

const API_PREFIXES = [
  "/api", "/auth", "/admin", "/media", "/groups",
  "/friends", "/guilds", "/reactions", "/health", "/debug", "/lfg", "/calls", "/riot",
  "/sitemap.xml", "/sitemap-pages.xml", "/sitemap-invites.xml",
  "/sitemap-announcements.xml", "/sitemap.html", "/sitemap.xsl", "/robots.txt",
];

if (hasFrontend) {
  console.log("[STATIC] Serving frontend from:", distPath);
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (API_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
      return next();
    }
    res.sendFile(indexPath);
  });
} else {
  console.warn("[STATIC] frontend/dist/index.html not found — run: cd frontend && npm run build:prod");
  app.get("/", (_req, res) => {
    res.status(503).json({
      status: "error",
      message: "Frontend not built. Deploy must run: cd frontend && npm install --include=dev && npm run build:prod",
    });
  });
}

// 404 handler
app.use((_req, res) => {
  console.log("[404]", _req.method, _req.path);
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: err.message || "Internal error" });
});

// Socket.IO
io.use(socketAuthMiddleware);
io.engine.on("connection_error", () => {});
registerSocketHandlers(io);

// Activity handlers run on every authenticated socket connection
// (registerSocketHandlers already sets up the main io.on('connection') listener;
//  we attach ours after, which is safe — multiple listeners are allowed)
io.on('connection', (socket) => {
  if (socket.user) {
    registerActivityHandlers(io, socket);
    registerGuildHandlers(io, socket);
    registerGameHandlers(io, socket);
  }
});

// Start server
console.log("=== Descall Backend v3.0 ===");
console.log("PORT:", PORT);
console.log("ENV check:");
console.log("  SUPABASE_URL:", !!process.env.SUPABASE_URL);
console.log("  SUPABASE_SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("  JWT_SECRET:", !!process.env.JWT_SECRET);

async function loadBannedUsersFromDb() {
  try {
    const { data, error } = await supabase.from("users").select("id").eq("is_banned", true);
    if (error) {
      console.warn("[boot] Could not load banned users:", error.message);
      return;
    }
    for (const row of data || []) {
      if (row?.id) state.bannedUserIds.add(String(row.id));
    }
    console.log("[boot] Loaded banned users:", state.bannedUserIds.size);
  } catch (e) {
    console.warn("[boot] loadBannedUsersFromDb:", e.message);
  }
}

httpServer.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await loadBannedUsersFromDb();
});

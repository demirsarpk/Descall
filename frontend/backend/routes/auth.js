const express = require("express");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const supabase = require("../db/supabase");
const { signToken } = require("../config/jwt");
const { requireAuth } = require("../middleware/auth");
const { userLastLoginAt } = require("../runtime/sharedState");

const { toPublicUser } = require("../lib/userProfile");
const { publicRiotCard } = require("../lib/riotLink");

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function loadPublicValorant(userId) {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from("user_riot_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data || data.card_public === false) return null;
    return publicRiotCard(data);
  } catch {
    return null;
  }
}

function authUserPayload(user) {
  const displayName = user.display_name || user.displayName || null;
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url || null,
    avatar_url: user.avatar_url || null,
    displayName,
    display_name: displayName,
    bio: user.bio || null,
    customStatus: user.custom_status || user.customStatus || null,
    bannerUrl: user.banner_url || user.bannerUrl || null,
    updated_at: user.updated_at || null,
  };
}

function sanitizeUsernameBase(raw) {
  const cleaned = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/^[_.-]+|[_.-]+$/g, "")
    .slice(0, 20);
  return cleaned.length >= 2 ? cleaned : "user";
}

async function allocateUniqueUsername(preferredBase) {
  const base = sanitizeUsernameBase(preferredBase);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 16)}${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: existing, error } = await supabase
      .from("users")
      .select("id")
      .ilike("username", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!existing) return candidate;
  }
  return `user${Date.now().toString(36).slice(-8)}`;
}

function validateUsername(username) {
  if (typeof username !== "string") return "Username must be a string.";
  const trimmed = username.trim();
  if (trimmed.length < 2) return "Username must be at least 2 characters.";
  if (trimmed.length > 24) return "Username must be at most 24 characters.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed))
    return "Username may only contain letters, numbers, underscores, hyphens, and dots.";
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string") return "Password must be a string.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  return null;
}

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const cleanUsername = username.trim();

    const { data: existing, error: lookupError } = await supabase
      .from("users")
      .select("id")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (lookupError) {
      return res.status(500).json({ error: "Internal server error." });
    }

    if (existing) {
      return res.status(409).json({ error: "Username is already taken." });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({ username: cleanUsername, password_hash })
      .select("id, username, avatar_url")
      .single();

    if (insertError) {
      return res.status(500).json({ error: "Failed to create user." });
    }

    return res.status(201).json({
      message: "User registered successfully.",
      user: { id: newUser.id, username: newUser.username, avatarUrl: newUser.avatar_url || null },
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    console.log("[AUTH] Login request received:", { username, hasPassword: !!password });

    if (!username || !password) {
      console.log("[AUTH] Missing credentials");
      return res.status(400).json({ error: "Username and password are required." });
    }

    if (typeof username !== "string" || typeof password !== "string") {
      console.log("[AUTH] Invalid types:", typeof username, typeof password);
      return res.status(400).json({ error: "Invalid request body." });
    }

    const cleanUsername = username.trim();
    console.log("[AUTH] Login attempt for:", cleanUsername, "password length:", password.length);

    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, username, password_hash, avatar_url, display_name, bio, custom_status, banner_url, updated_at, auth_provider")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (lookupError) {
      console.error("[AUTH] Supabase lookup error:", lookupError);
      return res.status(500).json({ error: "Database error." });
    }

    console.log("[AUTH] User found:", !!user);
    if (user) {
      console.log("[AUTH] User details:", { id: user.id, username: user.username, hasHash: !!user.password_hash });
    }

    if (user && !user.password_hash) {
      return res.status(401).json({
        error: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    const dummyHash = "$2a$12$invalidhashfortimingprotection000000000000000000000000";
    const hashToCompare = user?.password_hash || dummyHash;

    const passwordMatch = await bcrypt.compare(password, hashToCompare);
    console.log("[AUTH] Password match result:", passwordMatch);

    if (!user || !passwordMatch) {
      console.log("[AUTH] Login failed - user exists:", !!user, "password match:", passwordMatch);
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = signToken({ id: user.id, username: user.username });

    userLastLoginAt.set(user.id, new Date().toISOString());

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: authUserPayload(user),
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
});

router.post("/google", async (req, res) => {
  try {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        error: "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID on the server.",
      });
    }

    const credential = req.body?.credential;
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ error: "Google credential is required." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid Google token." });
    }

    const googleId = payload.sub;
    const email = payload.email ? String(payload.email).trim().toLowerCase() : null;
    const emailVerified = Boolean(payload.email_verified);
    const picture = payload.picture || null;
    const displayName = payload.name || null;

    if (email && !emailVerified) {
      return res.status(401).json({ error: "Google email is not verified." });
    }

    let { data: user, error: byGoogleError } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, google_id, auth_provider")
      .eq("google_id", googleId)
      .maybeSingle();

    if (byGoogleError) {
      console.error("[AUTH] Google lookup error:", byGoogleError);
      return res.status(500).json({ error: "Database error." });
    }

    if (!user && email) {
      const { data: byEmail, error: byEmailError } = await supabase
        .from("users")
        .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, google_id, auth_provider")
        .ilike("email", email)
        .maybeSingle();

      if (byEmailError) {
        console.error("[AUTH] Email lookup error:", byEmailError);
        return res.status(500).json({ error: "Database error." });
      }

      if (byEmail) {
        if (byEmail.google_id && byEmail.google_id !== googleId) {
          return res.status(409).json({ error: "Email is already linked to another account." });
        }

        const linkUpdate = {
          google_id: googleId,
          email,
          auth_provider: byEmail.auth_provider === "local" ? "local+google" : "google",
          avatar_url: byEmail.avatar_url || picture,
        };
        if (displayName) linkUpdate.display_name = displayName;

        const { data: linked, error: linkError } = await supabase
          .from("users")
          .update(linkUpdate)
          .eq("id", byEmail.id)
          .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at")
          .single();

        if (linkError || !linked) {
          console.error("[AUTH] Google link error:", linkError);
          return res.status(500).json({ error: "Failed to link Google account." });
        }
        user = linked;
      }
    }

    if (!user) {
      const preferred =
        (email && email.split("@")[0]) ||
        payload.given_name ||
        displayName ||
        `user${googleId.slice(-6)}`;
      const username = await allocateUniqueUsername(preferred);

      const insertPayload = {
        username,
        password_hash: null,
        email,
        google_id: googleId,
        auth_provider: "google",
        avatar_url: picture,
        display_name: displayName,
      };

      const { data: created, error: insertError } = await supabase
        .from("users")
        .insert(insertPayload)
        .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at")
        .single();

      if (insertError || !created) {
        console.error("[AUTH] Google register error:", insertError);
        const hint =
          insertError?.message?.includes("google_id") || insertError?.code === "42703"
            ? " Run supabase/migrations/20260729_add_google_oauth_columns.sql first."
            : "";
        return res.status(500).json({ error: `Failed to create Google user.${hint}` });
      }
      user = created;
    }

    const token = signToken({ id: user.id, username: user.username });
    userLastLoginAt.set(user.id, new Date().toISOString());

    return res.status(200).json({
      message: "Google login successful.",
      token,
      user: authUserPayload(user),
    });
  } catch (err) {
    console.error("[AUTH] Google login error:", err);
    return res.status(401).json({ error: "Google Sign-In failed.", details: err.message });
  }
});

router.get("/google/config", (_req, res) => {
  return res.json({
    enabled: Boolean(GOOGLE_CLIENT_ID),
    clientId: GOOGLE_CLIENT_ID || null,
  });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, is_admin, updated_at, created_at, language")
      .eq("id", req.user.id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valorant = await loadPublicValorant(user.id);
    return res.status(200).json({ user: { ...toPublicUser(user), valorant } });
  } catch (err) {
    console.error("[AUTH] /me error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, created_at")
      .eq("id", userId)
      .single();

    if (error || !user) return res.status(404).json({ error: "User not found" });

    const valorant = await loadPublicValorant(user.id);
    return res.json({
      user: {
        ...toPublicUser(user),
        createdAt: user.created_at,
        valorant,
      },
    });
  } catch (err) {
    console.error("[AUTH] /users/:userId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/test", async (_req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("count").limit(1);
    if (error) {
      return res.status(500).json({ status: "db_error", error: error.message });
    }
    return res.json({ status: "ok", message: "Auth service running" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;

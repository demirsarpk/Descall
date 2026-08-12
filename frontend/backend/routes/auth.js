const express = require("express");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const supabase = require("../db/supabase");
const { signToken, signPending2faToken, verifyToken } = require("../config/jwt");
const { requireAuth } = require("../middleware/auth");
const { revokedSessionIds, authCodeAttempts } = require("../runtime/sharedState");
const { sendEmail, generateCode, codeEmailHtml } = require("../lib/mailer");
const { hashCode, verifyStoredCode } = require("../lib/authCodes");
const { createSession, listSessions, removeSession, removeOtherSessions, clientIp } = require("../lib/sessions");
const { touchLastSeen } = require("../lib/presenceTouch");
const shop = require("../lib/shop");

const { toPublicUser } = require("../lib/userProfile");
const { publicRiotCard } = require("../lib/riotLink");
const moderation = require("../lib/moderation");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_BAN_COLS =
  "is_banned, ban_category, ban_reason, ban_message, banned_at, ban_expires_at";

async function rejectIfBanned(res, user) {
  if (!user?.is_banned) return false;
  const expired = user.ban_expires_at && new Date(user.ban_expires_at).getTime() <= Date.now();
  if (expired) {
    await moderation.revokeBan({ targetUserId: user.id, actorUserId: null, note: "Expired ban auto-clear" }).catch(() => {});
    return false;
  }
  const ban = moderation.publicBanPayload(user);
  res.status(403).json({
    error: "Account is banned.",
    code: "ACCOUNT_BANNED",
    ban: ban
      ? {
          category: ban.category,
          reason: ban.reason,
          message: ban.message,
          bannedAt: ban.bannedAt,
          expiresAt: ban.expiresAt,
        }
      : {
          category: user.ban_category || "other",
          reason: user.ban_reason || null,
          message: user.ban_message || null,
          bannedAt: user.banned_at || null,
          expiresAt: user.ban_expires_at || null,
        },
  });
  return true;
}

function attemptKey(userId, purpose) {
  return `${userId}:${purpose}`;
}

async function issueAndSendCode({ userId, email, username, purpose, column, sentAtColumn, title, footer }) {
  const code = generateCode();
  const update = { [column]: hashCode(code), [sentAtColumn]: new Date().toISOString() };
  await supabase.from("users").update(update).eq("id", userId);
  authCodeAttempts.set(attemptKey(userId, purpose), 0);
  const result = await sendEmail({
    to: email,
    subject: title,
    text: `Your Descall verification code is ${code}. It expires in 10 minutes.`,
    html: codeEmailHtml({ title, code, minutes: 10, footer }),
  });
  if (!result.sent && !result.skipped) {
    console.warn(`[AUTH] ${purpose} email failed for`, username, result.error);
  }
  return result;
}

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

function authUserPayload(user, extra = {}) {
  const displayName = user.display_name || user.displayName || null;
  const isAdmin = Boolean(user.is_admin) || user.username === "admin";
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
    is_admin: isAdmin,
    isAdmin,
    email: user.email || null,
    emailVerified: Boolean(user.email_confirmed_at),
    twoFactorEnabled: Boolean(user.two_factor_enabled),
    descoinBalance: Number(user.descoin_balance) || 0,
    equippedAvatarFrame: extra.equippedAvatarFrame || null,
    equippedBanner: extra.equippedBanner || null,
    equippedBackground: extra.equippedBackground || null,
    equippedTheme: extra.equippedTheme || null,
    equippedBadge: extra.equippedBadge || null,
    equippedTitle: extra.equippedTitle || null,
    equippedNameEffect: extra.equippedNameEffect || null,
    equippedAvatarEffect: extra.equippedAvatarEffect || null,
    equippedChatBubble: extra.equippedChatBubble || null,
    equippedPresenceFlare: extra.equippedPresenceFlare || null,
    equippedProfileAura: extra.equippedProfileAura || null,
    equippedSoundPack: extra.equippedSoundPack || null,
    equippedTypingFlare: extra.equippedTypingFlare || null,
    equippedReactionBurst: extra.equippedReactionBurst || null,
    equippedCallOverlay: extra.equippedCallOverlay || null,
  };
}

/** Resolves equipped cosmetics for a freshly-authenticated user (login / 2FA / Google) — same shape as GET /me. */
async function resolveEquippedExtra(userId) {
  const equipped = await shop.getEquippedCosmeticsForUser(userId).catch(() => ({}));
  return {
    equippedAvatarFrame: equipped.avatarFrame || null,
    equippedBanner: equipped.banner || null,
    equippedBackground: equipped.background || null,
    equippedTheme: equipped.theme || null,
    equippedBadge: equipped.badge || null,
    equippedTitle: equipped.title || null,
    equippedNameEffect: equipped.nameEffect || null,
    equippedAvatarEffect: equipped.avatarEffect || null,
    equippedChatBubble: equipped.chatBubble || null,
    equippedPresenceFlare: equipped.presenceFlare || null,
    equippedProfileAura: equipped.profileAura || null,
    equippedSoundPack: equipped.soundPack || null,
    equippedTypingFlare: equipped.typingFlare || null,
    equippedReactionBurst: equipped.reactionBurst || null,
    equippedCallOverlay: equipped.callOverlay || null,
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

/**
 * Personal invite loop: when a new user registers with invitedBy=<username>,
 * auto-accept friendship so both land with a real connection (not a pending ask).
 * First successful link also pays DesCoin to inviter + invitee (once per invitee).
 */
async function grantReferralDesCoin(inviterId, inviteeId, io) {
  const descoin = require("../lib/descoin");
  const inviterAmount = descoin.REFERRAL_INVITER_REWARD;
  const inviteeAmount = descoin.REFERRAL_INVITEE_REWARD;

  const { error: insertError } = await supabase.from("referral_rewards").insert({
    inviter_id: inviterId,
    invitee_id: inviteeId,
    inviter_amount: inviterAmount,
    invitee_amount: inviteeAmount,
  });
  // Unique(invitee_id) — already rewarded this user.
  if (insertError) {
    if (insertError.code === "23505") return { rewarded: false };
    console.warn("[AUTH] referral_rewards insert failed:", insertError.message);
    return { rewarded: false };
  }

  await supabase.from("users").update({ referred_by: inviterId }).eq("id", inviteeId).is("referred_by", null);

  const [inviterCredit, inviteeCredit] = await Promise.all([
    descoin.credit(inviterId, inviterAmount, "referral_invite", { inviteeId }),
    descoin.credit(inviteeId, inviteeAmount, "referral_welcome", { inviterId }),
  ]);

  if (io) {
    try {
      io.to(`user:${inviterId}`).emit("descoin:balance", {
        balance: inviterCredit.balance,
        delta: inviterCredit.credited,
        reason: "referral_invite",
      });
      io.to(`user:${inviteeId}`).emit("descoin:balance", {
        balance: inviteeCredit.balance,
        delta: inviteeCredit.credited,
        reason: "referral_welcome",
      });
    } catch {
      /* ignore */
    }
  }

  return {
    rewarded: true,
    inviterAmount,
    inviteeAmount,
  };
}

async function applyFriendInvite(newUserId, invitedByRaw, io) {
  const invitedBy = String(invitedByRaw || "")
    .trim()
    .replace(/^@/, "");
  if (!newUserId || !invitedBy || invitedBy.length < 2 || invitedBy.length > 24) {
    return { linked: false };
  }

  const { data: inviter, error } = await supabase
    .from("users")
    .select("id, username")
    .ilike("username", invitedBy)
    .maybeSingle();

  if (error || !inviter || inviter.id === newUserId) {
    return { linked: false };
  }

  const { data: existingRows } = await supabase
    .from("friendships")
    .select("id, status")
    .or(
      `and(user_id.eq.${newUserId},friend_id.eq.${inviter.id}),and(user_id.eq.${inviter.id},friend_id.eq.${newUserId})`
    );

  const alreadyFriends = (existingRows || []).some((r) => r.status === "accepted");

  if (!alreadyFriends) {
    if (existingRows?.length) {
      await supabase
        .from("friendships")
        .delete()
        .or(
          `and(user_id.eq.${newUserId},friend_id.eq.${inviter.id}),and(user_id.eq.${inviter.id},friend_id.eq.${newUserId})`
        );
    }

    const { error: insertError } = await supabase.from("friendships").insert({
      user_id: newUserId,
      friend_id: inviter.id,
      status: "accepted",
    });

    if (insertError) {
      console.warn("[AUTH] invite friendship insert failed:", insertError.message);
      return { linked: false, inviterUsername: inviter.username, inviterId: inviter.id };
    }

    try {
      const { friends: friendsMap } = require("../runtime/sharedState");
      if (!friendsMap.has(newUserId)) friendsMap.set(newUserId, new Set());
      if (!friendsMap.has(inviter.id)) friendsMap.set(inviter.id, new Set());
      friendsMap.get(newUserId).add(inviter.id);
      friendsMap.get(inviter.id).add(newUserId);
    } catch {
      /* ignore runtime sync */
    }

    if (io) {
      try {
        io.to(`user:${newUserId}`).emit("friend:accepted", { by: { id: inviter.id, username: inviter.username } });
        io.to(`user:${inviter.id}`).emit("friend:accepted", { by: { id: newUserId } });
      } catch {
        /* ignore */
      }
    }
  }

  let reward = { rewarded: false };
  try {
    reward = await grantReferralDesCoin(inviter.id, newUserId, io);
  } catch (err) {
    console.warn("[AUTH] referral DesCoin reward failed:", err?.message || err);
  }

  return {
    linked: true,
    inviterUsername: inviter.username,
    inviterId: inviter.id,
    referralRewarded: Boolean(reward.rewarded),
    referralInviterAmount: reward.inviterAmount || 0,
    referralInviteeAmount: reward.inviteeAmount || 0,
  };
}

router.post("/register", async (req, res) => {
  try {
    const { username, password, email: rawEmail, termsAccepted, invitedBy } = req.body ?? {};

    if (!termsAccepted) {
      return res.status(400).json({ error: "You must accept the Terms of Service and Privacy Policy to register." });
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
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

    if (email) {
      const { data: emailTaken } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .not("email_confirmed_at", "is", null)
        .maybeSingle();
      if (emailTaken) {
        return res.status(409).json({ error: "Email is already in use." });
      }
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({ username: cleanUsername, password_hash, email, terms_accepted_at: new Date().toISOString() })
      .select("id, username, avatar_url")
      .single();

    if (insertError) {
      return res.status(500).json({ error: "Failed to create user." });
    }

    let emailSent = false;
    if (email) {
      const result = await issueAndSendCode({
        userId: newUser.id,
        email,
        username: cleanUsername,
        purpose: "email_verify",
        column: "confirmation_token",
        sentAtColumn: "confirmation_sent_at",
        title: "Verify your Descall email",
        footer: "Welcome to Descall! Enter this code in the app to verify your email address.",
      }).catch(() => ({ sent: false }));
      emailSent = Boolean(result?.sent);
    }

    const invite = await applyFriendInvite(newUser.id, invitedBy, req.app.get("io")).catch((err) => {
      console.warn("[AUTH] invite apply failed:", err?.message);
      return { linked: false };
    });

    return res.status(201).json({
      message: "User registered successfully.",
      user: { id: newUser.id, username: newUser.username, avatarUrl: newUser.avatar_url || null },
      needsEmailVerification: Boolean(email),
      verificationEmailSent: emailSent,
      invitedBy: invite.inviterUsername || null,
      inviteLinked: Boolean(invite.linked),
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
      .select(
        "id, username, password_hash, avatar_url, display_name, bio, custom_status, banner_url, updated_at, auth_provider, email, email_confirmed_at, two_factor_enabled, is_admin, descoin_balance, is_banned, ban_category, ban_reason, ban_message, banned_at, ban_expires_at"
      )
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

    if (await rejectIfBanned(res, user)) return;

    if (user.two_factor_enabled && user.email_confirmed_at && user.email) {
      const result = await issueAndSendCode({
        userId: user.id,
        email: user.email,
        username: user.username,
        purpose: "2fa_login",
        column: "reauthentication_token",
        sentAtColumn: "reauthentication_sent_at",
        title: "Your Descall sign-in code",
        footer: "Enter this code to finish signing in to Descall.",
      }).catch(() => ({ sent: false, error: "send_failed" }));

      if (!result.sent) {
        console.error("[AUTH] 2FA code email failed for", user.username, result.error);
        return res.status(503).json({ error: "Could not send your sign-in code. Please try again shortly." });
      }

      return res.status(200).json({
        message: "Two-factor code sent.",
        requires2fa: true,
        pendingToken: signPending2faToken({ id: user.id, username: user.username }),
        emailHint: maskEmail(user.email),
      });
    }

    const { session } = await createSession(user.id, {
      userAgent: req.headers["user-agent"],
      ip: clientIp(req),
    });
    const token = signToken({ id: user.id, username: user.username, sid: session.id });

    await touchLastSeen(user.id, { force: true });

    return res.status(200).json({
      message: "Login successful.",
      token,
      sessionId: session.id,
      user: authUserPayload(user, await resolveEquippedExtra(user.id)),
    });
  } catch (err) {
    console.error("[AUTH] Login error:", err);
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
});

router.post("/2fa/verify-login", async (req, res) => {
  try {
    const { pendingToken, code } = req.body ?? {};
    if (!pendingToken || !code) {
      return res.status(400).json({ error: "Code is required." });
    }

    let decoded;
    try {
      decoded = verifyToken(pendingToken);
    } catch {
      return res.status(401).json({ error: "Sign-in session expired. Please log in again." });
    }
    if (!decoded.pending2fa || !decoded.sub) {
      return res.status(401).json({ error: "Invalid sign-in session." });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, email_confirmed_at, two_factor_enabled, reauthentication_token, reauthentication_sent_at, is_admin, descoin_balance"
      )
      .eq("id", decoded.sub)
      .maybeSingle();
    if (error || !user) return res.status(401).json({ error: "Invalid sign-in session." });

    const key = attemptKey(user.id, "2fa_login");
    const attempts = authCodeAttempts.get(key) || 0;
    const verdict = verifyStoredCode({
      code,
      storedHash: user.reauthentication_token,
      sentAtIso: user.reauthentication_sent_at,
      attempts,
    });
    if (!verdict.ok) {
      authCodeAttempts.set(key, attempts + 1);
      const message =
        verdict.reason === "expired"
          ? "Code expired. Please log in again to request a new one."
          : verdict.reason === "too_many_attempts"
          ? "Too many incorrect attempts. Please log in again."
          : "Incorrect code.";
      return res.status(401).json({ error: message });
    }

    authCodeAttempts.delete(key);
    await supabase
      .from("users")
      .update({ reauthentication_token: null, reauthentication_sent_at: null })
      .eq("id", user.id);

    const { session } = await createSession(user.id, {
      userAgent: req.headers["user-agent"],
      ip: clientIp(req),
    });
    const token = signToken({ id: user.id, username: user.username, sid: session.id });
    await touchLastSeen(user.id, { force: true });

    return res.status(200).json({
      message: "Login successful.",
      token,
      sessionId: session.id,
      user: authUserPayload(user, await resolveEquippedExtra(user.id)),
    });
  } catch (err) {
    console.error("[AUTH] 2FA verify error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}

router.post("/google", async (req, res) => {
  try {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        error: "Google Sign-In is not configured. Set GOOGLE_CLIENT_ID on the server.",
      });
    }

    const credential = req.body?.credential;
    const invitedBy = req.body?.invitedBy;
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

    let isNewUser = false;
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
      .select(`id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, google_id, auth_provider, email_confirmed_at, two_factor_enabled, is_admin, descoin_balance, ${USER_BAN_COLS}`)
      .eq("google_id", googleId)
      .maybeSingle();

    if (byGoogleError) {
      console.error("[AUTH] Google lookup error:", byGoogleError);
      return res.status(500).json({ error: "Database error." });
    }

    if (!user && email) {
      const { data: byEmail, error: byEmailError } = await supabase
        .from("users")
        .select(`id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, google_id, auth_provider, email_confirmed_at, two_factor_enabled, is_admin, descoin_balance, ${USER_BAN_COLS}`)
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
          email_confirmed_at: byEmail.email_confirmed_at || new Date().toISOString(),
          auth_provider: byEmail.auth_provider === "local" ? "local+google" : "google",
          avatar_url: byEmail.avatar_url || picture,
        };
        if (displayName) linkUpdate.display_name = displayName;

        const { data: linked, error: linkError } = await supabase
          .from("users")
          .update(linkUpdate)
          .eq("id", byEmail.id)
          .select(`id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, email_confirmed_at, two_factor_enabled, is_admin, descoin_balance, ${USER_BAN_COLS}`)
          .single();

        if (linkError || !linked) {
          console.error("[AUTH] Google link error:", linkError);
          return res.status(500).json({ error: "Failed to link Google account." });
        }
        user = linked;
      }
    }

    if (user && (await rejectIfBanned(res, user))) return;

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
        email_confirmed_at: email ? new Date().toISOString() : null,
        google_id: googleId,
        auth_provider: "google",
        avatar_url: picture,
        display_name: displayName,
      };

      const { data: created, error: insertError } = await supabase
        .from("users")
        .insert(insertPayload)
        .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, email, email_confirmed_at, two_factor_enabled, is_admin, descoin_balance")
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
      isNewUser = true;
    }

    let invite = { linked: false };
    if (isNewUser) {
      invite = await applyFriendInvite(user.id, invitedBy, req.app.get("io")).catch((err) => {
        console.warn("[AUTH] Google invite apply failed:", err?.message);
        return { linked: false };
      });
    }

    const { session } = await createSession(user.id, {
      userAgent: req.headers["user-agent"],
      ip: clientIp(req),
    });
    const token = signToken({ id: user.id, username: user.username, sid: session.id });
    await touchLastSeen(user.id, { force: true });

    return res.status(200).json({
      message: "Google login successful.",
      token,
      sessionId: session.id,
      user: authUserPayload(user, await resolveEquippedExtra(user.id)),
      isNewUser,
      invitedBy: invite.inviterUsername || null,
      inviteLinked: Boolean(invite.linked),
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
      .select(
        "id, username, avatar_url, display_name, bio, custom_status, banner_url, is_admin, updated_at, created_at, language, email, email_confirmed_at, two_factor_enabled, blocked_users, equipped_avatar_frame_id, equipped_banner_id, equipped_background_id, equipped_theme_id, descoin_balance"
      )
      .eq("id", req.user.id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valorant = await loadPublicValorant(user.id);
    const equipped = await shop.getEquippedCosmeticsForUser(user.id).catch(() => ({}));
    return res.status(200).json({
      user: {
        ...toPublicUser(user),
        valorant,
        email: user.email || null,
        emailVerified: Boolean(user.email_confirmed_at),
        twoFactorEnabled: Boolean(user.two_factor_enabled),
        blockedUsers: Array.isArray(user.blocked_users) ? user.blocked_users : [],
        equippedAvatarFrame: equipped.avatarFrame || null,
        equippedBanner: equipped.banner || null,
        equippedBackground: equipped.background || null,
        equippedTheme: equipped.theme || null,
        equippedBadge: equipped.badge || null,
        equippedTitle: equipped.title || null,
        equippedNameEffect: equipped.nameEffect || null,
        equippedAvatarEffect: equipped.avatarEffect || null,
        equippedChatBubble: equipped.chatBubble || null,
        equippedPresenceFlare: equipped.presenceFlare || null,
        equippedProfileAura: equipped.profileAura || null,
        equippedSoundPack: equipped.soundPack || null,
        equippedTypingFlare: equipped.typingFlare || null,
        equippedReactionBurst: equipped.reactionBurst || null,
        equippedCallOverlay: equipped.callOverlay || null,
        descoinBalance: Number(user.descoin_balance) || 0,
      },
    });
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
      .select(
        "id, username, avatar_url, display_name, bio, custom_status, banner_url, is_admin, updated_at, created_at, equipped_avatar_frame_id, equipped_banner_id, equipped_background_id"
      )
      .eq("id", userId)
      .single();

    if (error || !user) return res.status(404).json({ error: "User not found" });

    const valorant = await loadPublicValorant(user.id);
    const equipped = await shop.getEquippedCosmeticsForUser(user.id).catch(() => ({}));
    return res.json({
      user: {
        ...toPublicUser(user),
        createdAt: user.created_at,
        valorant,
        equippedAvatarFrame: equipped.avatarFrame || null,
        equippedBanner: equipped.banner || null,
        equippedBackground: equipped.background || null,
        equippedTheme: equipped.theme || null,
        equippedBadge: equipped.badge || null,
        equippedTitle: equipped.title || null,
        equippedNameEffect: equipped.nameEffect || null,
        equippedAvatarEffect: equipped.avatarEffect || null,
        equippedChatBubble: equipped.chatBubble || null,
        equippedPresenceFlare: equipped.presenceFlare || null,
        equippedProfileAura: equipped.profileAura || null,
        equippedSoundPack: equipped.soundPack || null,
        equippedTypingFlare: equipped.typingFlare || null,
        equippedReactionBurst: equipped.reactionBurst || null,
        equippedCallOverlay: equipped.callOverlay || null,
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

// ─── Email verification ─────────────────────────────────────────────

router.post("/email/set", requireAuth, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const { data: taken } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .not("email_confirmed_at", "is", null)
      .neq("id", req.user.id)
      .maybeSingle();
    if (taken) {
      return res.status(409).json({ error: "This email is already in use." });
    }

    await supabase
      .from("users")
      .update({ email, email_confirmed_at: null })
      .eq("id", req.user.id);

    const result = await issueAndSendCode({
      userId: req.user.id,
      email,
      username: req.user.username,
      purpose: "email_verify",
      column: "confirmation_token",
      sentAtColumn: "confirmation_sent_at",
      title: "Verify your Descall email",
      footer: "Enter this code in Descall to verify your email address.",
    });

    if (!result.sent && !result.skipped) {
      return res.status(503).json({ error: "Could not send verification email. Please try again." });
    }

    return res.json({ message: "Verification code sent.", emailConfigured: !result.skipped });
  } catch (err) {
    console.error("[AUTH] email/set error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/email/resend", requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("email, email_confirmed_at")
      .eq("id", req.user.id)
      .maybeSingle();
    if (!user?.email) return res.status(400).json({ error: "No email on file. Add one first." });
    if (user.email_confirmed_at) return res.status(400).json({ error: "Email is already verified." });

    const result = await issueAndSendCode({
      userId: req.user.id,
      email: user.email,
      username: req.user.username,
      purpose: "email_verify",
      column: "confirmation_token",
      sentAtColumn: "confirmation_sent_at",
      title: "Verify your Descall email",
      footer: "Enter this code in Descall to verify your email address.",
    });
    if (!result.sent && !result.skipped) {
      return res.status(503).json({ error: "Could not send verification email. Please try again." });
    }
    return res.json({ message: "Verification code sent." });
  } catch (err) {
    console.error("[AUTH] email/resend error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/email/verify", requireAuth, async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    const { data: user } = await supabase
      .from("users")
      .select("confirmation_token, confirmation_sent_at")
      .eq("id", req.user.id)
      .maybeSingle();

    const key = attemptKey(req.user.id, "email_verify");
    const attempts = authCodeAttempts.get(key) || 0;
    const verdict = verifyStoredCode({
      code,
      storedHash: user?.confirmation_token,
      sentAtIso: user?.confirmation_sent_at,
      attempts,
    });
    if (!verdict.ok) {
      authCodeAttempts.set(key, attempts + 1);
      const message =
        verdict.reason === "expired"
          ? "Code expired. Request a new one."
          : verdict.reason === "too_many_attempts"
          ? "Too many incorrect attempts. Request a new code."
          : verdict.reason === "no_pending_code"
          ? "No verification pending. Add your email first."
          : "Incorrect code.";
      return res.status(400).json({ error: message });
    }

    authCodeAttempts.delete(key);
    await supabase
      .from("users")
      .update({ email_confirmed_at: new Date().toISOString(), confirmation_token: null })
      .eq("id", req.user.id);

    return res.json({ message: "Email verified.", emailVerified: true });
  } catch (err) {
    console.error("[AUTH] email/verify error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── Two-factor authentication ──────────────────────────────────────

router.post("/2fa/enable", requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("email, email_confirmed_at")
      .eq("id", req.user.id)
      .maybeSingle();
    if (!user?.email || !user.email_confirmed_at) {
      return res.status(400).json({ error: "Verify your email before enabling two-factor authentication." });
    }
    await supabase.from("users").update({ two_factor_enabled: true }).eq("id", req.user.id);
    return res.json({ message: "Two-factor authentication enabled.", twoFactorEnabled: true });
  } catch (err) {
    console.error("[AUTH] 2fa/enable error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/2fa/disable", requireAuth, async (req, res) => {
  try {
    const { password } = req.body ?? {};
    const { data: user } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", req.user.id)
      .maybeSingle();

    if (user?.password_hash) {
      if (typeof password !== "string" || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Incorrect password." });
      }
    }

    await supabase.from("users").update({ two_factor_enabled: false }).eq("id", req.user.id);
    return res.json({ message: "Two-factor authentication disabled.", twoFactorEnabled: false });
  } catch (err) {
    console.error("[AUTH] 2fa/disable error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── Session management ─────────────────────────────────────────────

router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const sessions = await listSessions(req.user.id);
    return res.json({
      sessions: sessions.map((s) => ({ ...s, current: s.id === req.user.sid })),
    });
  } catch (err) {
    console.error("[AUTH] /sessions error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/sessions/:sessionId/revoke", requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (sessionId === req.user.sid) {
      return res.status(400).json({ error: "Use logout to end your current session." });
    }
    const sessions = await removeSession(req.user.id, sessionId);
    revokedSessionIds.add(sessionId);
    disconnectSocketsForSession(req, req.user.id, sessionId);
    return res.json({ message: "Session ended.", sessions });
  } catch (err) {
    console.error("[AUTH] session revoke error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/sessions/revoke-others", requireAuth, async (req, res) => {
  try {
    const { removed, sessions } = await removeOtherSessions(req.user.id, req.user.sid);
    removed.forEach((id) => {
      revokedSessionIds.add(id);
      disconnectSocketsForSession(req, req.user.id, id);
    });
    return res.json({ message: "Other sessions ended.", sessions, revokedCount: removed.length });
  } catch (err) {
    console.error("[AUTH] revoke-others error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

function disconnectSocketsForSession(req, userId, sessionId) {
  try {
    const io = req.app.get("io");
    if (!io) return;
    for (const [, sock] of io.sockets.sockets) {
      if (sock.user?.id === userId && sock.user?.sid === sessionId) {
        sock.emit("session:revoked", { sessionId });
        sock.disconnect(true);
      }
    }
  } catch (err) {
    console.warn("[AUTH] disconnectSocketsForSession failed:", err?.message);
  }
}

module.exports = router;

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables.");
}

function signToken(payload) {
  return jwt.sign(
    { sub: payload.id, username: payload.username, sid: payload.sid || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Short-lived token issued after a correct password when 2FA is enabled.
 * It cannot be used against requireAuth — only against the dedicated
 * /api/auth/2fa/verify-login endpoint — so a leaked "pending" token alone
 * never grants account access.
 */
function signPending2faToken(payload) {
  return jwt.sign(
    { sub: payload.id, username: payload.username, pending2fa: true },
    JWT_SECRET,
    { expiresIn: "10m" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, signPending2faToken, verifyToken };

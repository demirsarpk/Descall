const { verifyToken } = require("../config/jwt");
const { revokedSessionIds, bannedUserIds, banDetailsByUser } = require("../runtime/sharedState");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);
    if (decoded.pending2fa) {
      return res.status(401).json({ error: "Two-factor verification required." });
    }
    if (decoded.sid && revokedSessionIds.has(decoded.sid)) {
      return res.status(401).json({ error: "Session has been signed out.", code: "SESSION_REVOKED" });
    }
    if (bannedUserIds.has(decoded.sub)) {
      const detail = banDetailsByUser.get(decoded.sub);
      if (detail?.expiresAt && new Date(detail.expiresAt).getTime() <= Date.now()) {
        bannedUserIds.delete(decoded.sub);
        banDetailsByUser.delete(decoded.sub);
      } else {
        return res.status(403).json({
          error: "Account is banned.",
          code: "ACCOUNT_BANNED",
          ban: {
            category: detail?.category || "other",
            reason: detail?.reason || null,
            message: detail?.message || null,
            expiresAt: detail?.expiresAt || null,
          },
        });
      }
    }
    req.user = { id: decoded.sub, username: decoded.username, sid: decoded.sid || null };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
}

module.exports = { requireAuth };

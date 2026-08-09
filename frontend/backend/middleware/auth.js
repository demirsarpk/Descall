const { verifyToken } = require("../config/jwt");
const { revokedSessionIds } = require("../runtime/sharedState");

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

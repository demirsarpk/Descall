const { verifyToken } = require("../config/jwt");
const { bannedUserIds, revokedSessionIds } = require("../runtime/sharedState");

function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required: no token provided."));
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.pending2fa) {
      return next(new Error("Authentication failed: two-factor verification required."));
    }
    if (bannedUserIds.has(decoded.sub)) {
      return next(new Error("Authentication failed: account is banned."));
    }
    if (decoded.sid && revokedSessionIds.has(decoded.sid)) {
      return next(new Error("Authentication failed: session has been signed out."));
    }
    socket.user = { id: decoded.sub, username: decoded.username, sid: decoded.sid || null };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new Error("Authentication failed: token has expired."));
    }
    return next(new Error("Authentication failed: invalid token."));
  }
}

module.exports = { socketAuthMiddleware };

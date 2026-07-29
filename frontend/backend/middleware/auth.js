const { verifyToken } = require("../config/jwt");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, username: decoded.username };
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AUTH-MW] Token verification failed:", err.name, err.message);
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
}

module.exports = { requireAuth };

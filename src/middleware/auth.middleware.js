const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { AUTH_COOKIE_NAME } = require("../config/auth-cookie.config");

const AUTH_COOKIE = AUTH_COOKIE_NAME;
const ADMIN_ROLE_VALUES = new Set([
  "admin",
  "administrator",
  "superadmin",
  "super_admin",
]);

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const [rawKey, ...rest] = pair.split("=");
      if (!rawKey) return acc;
      const key = rawKey.trim();
      const value = rest.join("=").trim();
      try {
        acc[key] = decodeURIComponent(value);
      } catch (error) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function getTokenFromRequest(req) {
  const bearerToken = extractBearerToken(req);
  if (bearerToken) return bearerToken;

  const cookies = parseCookies(req.headers.cookie);
  return String(cookies[AUTH_COOKIE] || "").trim();
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function normalizeRole(roleValue) {
  const normalized = String(roleValue || "").trim().toLowerCase();
  return ADMIN_ROLE_VALUES.has(normalized) ? "admin" : "user";
}

function parseUserId(value) {
  const userId = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return 0;
  }

  return userId;
}

async function getUserById(userId) {
  if (!userId) return null;
  const result = await pool.query(
    "SELECT id, full_name, mobile, role FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );

  return result.rows[0] || null;
}

function attachUserToRequest(req, dbUser) {
  const role = normalizeRole(dbUser?.role);
  const normalizedUserId = parseUserId(dbUser?.id);

  req.user = {
    id: normalizedUserId,
    role,
  };

  req.userProfile = {
    id: normalizedUserId,
    full_name: dbUser?.full_name || "",
    mobile: dbUser?.mobile || "",
    role,
  };
}

async function resolveActiveUser(decodedToken) {
  const userId = parseUserId(decodedToken?.id);
  if (!userId) return null;
  return getUserById(userId);
}

async function hasAdminAccess(userPayload, userProfile) {
  const profileRole = normalizeRole(userProfile?.role);
  if (profileRole === "admin") {
    return true;
  }

  if (userProfile && profileRole !== "admin") {
    return false;
  }

  const userId = Number.parseInt(String(userPayload?.id || ""), 10);
  const tokenRole = normalizeRole(userPayload?.role);

  if (!Number.isInteger(userId) || userId <= 0) {
    return tokenRole === "admin";
  }

  const result = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
  if (result.rows.length === 0) {
    return false;
  }

  const dbRole = normalizeRole(result.rows[0].role);
  if (userPayload && typeof userPayload === "object") {
    userPayload.role = dbRole;
  }
  if (userProfile && typeof userProfile === "object") {
    userProfile.role = dbRole;
  }

  return dbRole === "admin";
}

async function authenticateToken(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: "Access Denied" });
  }

  try {
    const decoded = verifyToken(token);
    const dbUser = await resolveActiveUser(decoded);
    if (!dbUser) {
      return res.status(401).json({ message: "Account not found. Please login again" });
    }

    attachUserToRequest(req, dbUser);
    return next();
  } catch (error) {
    if (error && typeof error.name === "string" && error.name.includes("JsonWebToken")) {
      return res.status(403).json({ message: "Invalid Token" });
    }
    if (error && error.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Token expired" });
    }

    console.error("Auth verification failed:", error);
    return res.status(403).json({ message: "Invalid Token" });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const allowed = await hasAdminAccess(req.user, req.userProfile);
    if (!allowed) {
      return res.status(403).json({ message: "Admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Admin access verification failed:", error);
    return res.status(500).json({ message: "Unable to verify admin access" });
  }
}

function getLoginRedirect(req) {
  const returnUrl = encodeURIComponent(req.originalUrl || "/admin/admin-dashboard.html");
  return `/login.html?returnUrl=${returnUrl}`;
}

async function authenticateTokenForPage(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.redirect(getLoginRedirect(req));
  }

  try {
    const decoded = verifyToken(token);
    const dbUser = await resolveActiveUser(decoded);
    if (!dbUser) {
      return res.redirect(getLoginRedirect(req));
    }

    attachUserToRequest(req, dbUser);
    return next();
  } catch (error) {
    return res.redirect(getLoginRedirect(req));
  }
}

async function requireAdminForPage(req, res, next) {
  try {
    const allowed = await hasAdminAccess(req.user, req.userProfile);
    if (!allowed) {
      return res.redirect("/");
    }

    return next();
  } catch (error) {
    console.error("Admin page access verification failed:", error);
    return res.redirect("/");
  }
}

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.authenticateTokenForPage = authenticateTokenForPage;
module.exports.requireAdminForPage = requireAdminForPage;
module.exports.getTokenFromRequest = getTokenFromRequest;

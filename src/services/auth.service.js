const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const MOBILE_REGEX = /^\d{10}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;
const ADMIN_ROLE_VALUES = new Set([
  "admin",
  "administrator",
  "superadmin",
  "super_admin",
]);
const USER_ROLE_VALUES = new Set(["user", "customer", "client", "buyer"]);

function createBadRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function createNotFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function createForbidden(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeMobile(mobile) {
  return String(mobile || "").trim();
}

function normalizeRole(roleValue) {
  const normalized = String(roleValue || "").trim().toLowerCase();
  return ADMIN_ROLE_VALUES.has(normalized) ? "admin" : "user";
}

function parseRoleForUpdate(roleValue) {
  const normalized = String(roleValue || "").trim().toLowerCase();

  if (ADMIN_ROLE_VALUES.has(normalized)) return "admin";
  if (USER_ROLE_VALUES.has(normalized)) return "user";

  throw createBadRequest("Role must be admin or user");
}

function parsePositiveUserId(userId, fieldName) {
  const numeric = Number.parseInt(String(userId || ""), 10);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw createBadRequest(`${fieldName} must be a valid user id`);
  }

  return numeric;
}

async function getUsersColumnSet() {
  const columnsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );

  return new Set(
    (columnsResult.rows || []).map((row) => String(row.column_name || "").trim())
  );
}

function validateRegisterPayload({ name, mobile, password }) {
  const normalizedName = normalizeName(name);
  const normalizedMobile = normalizeMobile(mobile);

  if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 80) {
    throw createBadRequest("Name must be between 2 and 80 characters");
  }

  if (!MOBILE_REGEX.test(normalizedMobile)) {
    throw createBadRequest("Mobile number must be exactly 10 digits");
  }

  if (!PASSWORD_REGEX.test(password || "")) {
    throw createBadRequest(
      "Password must be 8-64 chars with upper, lower, number and special character"
    );
  }

  return {
    name: normalizedName,
    mobile: normalizedMobile,
    password: String(password),
  };
}

function validateLoginPayload({ mobile, password }) {
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedPassword = String(password || "");

  if (!MOBILE_REGEX.test(normalizedMobile)) {
    throw createBadRequest("Mobile number must be exactly 10 digits");
  }

  if (!normalizedPassword) {
    throw createBadRequest("Password is required");
  }

  return {
    mobile: normalizedMobile,
    password: normalizedPassword,
  };
}

async function register({ name, mobile, password }) {
  const payload = validateRegisterPayload({ name, mobile, password });

  const existingUser = await pool.query(
    "SELECT * FROM users WHERE mobile=$1",
    [payload.mobile]
  );

  if (existingUser.rows.length > 0) {
    throw createBadRequest("Mobile already registered");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const columnSet = await getUsersColumnSet();

  if (columnSet.has("role")) {
    await pool.query(
      "INSERT INTO users(full_name, mobile, password, role) VALUES($1,$2,$3,$4)",
      [payload.name, payload.mobile, hashedPassword, "user"]
    );
    return;
  }

  await pool.query("INSERT INTO users(full_name, mobile, password) VALUES($1,$2,$3)", [
    payload.name,
    payload.mobile,
    hashedPassword,
  ]);
}

async function login({ mobile, password }) {
  const payload = validateLoginPayload({ mobile, password });
  const result = await pool.query("SELECT * FROM users WHERE mobile=$1", [
    payload.mobile,
  ]);

  if (result.rows.length === 0) {
    throw createBadRequest("User not found");
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(payload.password, user.password);

  if (!isMatch) {
    throw createBadRequest("Invalid password");
  }

  const normalizedRole = normalizeRole(user.role);

  const token = jwt.sign(
    { id: user.id, role: normalizedRole },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return {
    token,
    username: user.full_name,
    userId: user.id,
    role: normalizedRole,
  };
}

async function getUsersForAdmin() {
  const columnSet = await getUsersColumnSet();

  const selectParts = [
    "id",
    "full_name",
    "mobile",
    columnSet.has("role") ? "role" : "'user'::text AS role",
    columnSet.has("created_at")
      ? "created_at"
      : "NULL::timestamp AS created_at",
  ];

  const result = await pool.query(
    `SELECT ${selectParts.join(", ")}
     FROM users
     ORDER BY id DESC`
  );

  return result.rows.map((user) => ({
    id: user.id,
    full_name: user.full_name || "",
    mobile: user.mobile || "",
    role: normalizeRole(user.role),
    created_at: user.created_at || null,
  }));
}

async function getAdminCount() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE LOWER(TRIM(COALESCE(role, ''))) IN ('admin', 'administrator', 'superadmin', 'super_admin')`
  );

  return Number(result.rows?.[0]?.count || 0);
}

async function updateUserRole({ targetUserId, newRole, actorUserId }) {
  const userId = parsePositiveUserId(targetUserId, "targetUserId");
  const actorId = parsePositiveUserId(actorUserId, "actorUserId");
  const roleToSet = parseRoleForUpdate(newRole);
  const columnSet = await getUsersColumnSet();

  if (!columnSet.has("role")) {
    const err = new Error("Users role column is missing. Run role migration first.");
    err.status = 500;
    throw err;
  }

  const targetResult = await pool.query(
    "SELECT id, full_name, mobile, role, created_at FROM users WHERE id = $1",
    [userId]
  );

  if (targetResult.rows.length === 0) {
    throw createNotFound("User not found");
  }

  const targetUser = targetResult.rows[0];
  const currentRole = normalizeRole(targetUser.role);

  if (actorId === userId && roleToSet === "user") {
    throw createForbidden("You cannot remove your own admin access");
  }

  if (currentRole === "admin" && roleToSet === "user") {
    const adminCount = await getAdminCount();
    if (adminCount <= 1) {
      throw createForbidden("At least one admin account is required");
    }
  }

  if (currentRole !== roleToSet) {
    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [roleToSet, userId]);
  }

  return {
    id: targetUser.id,
    full_name: targetUser.full_name || "",
    mobile: targetUser.mobile || "",
    role: roleToSet,
    created_at: targetUser.created_at || null,
    changed: currentRole !== roleToSet,
  };
}

module.exports = {
  register,
  login,
  getUsersForAdmin,
  updateUserRole,
};

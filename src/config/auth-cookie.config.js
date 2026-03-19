const appConfig = require("./app.config");

const AUTH_COOKIE_NAME = String(process.env.AUTH_COOKIE_NAME || "authToken").trim() || "authToken";
const AUTH_COOKIE_PATH = String(process.env.AUTH_COOKIE_PATH || "/").trim() || "/";

function parseSameSite(value) {
  const normalized = String(value || "lax").trim().toLowerCase();
  if (normalized === "none") return "none";
  if (normalized === "strict") return "strict";
  return "lax";
}

function parseCookieMaxAge(value) {
  const parsed = appConfig.parseInteger(value, 60 * 60 * 1000);
  return parsed > 0 ? parsed : 60 * 60 * 1000;
}

const authCookieSameSite = parseSameSite(process.env.AUTH_COOKIE_SAME_SITE);
const authCookieSecure = appConfig.parseBoolean(
  process.env.AUTH_COOKIE_SECURE,
  appConfig.isProduction || authCookieSameSite === "none"
);
const authCookieDomain = String(process.env.AUTH_COOKIE_DOMAIN || "").trim() || undefined;
const authCookieMaxAgeMs = parseCookieMaxAge(process.env.AUTH_COOKIE_MAX_AGE_MS);

function getAuthCookieOptions(overrides = {}) {
  const base = {
    httpOnly: true,
    sameSite: authCookieSameSite,
    secure: authCookieSecure,
    path: AUTH_COOKIE_PATH,
    maxAge: authCookieMaxAgeMs,
  };

  if (authCookieDomain) {
    base.domain = authCookieDomain;
  }

  return { ...base, ...overrides };
}

function getAuthCookieClearOptions() {
  const options = getAuthCookieOptions();
  delete options.maxAge;
  return options;
}

module.exports = {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_PATH,
  authCookieSameSite,
  authCookieSecure,
  authCookieDomain,
  authCookieMaxAgeMs,
  getAuthCookieOptions,
  getAuthCookieClearOptions,
};


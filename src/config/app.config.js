const path = require("path");

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

const nodeEnv = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const isProduction = nodeEnv === "production";

const port = parseInteger(process.env.PORT, 3000);
const trustProxy = parseBoolean(process.env.TRUST_PROXY, isProduction);
const serveStatic = parseBoolean(process.env.SERVE_STATIC, !isProduction);

const publicDir = path.join(__dirname, "..", "..", "public");
const adminDir = path.join(publicDir, "admin");
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads");

const frontendBaseUrl = normalizeBaseUrl(process.env.FRONTEND_BASE_URL);
const apiBaseUrl = normalizeBaseUrl(process.env.API_BASE_URL);
const assetBaseUrl = normalizeBaseUrl(process.env.ASSET_BASE_URL || apiBaseUrl);

const corsAllowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
const corsAllowAll = parseBoolean(process.env.CORS_ALLOW_ALL, !isProduction);

const storageDriver = String(process.env.STORAGE_DRIVER || "local")
  .trim()
  .toLowerCase() === "s3"
  ? "s3"
  : "local";

const s3Region = String(process.env.S3_REGION || "").trim();
const s3BucketName = String(process.env.S3_BUCKET_NAME || "").trim();
const s3UploadPrefix = String(process.env.S3_UPLOAD_PREFIX || "uploads").trim().replace(/^\/+|\/+$/g, "");
const s3PublicBaseUrl = normalizeBaseUrl(process.env.S3_PUBLIC_BASE_URL);
const s3UploadAcl = String(process.env.S3_UPLOAD_ACL || "").trim();

module.exports = {
  nodeEnv,
  isProduction,
  port,
  trustProxy,
  serveStatic,
  publicDir,
  adminDir,
  uploadDir,
  frontendBaseUrl,
  apiBaseUrl,
  assetBaseUrl,
  corsAllowedOrigins,
  corsAllowAll,
  storageDriver,
  s3Region,
  s3BucketName,
  s3UploadPrefix,
  s3PublicBaseUrl,
  s3UploadAcl,
  parseBoolean,
  parseInteger,
};

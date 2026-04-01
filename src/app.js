const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const appConfig = require("./config/app.config");
const createProductRoutes = require("./routes/products.routes");
const categoryRoutes = require("./routes/categories.routes");
const createHeroRoutes = require("./routes/hero.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/orders.routes");
const userRoutes = require("./routes/user.routes");
const errorMiddleware = require("./middleware/error.middleware");
const authMiddleware = require("./middleware/auth.middleware");

const app = express();
const { authenticateTokenForPage, requireAdminForPage } = authMiddleware;
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);
const allowedVideoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);
const allowedVideoExtensions = new Set([".mp4", ".webm", ".ogv", ".ogg", ".mov", ".mkv"]);

if (appConfig.trustProxy) {
  app.set("trust proxy", 1);
}

function corsOptionsDelegate(req, callback) {
  const requestOrigin = String(req.header("Origin") || "").trim();
  const hasAllowedOrigins = appConfig.corsAllowedOrigins.length > 0;

  let allowOrigin = false;
  if (!requestOrigin) {
    allowOrigin = true;
  } else if (appConfig.corsAllowAll) {
    allowOrigin = true;
  } else if (hasAllowedOrigins && appConfig.corsAllowedOrigins.includes(requestOrigin)) {
    allowOrigin = true;
  }

  callback(null, {
    origin: allowOrigin ? (requestOrigin || true) : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}

app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

if (!fs.existsSync(appConfig.uploadDir)) {
  fs.mkdirSync(appConfig.uploadDir, { recursive: true });
}

if (appConfig.serveStatic) {
  app.use("/admin", authenticateTokenForPage, requireAdminForPage, express.static(appConfig.adminDir));
  app.use(express.static(appConfig.publicDir));
}

app.use("/uploads", express.static(appConfig.uploadDir));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, appConfig.uploadDir);
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const maxUploadFileSizeBytes = Math.max(1, appConfig.uploadFileMaxMb) * 1024 * 1024;

function getFileExtension(fileName = "") {
  return path.extname(String(fileName || "").trim()).toLowerCase();
}

function createBadUploadRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function validateImageUpload(file) {
  const mimeType = String(file?.mimetype || "").trim().toLowerCase();
  const extension = getFileExtension(file?.originalname || file?.filename || "");

  if (allowedImageMimeTypes.has(mimeType) || allowedImageExtensions.has(extension)) {
    return null;
  }

  return createBadUploadRequest(
    "Invalid image format. Allowed: jpg, jpeg, png, webp, gif, svg, avif."
  );
}

function validateVideoUpload(file) {
  const mimeType = String(file?.mimetype || "").trim().toLowerCase();
  const extension = getFileExtension(file?.originalname || file?.filename || "");

  if (allowedVideoMimeTypes.has(mimeType) || allowedVideoExtensions.has(extension)) {
    return null;
  }

  return createBadUploadRequest(
    "Invalid video format. Allowed: mp4, webm, ogg, mov, mkv."
  );
}

function uploadFileFilter(req, file, cb) {
  if (!file) {
    return cb(null, true);
  }

  const fieldName = String(file.fieldname || "").trim().toLowerCase();
  if (fieldName === "image") {
    const imageError = validateImageUpload(file);
    if (imageError) return cb(imageError);
    return cb(null, true);
  }

  if (fieldName === "video") {
    const videoError = validateVideoUpload(file);
    if (videoError) return cb(videoError);
    return cb(null, true);
  }

  return cb(createBadUploadRequest(`Unsupported upload field: ${fieldName || "unknown"}`));
}

const upload = multer({
  storage,
  limits: {
    fileSize: maxUploadFileSizeBytes,
  },
  fileFilter: uploadFileFilter,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "crackers-api",
    time: new Date().toISOString(),
    env: appConfig.nodeEnv,
    upload_limit_mb: appConfig.uploadFileMaxMb,
  });
});

app.use("/api/products", createProductRoutes(upload));
app.use("/api/categories", categoryRoutes);
app.use("/api/hero", createHeroRoutes(upload));
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);

if (!appConfig.serveStatic) {
  app.get("/", (req, res) => {
    res.json({
      message: "Crackers API is running",
      health: "/api/health",
    });
  });
}

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorMiddleware);

module.exports = app;

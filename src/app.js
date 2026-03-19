require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

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
app.use(express.urlencoded({ extended: true }));

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

const upload = multer({ storage });

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "crackers-api",
    time: new Date().toISOString(),
    env: appConfig.nodeEnv,
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


// இது உங்க MAIN app.js - இதைத்தான் USE பண்ணணும்
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
const publicDir = path.join(__dirname, "..", "public");
const adminDir = path.join(publicDir, "admin");
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use("/admin", authenticateTokenForPage, requireAdminForPage, express.static(adminDir));
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir));

// Multer config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Routes
app.use("/api/products", createProductRoutes(upload));
app.use("/api/categories", categoryRoutes);
app.use("/api/hero", createHeroRoutes(upload));
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorMiddleware);

module.exports = app;

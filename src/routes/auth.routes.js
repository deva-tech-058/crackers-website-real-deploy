const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");
const { requireAdmin } = authenticateToken;
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ message: "Auth route working" });
});

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/profile", authenticateToken, authController.profile);
router.get("/session", authenticateToken, authController.session);
router.get("/users", authenticateToken, requireAdmin, authController.listUsers);
router.patch("/users/:id/role", authenticateToken, requireAdmin, authController.updateUserRole);
router.post("/users/:id/role", authenticateToken, requireAdmin, authController.updateUserRole);

module.exports = router;


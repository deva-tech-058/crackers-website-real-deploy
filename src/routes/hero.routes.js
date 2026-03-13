const express = require("express");
const heroController = require("../controllers/hero.controller");
const authenticateToken = require("../middleware/auth.middleware");

const { requireAdmin } = authenticateToken;

function createHeroRoutes(upload) {
  const router = express.Router();

  router.post("/", authenticateToken, requireAdmin, upload.single("image"), heroController.addHero);
  router.get("/", heroController.listHeroes);
  router.delete("/:id", authenticateToken, requireAdmin, heroController.removeHero);

  return router;
}

module.exports = createHeroRoutes;

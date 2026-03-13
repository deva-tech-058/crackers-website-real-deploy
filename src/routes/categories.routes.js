const express = require("express");
const categoryController = require("../controllers/category.controller");
const authenticateToken = require("../middleware/auth.middleware");

const { requireAdmin } = authenticateToken;
const router = express.Router();

router.get("/", categoryController.listCategories);
router.post("/", authenticateToken, requireAdmin, categoryController.addCategory);
router.put("/:id", authenticateToken, requireAdmin, categoryController.editCategory);

module.exports = router;

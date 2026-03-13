const express = require("express");
const productController = require("../controllers/product.controller");
const authenticateToken = require("../middleware/auth.middleware");

const { requireAdmin } = authenticateToken;

function createProductRoutes(upload) {
  const router = express.Router();
  const mediaUpload = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]);

  router.get("/", productController.listProducts);
  router.post("/", authenticateToken, requireAdmin, mediaUpload, productController.addProduct);
  router.put("/:id", authenticateToken, requireAdmin, mediaUpload, productController.editProduct);
  router.delete("/:id", authenticateToken, requireAdmin, productController.removeProduct);

  return router;
}

module.exports = createProductRoutes;

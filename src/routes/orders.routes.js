const express = require("express");
const ordersController = require("../controllers/order.controller");
const authenticateToken = require("../middleware/auth.middleware");

const { requireAdmin } = authenticateToken;
const router = express.Router();

// Public routes
router.post("/", ordersController.createOrder.bind(ordersController));
router.get("/:orderId", authenticateToken, ordersController.getOrderById.bind(ordersController));

// User routes
router.get("/user/:userId", authenticateToken, ordersController.getOrdersByUser.bind(ordersController));

// Admin routes
router.get("/", authenticateToken, requireAdmin, ordersController.listOrders.bind(ordersController));
router.put(
  "/:orderId/status",
  authenticateToken,
  requireAdmin,
  ordersController.updateOrderStatus.bind(ordersController)
);
router.get("/admin/list", authenticateToken, requireAdmin, ordersController.listOrders.bind(ordersController));

module.exports = router;

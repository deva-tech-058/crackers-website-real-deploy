// controllers/orders.controller.js
// ✅ FIXED: Changed from '../config/database' to '../config/db'
const pool = require('../config/db');  // Your database file is db.js, not database.js

class OrdersController {
  // Get all orders (Admin)
  async getAllOrders(req, res) {
    try {
      const result = await pool.query(`
        SELECT id, order_id, user_id, customer_name, mobile, 
               address_line1, address_line2, city, state, pin_code,
               payment_method, total_amount, order_date, status, 
               created_at, updated_at
        FROM public.orders
        ORDER BY order_date DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error in getAllOrders:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get order by ID with items
  async getOrderById(req, res) {
    try {
      const { orderId } = req.params;

      // Get order details
      const orderResult = await pool.query(`
        SELECT * FROM public.orders WHERE order_id = $1
      `, [orderId]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const orderRecord = orderResult.rows[0];
      const requesterRole = String(req.user?.role || "").trim().toLowerCase();
      const requesterId = String(req.user?.id || "").trim();
      const ownerId = String(orderRecord.user_id || "").trim();
      const isAdmin = requesterRole === "admin";

      if (!isAdmin && (!ownerId || ownerId !== requesterId)) {
        return res.status(403).json({ message: "You are not allowed to view this order" });
      }

      // Get order items
      const itemsResult = await pool.query(`
        SELECT id, product_id, product_name, quantity, 
               unit_price, total_price
        FROM public.order_items 
        WHERE order_id = $1
      `, [orderId]);

      // Combine order with items
      const orderWithItems = {
        ...orderRecord,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }))
      };

      res.json(orderWithItems);
    } catch (error) {
      console.error('Error in getOrderById:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Get user orders
  async getUserOrders(req, res) {
    try {
      const { userId } = req.params;
      const normalizedUserId = String(userId || "").trim();
      const requesterRole = String(req.user?.role || "").trim().toLowerCase();
      const requesterId = String(req.user?.id || "").trim();
      const isAdmin = requesterRole === "admin";

      if (!normalizedUserId || normalizedUserId === "undefined" || normalizedUserId === "null") {
        if (!isAdmin) {
          return res.status(403).json({ message: "User id is required" });
        }
      } else if (!isAdmin && requesterId !== normalizedUserId) {
        return res.status(403).json({ message: "You are not allowed to view these orders" });
      }

      const targetUserId = normalizedUserId || requesterId;
      const result = await pool.query(
        `SELECT * FROM public.orders WHERE user_id = $1 ORDER BY order_date DESC`,
        [targetUserId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error in getUserOrders:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Create new order
  async createOrder(req, res) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        order_id,
        user_id,
        customer_name,
        mobile,
        address_line1,
        address_line2,
        city,
        state,
        pin_code,
        payment_method,
        total_amount,
        items
      } = req.body;

      // Insert order
      const orderQuery = `
        INSERT INTO public.orders (
            order_id, user_id, customer_name, mobile, address_line1, 
            address_line2, city, state, pin_code, payment_method, 
            total_amount, status, order_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const orderValues = [
        order_id,
        user_id || null,
        customer_name,
        mobile,
        address_line1,
        address_line2 || '',
        city,
        state,
        pin_code,
        payment_method,
        total_amount,
        'confirmed'
      ];

      const orderResult = await client.query(orderQuery, orderValues);

      // Insert order items
      const itemQuery = `
        INSERT INTO public.order_items (
            order_id, product_id, product_name, quantity, unit_price, total_price, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `;

      for (const item of items) {
        const itemQuantity = Math.max(1, Number(item.quantity) || 1);
        const productId = Number.parseInt(item.product_id, 10);

        await client.query(itemQuery, [
          order_id,
          Number.isFinite(productId) ? productId : null,
          item.name || item.product_name,
          itemQuantity,
          item.price || item.unit_price,
          (item.price || item.unit_price || 0) * itemQuantity
        ]);

        // Keep stock updates inside the same DB transaction as order creation.
        if (Number.isFinite(productId) && productId > 0) {
          const stockUpdate = await client.query(
            `UPDATE products
             SET quantity = COALESCE(quantity, 0) - $1
             WHERE id = $2 AND COALESCE(quantity, 0) >= $1
             RETURNING id`,
            [itemQuantity, productId]
          );

          if (stockUpdate.rowCount === 0) {
            throw new Error(`Insufficient stock for product ${productId}`);
          }
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Order created successfully',
        order: orderResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in createOrder:', error);
      res.status(500).json({ message: 'Error creating order', error: error.message });
    } finally {
      client.release();
    }
  }

  // Update order status
  async updateOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      const result = await pool.query(`
        UPDATE public.orders 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
        RETURNING *
      `, [status, orderId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error in updateOrderStatus:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // List all orders (alias for getAllOrders)
  async listOrders(req, res) {
    const queryUserId = String(req.query?.userId || "").trim();
    if (queryUserId && queryUserId !== "undefined" && queryUserId !== "null") {
      req.params.userId = queryUserId;
      return this.getUserOrders(req, res);
    }

    return this.getAllOrders(req, res);
  }

  // Get orders by user (alias for getUserOrders)
  async getOrdersByUser(req, res) {
    return this.getUserOrders(req, res);
  }
}

module.exports = new OrdersController();

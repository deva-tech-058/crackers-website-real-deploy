const express = require('express');
const router = express.Router();

// Database connection (app.js la irundhu use pannalam)
const db = require('../config/db'); // Adjust path if needed

// ✅ GET /api/user/addresses - Fetch user addresses
router.get('/addresses', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id required' });
        }

        const query = `
            SELECT * FROM user_addresses 
            WHERE user_id = $1 
            ORDER BY is_default DESC, created_at DESC
        `;

        const result = await db.query(query, [user_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('DB Error:', error);
        res.status(500).json([]);
    }
});

// ✅ POST /api/user/addresses - Save new address (as DEFAULT)
router.post('/addresses', async (req, res) => {
    try {
        const { user_id, address } = req.body;

        if (!user_id || !address) {
            return res.status(400).json({ error: 'user_id and address required' });
        }

        // First make ALL existing addresses non-default
        await db.query(
            'UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1',
            [user_id]
        );

        // Insert NEW address as DEFAULT
        const query = `
            INSERT INTO user_addresses (user_id, name, mobile, line1, line2, city, state, pin, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const result = await db.query(query, [
            user_id,
            address.name,
            address.mobile,
            address.line1,
            address.line2 || null,
            address.city,
            address.state,
            address.pin,
            true
        ]);

        res.json({ success: true, address: result.rows[0] });
    } catch (error) {
        console.error('DB Error:', error);
        res.status(500).json({ error: 'Failed to save address' });
    }
});

module.exports = router;

const pool = require("../config/db");

async function getCategories() {
  const result = await pool.query("SELECT * FROM categories ORDER BY id DESC");
  return result.rows;
}

async function createCategory(name) {
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();

  const check = await pool.query(
    "SELECT id FROM categories WHERE LOWER(TRIM(name)) = $1",
    [lowerName]
  );

  if (check.rows.length > 0) {
    const err = new Error("Category already exists");
    err.status = 409;
    throw err;
  }

  await pool.query("INSERT INTO categories (name) VALUES ($1)", [trimmedName]);
}

async function updateCategory(id, name) {
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    const err = new Error("Invalid category ID");
    err.status = 400;
    throw err;
  }

  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();

  const check = await pool.query(
    "SELECT id FROM categories WHERE LOWER(TRIM(name)) = $1 AND id != $2",
    [lowerName, numericId]
  );

  if (check.rows.length > 0) {
    const err = new Error("Category name already exists");
    err.status = 409;
    throw err;
  }

  const result = await pool.query(
    "UPDATE categories SET name = $1 WHERE id = $2 RETURNING *",
    [trimmedName, numericId]
  );

  if (result.rowCount === 0) {
    const err = new Error("Category not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
};

const pool = require("../config/db");

let videoColumnResolved = false;
let videoColumnAvailable = false;

async function detectVideoColumn() {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'products'
         AND column_name = 'video_url'
     ) AS exists`
  );
  return Boolean(result.rows?.[0]?.exists);
}

async function ensureVideoColumn() {
  if (videoColumnResolved) return videoColumnAvailable;

  try {
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT");
    videoColumnAvailable = true;
  } catch (alterErr) {
    console.warn("Product video column migration skipped:", alterErr.message);
    try {
      videoColumnAvailable = await detectVideoColumn();
    } catch (detectErr) {
      console.warn("Product video column detection failed:", detectErr.message);
      videoColumnAvailable = false;
    }
  }

  videoColumnResolved = true;
  return videoColumnAvailable;
}

async function getProducts() {
  const hasVideoColumn = await ensureVideoColumn();
  const result = await pool.query(`
    SELECT p.id, p.name, p.original_price, p.offer_price, p.discount,
           p.quantity, p.image_url, ${
             hasVideoColumn ? "p.video_url" : "NULL::text AS video_url"
           }, p.category_id, p.is_best_selling,
           c.name AS category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.id DESC
  `);
  return result.rows;
}

async function createProduct(data) {
  const {
    name,
    original_price,
    discount,
    quantity,
    category_id,
    is_best_selling,
    image_url,
    video_url,
  } = data;

  const originalPrice = Math.round(parseFloat(original_price));
  const discountValue = Math.round(parseFloat(discount));
  const qty = parseInt(quantity, 10);

  if (!Number.isFinite(originalPrice) || originalPrice < 0) {
    throw new Error("Invalid original price");
  }
  if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
    throw new Error("Invalid discount value");
  }
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error("Invalid quantity value");
  }

  const offer_price = Math.round(
    originalPrice - (originalPrice * discountValue) / 100
  );
  const hasVideoColumn = await ensureVideoColumn();

  if (video_url && !hasVideoColumn) {
    throw new Error(
      "Video upload is not available. Please ensure products.video_url column exists."
    );
  }

  if (hasVideoColumn) {
    await pool.query(
      `INSERT INTO products (name, original_price, offer_price, discount, quantity,
                             image_url, video_url, category_id, is_best_selling)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        name,
        originalPrice,
        offer_price,
        discountValue,
        qty,
        image_url,
        video_url || null,
        category_id,
        is_best_selling,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO products (name, original_price, offer_price, discount, quantity,
                           image_url, category_id, is_best_selling)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      name,
      originalPrice,
      offer_price,
      discountValue,
      qty,
      image_url,
      category_id,
      is_best_selling,
    ]
  );
}

async function updateProduct(id, data) {
  const {
    name,
    original_price,
    discount,
    quantity,
    category_id,
    is_best_selling,
    image_url,
    video_url,
  } = data;

  const originalPrice = Math.round(parseFloat(original_price));
  const discountValue = Math.round(parseFloat(discount));
  const qty = parseInt(quantity, 10);

  if (!Number.isFinite(originalPrice) || originalPrice < 0) {
    throw new Error("Invalid original price");
  }
  if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
    throw new Error("Invalid discount value");
  }
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error("Invalid quantity value");
  }

  const offer_price = Math.round(
    originalPrice - (originalPrice * discountValue) / 100
  );
  const hasVideoColumn = await ensureVideoColumn();

  if (video_url && !hasVideoColumn) {
    throw new Error(
      "Video upload is not available. Please ensure products.video_url column exists."
    );
  }

  const fields = [
    ["name", name],
    ["original_price", originalPrice],
    ["offer_price", offer_price],
    ["discount", discountValue],
    ["quantity", qty],
    ["category_id", category_id],
    ["is_best_selling", is_best_selling],
  ];

  if (image_url) {
    fields.push(["image_url", image_url]);
  }

  if (hasVideoColumn && video_url) {
    fields.push(["video_url", video_url]);
  }

  const setClause = fields
    .map(([column], index) => `${column}=$${index + 1}`)
    .join(", ");
  const values = fields.map(([, value]) => value);
  values.push(id);

  await pool.query(
    `UPDATE products
     SET ${setClause}
     WHERE id=$${values.length}`,
    values
  );
}

async function deleteProduct(id) {
  await pool.query("DELETE FROM products WHERE id=$1", [id]);
}

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};

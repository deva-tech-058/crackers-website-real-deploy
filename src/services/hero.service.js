const pool = require("../config/db");

let heroColumnsResolved = false;
let heroColumns = {
  hasTitle: false,
  hasSubtitle: false,
  hasImage: false,
  hasImageUrl: false,
  hasStatus: false,
};

async function resolveHeroColumns() {
  if (heroColumnsResolved) return heroColumns;

  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'hero_slides'`
  );

  const names = new Set((result.rows || []).map((row) => String(row.column_name || "").trim()));
  heroColumns = {
    hasTitle: names.has("title"),
    hasSubtitle: names.has("subtitle"),
    hasImage: names.has("image"),
    hasImageUrl: names.has("image_url"),
    hasStatus: names.has("status"),
  };

  heroColumnsResolved = true;
  return heroColumns;
}

async function createHero({ title, subtitle, image }) {
  const columns = await resolveHeroColumns();
  const insertColumns = [];
  const values = [];

  if (columns.hasTitle) {
    insertColumns.push("title");
    values.push(String(title || "").trim() || null);
  }

  if (columns.hasSubtitle) {
    insertColumns.push("subtitle");
    values.push(String(subtitle || "").trim() || null);
  }

  const imageColumn = columns.hasImageUrl ? "image_url" : columns.hasImage ? "image" : "";
  if (imageColumn) {
    insertColumns.push(imageColumn);
    values.push(image);
  }

  if (!insertColumns.length) {
    throw new Error("hero_slides table is missing title/subtitle/image columns.");
  }

  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(", ");
  await pool.query(
    `INSERT INTO hero_slides (${insertColumns.join(", ")}) VALUES (${placeholders})`,
    values
  );
}

async function getHeroes() {
  const columns = await resolveHeroColumns();

  const imageProjection = columns.hasImageUrl && columns.hasImage
    ? "COALESCE(NULLIF(TRIM(image_url), ''), image) AS image, image_url"
    : columns.hasImageUrl
      ? "image_url AS image, image_url"
      : columns.hasImage
        ? "image, image AS image_url"
        : "NULL::text AS image, NULL::text AS image_url";

  const titleProjection = columns.hasTitle ? "title" : "NULL::text AS title";
  const subtitleProjection = columns.hasSubtitle ? "subtitle" : "NULL::text AS subtitle";
  const statusProjection = columns.hasStatus ? "status" : "TRUE AS status";
  const whereClause = columns.hasStatus ? "WHERE status = true" : "";

  const result = await pool.query(
    `SELECT id,
            ${titleProjection},
            ${subtitleProjection},
            ${imageProjection},
            ${statusProjection}
     FROM hero_slides
     ${whereClause}
     ORDER BY id DESC`
  );
  return result.rows;
}

async function deleteHero(id) {
  await pool.query("DELETE FROM hero_slides WHERE id=$1", [id]);
}

module.exports = {
  createHero,
  getHeroes,
  deleteHero,
};

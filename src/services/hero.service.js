const pool = require("../config/db");

async function createHero({ title, subtitle, image }) {
  await pool.query(
    "INSERT INTO hero_slides (title, subtitle, image) VALUES ($1, $2, $3)",
    [title, subtitle, image]
  );
}

async function getHeroes() {
  const result = await pool.query(
    "SELECT * FROM hero_slides WHERE status = true ORDER BY id DESC"
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

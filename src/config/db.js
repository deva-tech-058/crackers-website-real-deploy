const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool
  .connect()
  .then((client) => {
    console.log("PostgreSQL connected");
    client.release();
  })
  .catch((err) => {
    console.error("DB connection error:", err);
  });

module.exports = pool;

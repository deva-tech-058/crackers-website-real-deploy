const { Pool } = require("pg");
const appConfig = require("./app.config");

function buildPoolConfig() {
  const max = appConfig.parseInteger(process.env.DB_POOL_MAX, 20);
  const idleTimeoutMillis = appConfig.parseInteger(process.env.DB_IDLE_TIMEOUT_MS, 30000);
  const connectionTimeoutMillis = appConfig.parseInteger(process.env.DB_CONNECTION_TIMEOUT_MS, 5000);

  const useSsl = appConfig.parseBoolean(process.env.DB_SSL, appConfig.isProduction);
  const rejectUnauthorized = appConfig.parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

  const poolConfig = {
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  };

  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (connectionString) {
    poolConfig.connectionString = connectionString;
  } else {
    poolConfig.user = process.env.DB_USER;
    poolConfig.host = process.env.DB_HOST;
    poolConfig.database = process.env.DB_DATABASE;
    poolConfig.password = process.env.DB_PASSWORD;
    poolConfig.port = appConfig.parseInteger(process.env.DB_PORT, 5432);
  }

  if (useSsl) {
    poolConfig.ssl = { rejectUnauthorized };
  }

  return poolConfig;
}

const pool = new Pool(buildPoolConfig());

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

pool
  .connect()
  .then((client) => {
    console.log("PostgreSQL connected");
    client.release();
  })
  .catch((error) => {
    console.error("DB connection error:", error);
  });

module.exports = pool;


require("dotenv").config();

const appConfig = require("./config/app.config");
const { loadSecretsIntoEnv } = require("./config/secrets");

function ensureRequiredEnv() {
  const missing = [];
  const hasDatabaseUrl = String(process.env.DATABASE_URL || "").trim().length > 0;

  if (!String(process.env.JWT_SECRET || "").trim()) {
    missing.push("JWT_SECRET");
  }

  if (!hasDatabaseUrl) {
    [
      "DB_HOST",
      "DB_PORT",
      "DB_DATABASE",
      "DB_USER",
      "DB_PASSWORD",
    ].forEach((key) => {
      if (!String(process.env[key] || "").trim()) {
        missing.push(key);
      }
    });
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment values: ${missing.join(", ")}`);
  }
}

async function bootstrap() {
  try {
    await loadSecretsIntoEnv();
    ensureRequiredEnv();

    // Load app after env/secrets are ready.
    const app = require("./app");

    app.listen(appConfig.port, () => {
      console.log(`Server running on port ${appConfig.port} (${appConfig.nodeEnv})`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();

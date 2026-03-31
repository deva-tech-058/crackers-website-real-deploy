require("dotenv").config();

const { loadSecretsIntoEnv } = require("./config/secrets");

function ensureRequiredEnv() {
  const missing = [];
  const hasDatabaseUrl = String(process.env.DATABASE_URL || "").trim().length > 0;
  const storageDriver = String(process.env.STORAGE_DRIVER || "local").trim().toLowerCase();

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

  if (storageDriver === "s3") {
    if (!String(process.env.S3_BUCKET_NAME || "").trim()) {
      missing.push("S3_BUCKET_NAME");
    }

    if (!String(process.env.S3_REGION || process.env.AWS_REGION || "").trim()) {
      missing.push("S3_REGION|AWS_REGION");
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment values: ${missing.join(", ")}`);
  }
}

async function bootstrap() {
  try {
    await loadSecretsIntoEnv();
    ensureRequiredEnv();

    // Load app config after secrets/env are finalized.
    const appConfig = require("./config/app.config");

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

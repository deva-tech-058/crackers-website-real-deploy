function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function getSecretIdentifier() {
  const candidates = [
    process.env.AWS_SECRET_ID,
    process.env.SECRETS_MANAGER_SECRET_ID,
    process.env.SECRET_ID,
  ];

  return (
    candidates
      .map((value) => String(value || "").trim())
      .find(Boolean) || ""
  );
}

function getSecretsRegion() {
  const candidates = [
    process.env.AWS_SECRETS_REGION,
    process.env.AWS_REGION,
    process.env.S3_REGION,
  ];

  return (
    candidates
      .map((value) => String(value || "").trim())
      .find(Boolean) || ""
  );
}

function parseKeyValueSecret(secretString) {
  return String(secretString || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) return acc;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key) return acc;

      acc[key] = value;
      return acc;
    }, {});
}

function parseSecretString(secretString) {
  const raw = String(secretString || "").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // Fall through to KEY=VALUE parsing.
  }

  return parseKeyValueSecret(raw);
}

function parseSecretResponsePayload(response = {}) {
  if (response.SecretString) {
    return parseSecretString(response.SecretString);
  }

  if (response.SecretBinary) {
    const decoded = Buffer.from(response.SecretBinary, "base64").toString("utf8");
    return parseSecretString(decoded);
  }

  return {};
}

function applySecretsToEnv(secrets = {}, { overrideExisting = false } = {}) {
  if (!secrets || typeof secrets !== "object") return;

  Object.entries(secrets).forEach(([key, value]) => {
    const envKey = String(key || "").trim();
    if (!envKey) return;
    if (value === undefined || value === null) return;

    if (!overrideExisting && String(process.env[envKey] || "").trim()) {
      return;
    }

    process.env[envKey] = String(value);
  });
}

async function fetchSecretsFromAws({ secretId, region }) {
  let SecretsManagerClient;
  let GetSecretValueCommand;

  try {
    ({ SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager"));
  } catch (error) {
    throw new Error(
      "AWS Secrets Manager enabled, but @aws-sdk/client-secrets-manager is not installed"
    );
  }

  const client = new SecretsManagerClient({ region });
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);

  return parseSecretResponsePayload(response);
}

async function loadSecretsIntoEnv() {
  const secretId = getSecretIdentifier();
  const secretsEnabled = parseBoolean(process.env.AWS_SECRETS_ENABLED, Boolean(secretId));
  const secretsRequired = parseBoolean(process.env.AWS_SECRETS_REQUIRED, false);

  if (!secretsEnabled) {
    return {};
  }

  if (!secretId) {
    const error = new Error("AWS_SECRETS_ENABLED is true but AWS_SECRET_ID is missing");
    if (secretsRequired) throw error;

    console.warn(`${error.message}. Continuing with current environment values.`);
    return {};
  }

  const region = getSecretsRegion();
  if (!region) {
    const error = new Error(
      "Secrets Manager region missing. Set AWS_SECRETS_REGION or AWS_REGION"
    );
    if (secretsRequired) throw error;

    console.warn(`${error.message}. Continuing with current environment values.`);
    return {};
  }

  try {
    const secrets = await fetchSecretsFromAws({ secretId, region });
    applySecretsToEnv(secrets);
    return secrets;
  } catch (error) {
    if (secretsRequired) throw error;

    console.warn(`Secrets Manager fetch skipped: ${error.message}`);
    return {};
  }
}

module.exports = {
  parseSecretString,
  applySecretsToEnv,
  loadSecretsIntoEnv,
};

function isAbsoluteUrl(value) {
  const url = String(value || "").trim();
  if (!url) return false;
  return /^[a-z][a-z\d+\-.]*:/i.test(url) || url.startsWith("//");
}

function normalizePath(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  return `/${normalized}`;
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

function getRequestOrigin(req) {
  if (!req || typeof req !== "object") return "";

  const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = String(req.headers?.["x-forwarded-host"] || req.get?.("host") || "")
    .split(",")[0]
    .trim();

  if (!host) return "";
  return `${protocol}://${host}`;
}

function toPublicAssetUrl({ req, value, assetBaseUrl = "" }) {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  if (isAbsoluteUrl(raw)) return raw;

  const normalizedPath = normalizePath(raw);
  if (!normalizedPath.startsWith("/uploads/")) {
    return normalizedPath;
  }

  const normalizedAssetBase = trimTrailingSlash(assetBaseUrl);
  if (normalizedAssetBase) {
    return `${normalizedAssetBase}${normalizedPath}`;
  }

  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) {
    return `${requestOrigin}${normalizedPath}`;
  }

  return normalizedPath;
}

module.exports = {
  isAbsoluteUrl,
  normalizePath,
  getRequestOrigin,
  toPublicAssetUrl,
};


const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const appConfig = require("../config/app.config");

let S3ClientRef = null;
let PutObjectCommandRef = null;
const s3ClientCache = new Map();
let resolvedS3Region = "";

function isS3StorageEnabled() {
  return appConfig.storageDriver === "s3";
}

function loadS3Sdk() {
  if (S3ClientRef && PutObjectCommandRef) return;

  try {
    const awsSdk = require("@aws-sdk/client-s3");
    S3ClientRef = awsSdk.S3Client;
    PutObjectCommandRef = awsSdk.PutObjectCommand;
  } catch (error) {
    throw new Error(
      "S3 storage selected, but @aws-sdk/client-s3 is not installed. Run npm install."
    );
  }
}

function normalizeRegion(value) {
  return String(value || "").trim().toLowerCase();
}

function getConfiguredS3Region() {
  const region = normalizeRegion(appConfig.s3Region || process.env.S3_REGION || process.env.AWS_REGION);
  if (!region) {
    throw new Error("S3 storage selected, but S3_REGION (or AWS_REGION) is missing.");
  }
  return region;
}

function getPreferredS3Region() {
  return normalizeRegion(resolvedS3Region || getConfiguredS3Region());
}

function createS3Client(region) {
  const normalizedRegion = normalizeRegion(region);
  if (!normalizedRegion) {
    throw new Error("Unable to create S3 client because region is empty.");
  }

  const cachedClient = s3ClientCache.get(normalizedRegion);
  if (cachedClient) return cachedClient;

  loadS3Sdk();

  const hasExplicitCredentials =
    String(process.env.AWS_ACCESS_KEY_ID || "").trim() &&
    String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();

  const clientConfig = {
    region: normalizedRegion,
    // Retries 301/PermanentRedirect flows when S3 returns the bucket's true region.
    followRegionRedirects: true,
  };

  if (hasExplicitCredentials) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  const client = new S3ClientRef(clientConfig);
  s3ClientCache.set(normalizedRegion, client);
  return client;
}

function getS3Client(regionOverride = "") {
  if (!isS3StorageEnabled()) return null;
  const targetRegion = normalizeRegion(regionOverride || getPreferredS3Region());
  return createS3Client(targetRegion);
}

function getS3BucketName() {
  const bucket = appConfig.s3BucketName;
  if (!bucket) {
    throw new Error("S3 storage selected, but S3_BUCKET_NAME is missing.");
  }
  return bucket;
}

function sanitizeFileName(originalName) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const base = path
    .basename(String(originalName || "file"), ext)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  const safeBase = base || "file";
  return `${safeBase}${ext || ""}`;
}

function buildObjectKey(file) {
  const prefix = appConfig.s3UploadPrefix || "uploads";
  const safeFileName = sanitizeFileName(file?.originalname || file?.filename || "upload");
  const randomHex = crypto.randomBytes(6).toString("hex");
  return `${prefix}/${Date.now()}-${randomHex}-${safeFileName}`;
}

function buildS3PublicUrl({ bucket, region, key }) {
  if (appConfig.s3PublicBaseUrl) {
    return `${appConfig.s3PublicBaseUrl}/${key}`;
  }

  const normalizedRegion = normalizeRegion(region);
  if (!normalizedRegion || normalizedRegion === "us-east-1") {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  return `https://${bucket}.s3.${normalizedRegion}.amazonaws.com/${key}`;
}

function extractRegionFromText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = normalizeRegion(raw);
  if (/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/i.test(normalized)) {
    return normalized;
  }

  const endpointMatch = normalized.match(/s3[.-]([a-z0-9-]+)\.amazonaws\.com/i);
  if (endpointMatch?.[1]) {
    return normalizeRegion(endpointMatch[1]);
  }

  const expectedRegionMatch = raw.match(/expect(?:ing)?\s*['":\s]+([a-z]{2}(?:-gov)?-[a-z]+-\d)/i);
  if (expectedRegionMatch?.[1]) {
    return normalizeRegion(expectedRegionMatch[1]);
  }

  const bucketRegionMatch = raw.match(
    /bucket\s+is\s+in\s+this\s+region\s*[:'\s]+([a-z]{2}(?:-gov)?-[a-z]+-\d)/i
  );
  if (bucketRegionMatch?.[1]) {
    return normalizeRegion(bucketRegionMatch[1]);
  }

  const genericRegionMatch = raw.match(/\b([a-z]{2}(?:-gov)?-[a-z]+-\d)\b/i);
  if (genericRegionMatch?.[1]) {
    return normalizeRegion(genericRegionMatch[1]);
  }

  return "";
}

function extractS3RegionFromError(error) {
  const metadataHeaders = error?.$metadata?.httpHeaders || {};
  const responseHeaders = error?.$response?.headers || {};
  const headerRegion =
    extractRegionFromText(metadataHeaders["x-amz-bucket-region"]) ||
    extractRegionFromText(metadataHeaders["X-Amz-Bucket-Region"]) ||
    extractRegionFromText(responseHeaders["x-amz-bucket-region"]) ||
    extractRegionFromText(responseHeaders["X-Amz-Bucket-Region"]);

  if (headerRegion) return headerRegion;

  const candidates = [
    error?.BucketRegion,
    error?.Region,
    error?.region,
    error?.Endpoint,
    error?.endpoint,
    error?.message,
  ];

  for (const candidate of candidates) {
    const region = extractRegionFromText(candidate);
    if (region) return region;
  }

  return "";
}

function isEndpointMismatchError(error) {
  const code = String(error?.name || error?.Code || "").trim();
  if (
    [
      "PermanentRedirect",
      "AuthorizationHeaderMalformed",
      "IncorrectEndpoint",
      "IllegalLocationConstraintException",
    ].includes(code)
  ) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("must be addressed using the specified endpoint") ||
    message.includes("send all future requests to this endpoint") ||
    message.includes("authorization header is malformed") ||
    message.includes("bucket is in this region")
  );
}

function wrapS3UploadError(error, { bucket, region }) {
  const originalMessage = String(error?.message || "Unknown S3 upload error");
  if (!isEndpointMismatchError(error)) {
    return error;
  }

  const recommendedRegion = extractS3RegionFromError(error);
  const hint = recommendedRegion
    ? ` Use S3_REGION=${recommendedRegion}.`
    : " Verify S3_REGION and S3_BUCKET_NAME point to the same bucket region.";
  const wrapped = new Error(
    `S3 endpoint mismatch while uploading to bucket "${bucket}" (configured region: "${region}"). ${originalMessage}${hint}`
  );
  wrapped.cause = error;
  return wrapped;
}

async function sendPutObject({ bucket, key, contentType, filePath, region }) {
  const s3Client = getS3Client(region);
  const bodyStream = fs.createReadStream(filePath);
  const putObjectInput = {
    Bucket: bucket,
    Key: key,
    Body: bodyStream,
    ContentType: contentType,
  };

  if (appConfig.s3UploadAcl) {
    putObjectInput.ACL = appConfig.s3UploadAcl;
  }

  try {
    const command = new PutObjectCommandRef(putObjectInput);
    await s3Client.send(command);
  } finally {
    bodyStream.destroy();
  }
}

async function uploadSingleFile(file) {
  if (!file) return null;

  if (!isS3StorageEnabled()) {
    return `/uploads/${file.filename}`;
  }

  const bucket = getS3BucketName();
  const configuredRegion = getPreferredS3Region();
  const key = buildObjectKey(file);
  const contentType = String(file.mimetype || "application/octet-stream").trim();
  let uploadRegion = configuredRegion;

  try {
    try {
      await sendPutObject({
        bucket,
        key,
        contentType,
        filePath: file.path,
        region: configuredRegion,
      });
    } catch (error) {
      const fallbackRegion = extractS3RegionFromError(error);
      const canRetryInDifferentRegion =
        isEndpointMismatchError(error) &&
        Boolean(fallbackRegion) &&
        fallbackRegion !== configuredRegion;

      if (!canRetryInDifferentRegion) {
        throw wrapS3UploadError(error, {
          bucket,
          region: configuredRegion,
        });
      }

      resolvedS3Region = fallbackRegion;
      uploadRegion = fallbackRegion;

      await sendPutObject({
        bucket,
        key,
        contentType,
        filePath: file.path,
        region: fallbackRegion,
      });
    }

    return buildS3PublicUrl({
      bucket,
      region: uploadRegion,
      key,
    });
  } finally {
    fs.promises.unlink(file.path).catch(() => undefined);
  }
}

module.exports = {
  isS3StorageEnabled,
  uploadSingleFile,
};

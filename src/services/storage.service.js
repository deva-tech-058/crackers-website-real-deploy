const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const appConfig = require("../config/app.config");

let S3ClientRef = null;
let PutObjectCommandRef = null;
let s3ClientInstance = null;

function isS3StorageEnabled() {
  return appConfig.storageDriver === "s3";
}

function getS3Client() {
  if (!isS3StorageEnabled()) return null;

  if (!S3ClientRef || !PutObjectCommandRef) {
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

  if (s3ClientInstance) return s3ClientInstance;

  const region = appConfig.s3Region || process.env.AWS_REGION || "";
  if (!region) {
    throw new Error("S3 storage selected, but S3_REGION (or AWS_REGION) is missing.");
  }

  const hasExplicitCredentials =
    String(process.env.AWS_ACCESS_KEY_ID || "").trim() &&
    String(process.env.AWS_SECRET_ACCESS_KEY || "").trim();

  const clientConfig = { region };
  if (hasExplicitCredentials) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  s3ClientInstance = new S3ClientRef(clientConfig);
  return s3ClientInstance;
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

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function uploadSingleFile(file) {
  if (!file) return null;

  if (!isS3StorageEnabled()) {
    return `/uploads/${file.filename}`;
  }

  const s3Client = getS3Client();
  const bucket = getS3BucketName();
  const region = appConfig.s3Region || process.env.AWS_REGION;
  const key = buildObjectKey(file);
  const contentType = String(file.mimetype || "application/octet-stream").trim();
  const bodyStream = fs.createReadStream(file.path);
  const putObjectInput = {
    Bucket: bucket,
    Key: key,
    Body: bodyStream,
    ContentType: contentType,
  };

  if (appConfig.s3UploadAcl) {
    putObjectInput.ACL = appConfig.s3UploadAcl;
  }

  const command = new PutObjectCommandRef(putObjectInput);

  await s3Client.send(command);

  fs.promises.unlink(file.path).catch(() => undefined);

  return buildS3PublicUrl({
    bucket,
    region,
    key,
  });
}

module.exports = {
  isS3StorageEnabled,
  uploadSingleFile,
};

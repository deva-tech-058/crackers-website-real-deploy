const appConfig = require("../config/app.config");

function errorMiddleware(err, req, res, next) {
  console.error(err);

  const errorCode = String(err?.code || "").trim().toUpperCase();
  const isMulterError = String(err?.name || "").trim() === "MulterError";

  if (errorCode === "LIMIT_FILE_SIZE") {
    const message = `File too large. Maximum allowed size is ${appConfig.uploadFileMaxMb}MB.`;
    return res.status(413).json({
      error: message,
      message,
    });
  }

  if (isMulterError) {
    if (errorCode === "LIMIT_UNEXPECTED_FILE") {
      const message = "Unexpected upload field. Use 'image' or 'video' only.";
      return res.status(400).json({
        error: message,
        message,
      });
    }

    if (errorCode === "LIMIT_FILE_COUNT" || errorCode === "LIMIT_PART_COUNT") {
      const message = "Too many files in request. Please upload one file per field.";
      return res.status(400).json({
        error: message,
        message,
      });
    }
  }

  if (Number(err?.status) === 413) {
    const message =
      err.message || `Request too large. Maximum allowed size is ${appConfig.uploadFileMaxMb}MB.`;
    return res.status(413).json({
      error: message,
      message,
    });
  }

  const status = Number(err?.status) || 500;
  const message = err?.message || "Internal Server Error";
  return res.status(status).json({
    error: message,
    message,
  });
}

module.exports = errorMiddleware;

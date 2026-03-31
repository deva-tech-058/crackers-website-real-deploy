const appConfig = require("../config/app.config");

function errorMiddleware(err, req, res, next) {
  console.error(err);

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `File too large. Maximum allowed size is ${appConfig.uploadFileMaxMb}MB.`,
    });
  }

  if (Number(err?.status) === 413) {
    return res.status(413).json({
      error: err.message || `Request too large. Maximum allowed size is ${appConfig.uploadFileMaxMb}MB.`,
    });
  }

  return res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
}

module.exports = errorMiddleware;

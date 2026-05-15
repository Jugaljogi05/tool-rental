import multer from "multer";

const errorHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }

  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      status: "fail",
      message: "Request payload is too large. Try fewer or smaller images.",
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      status: "fail",
      message: "Invalid JSON payload.",
    });
  }

  const statusCode = err.statusCode || 500;
  const message =
    err.isOperational || process.env.NODE_ENV !== "production"
      ? err.message
      : "Something went wrong.";

  return res.status(statusCode).json({
    status: "error",
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

export default errorHandler;

import multer from "multer";

const errorHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      status: "fail",
      message: err.message,
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

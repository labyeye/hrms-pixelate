const errorHandler = (err, req, res, next) => {
  const status = res.statusCode !== 200 ? res.statusCode : 500;

  // Always log full error server-side for debugging
  if (process.env.NODE_ENV !== "test") {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} — ${err.message}`,
    );
    if (status === 500) console.error(err.stack);
  }

  // Map internal Mongoose / validation errors to safe client messages
  let message = err.message || "An unexpected error occurred";

  // Mongoose duplicate key — don't expose field names from DB
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    message =
      field === "email"
        ? "An account with this email already exists"
        : "A record with this value already exists";
  }

  // Mongoose cast error (bad ObjectId) — keep generic
  if (err.name === "CastError") message = "Invalid resource identifier";

  // Mongoose validation errors — show first message but not field path
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    message = first?.message || "Validation failed";
  }

  // JWT errors — don't expose algorithm/secret details
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    message = "Not authorized, please log in again";
  }

  res.status(status).json({
    success: false,
    message,
    // Stack traces only in development — never in production or test
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;

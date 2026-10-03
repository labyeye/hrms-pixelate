// Mongoose says "Path `name` is required." — turn that into something a client can act on.
const label = (p) =>
  String(p || "field")
    .split(".")
    .pop()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
const friendly = (v) =>
  v.kind === "required"
    ? `${label(v.path)} is required`
    : v.name === "CastError"
      ? `${label(v.path)} is not valid`
      : v.message;

const errorHandler = (err, req, res, next) => {
  const status = res.statusCode !== 200 ? res.statusCode : 500;

  if (process.env.NODE_ENV !== "test") {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} — ${status} ${err.message}`,
    );
    if (status === 500 && process.env.NODE_ENV !== "production") {
      console.error(err.stack);
    }
  }

  let message = err.message || "An unexpected error occurred";

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    message =
      field === "email"
        ? "An account with this email already exists"
        : "A record with this value already exists";
  }

  if (err.name === "CastError") message = "Invalid resource identifier";

  // Never leak internals (stack hints, driver errors) to clients on a server fault.
  if (status >= 500 && process.env.NODE_ENV === "production")
    message = "Something went wrong on our side. Please try again in a moment.";

  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    message = first ? friendly(first) : "Validation failed";
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    message = "Not authorized, please log in again";
  }

  res.status(status).json({
    success: false,
    message,

    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;

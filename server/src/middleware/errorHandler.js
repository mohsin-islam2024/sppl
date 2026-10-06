import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";

/** 404 for any unmatched route. */
export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Translate any thrown error into one consistent JSON envelope:
 *
 *   { success: false, message, details?, stack? }
 *
 * Mongoose and Zod errors are mapped to sensible status codes so controllers never
 * need to translate driver errors by hand.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, _next) => {
  let statusCode = error.statusCode ?? 500;
  let message = error.message ?? "Something went wrong";
  let details = error.details;

  // Mongoose: bad ObjectId, cast failure
  if (error.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${error.path}`;
  }

  // Mongoose: schema validation
  if (error.name === "ValidationError" && error.errors) {
    statusCode = 422;
    message = "Validation failed";
    details = Object.values(error.errors).map((issue) => ({
      field: issue.path,
      message: issue.message,
    }));
  }

  // Mongo: duplicate key
  if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyValue ?? {})[0] ?? "field";
    message = `Duplicate value for ${field}`;
    details = error.keyValue;
  }

  // JWT / body-parser
  if (error.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Malformed JSON body";
  }

  if (statusCode >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}]`, error);
  } else {
    logger.warn(
      `[${req.method} ${req.originalUrl}] ${statusCode} — ${message}`,
    );
  }

  const payload = {
    success: false,
    message,
    ...(details ? { details } : {}),
  };

  // The stack only leaves the server in development.
  if (env.isDevelopment && statusCode >= 500) {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
};

export default errorHandler;

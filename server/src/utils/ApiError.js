/**
 * Operational error carrying an HTTP status. Thrown by controllers/services and
 * translated into a JSON response by the central error handler.
 */
export default class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {object} [details]
   */
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message);
  }

  static forbidden(message = "You do not have permission for this action") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Resource already exists") {
    return new ApiError(409, message);
  }

  static tooMany(message = "Too many requests") {
    return new ApiError(429, message);
  }

  static internal(message = "Something went wrong") {
    return new ApiError(500, message);
  }
}

import zodToJsonSchema from "./zodToJsonSchema.js";

/**
 * Map a Zod schema onto an Express middleware.
 *
 * Parsed values REPLACE req.body / req.query / req.params so controllers always
 * receive coerced, trimmed, validated data instead of raw strings.
 */
export const validate =
  (schemas = {}) =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) req.query = schemas.query.parse(req.query ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      return next();
    } catch (error) {
      if (error?.name === "ZodError") {
        const details = error.issues.map((issue) => ({
          field: issue.path.join(".") || "_",
          message: issue.message,
        }));
        const apiError = new Error("Validation failed");
        apiError.statusCode = 422;
        apiError.details = details;
        apiError.isOperational = true;
        return next(apiError);
      }
      return next(error);
    }
  };

export { zodToJsonSchema };
export default validate;

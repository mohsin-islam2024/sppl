import ApiError from "../utils/ApiError.js";

/**
 * Gate a route to assigned staff only.
 *
 * A scorer sees every match, but may only write to the match they were assigned.
 * Umpires may confirm details on their own matches. Admins bypass the check.
 *
 * The middleware is generic: the caller supplies a loader that resolves the match
 * from the request, so this file needs no knowledge of the Match model.
 */
export const requireAssigned =
  ({
    loadResource,
    isAssigned,
    bypassRoles = ["ADMIN", "SUPER_ADMIN"],
    message,
  }) =>
  async (req, _res, next) => {
    try {
      if (!req.user) throw ApiError.unauthorized();
      if (bypassRoles.includes(req.user.role)) return next();

      const resource = await loadResource(req);
      if (!resource) throw ApiError.notFound("Resource not found");

      if (!isAssigned(req, resource)) {
        throw ApiError.forbidden(
          message ?? "You are not assigned to this match",
        );
      }

      req.resource = resource;
      return next();
    } catch (error) {
      return next(error);
    }
  };

export default requireAssigned;

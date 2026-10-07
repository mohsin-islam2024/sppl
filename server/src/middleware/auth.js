import ApiError from "../utils/ApiError.js";
import { verifyIdToken } from "../config/firebaseAdmin.js";
import { User } from "../models/User.js";
import { ROLES, ROLE_HIERARCHY } from "@sppl/shared/constants/roles.js";

/**
 * Pull the Bearer token out of the Authorization header.
 */
const extractToken = (req) => {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * Require a valid Firebase ID token.
 *
 * On success `req.auth` carries the decoded token and `req.user` the mirrored
 * Mongo user. The ROLE IS READ FROM THE VERIFIED TOKEN CLAIM, never from the
 * request body or query — that is the whole point of doing this on the server.
 */
export const requireAuth = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized("Missing bearer token");

    let decoded;
    try {
      decoded = await verifyIdToken(token);
    } catch (error) {
      // Expired or forged tokens are a client problem, not a server fault.
      throw ApiError.unauthorized(
        `Invalid or expired token: ${error.code ?? "auth/error"}`,
      );
    }

    const user = await User.findOne({ firebaseUid: decoded.uid }).lean();
    if (!user) {
      throw ApiError.unauthorized("User is not registered on this platform");
    }
    if (user.active === false) {
      throw ApiError.forbidden("This account has been deactivated");
    }

    // The claim is authoritative; the document value is a fallback for accounts
    // whose claim was set before the role store existed.
    const role = decoded.role ?? user.role ?? ROLES.USER;

    req.auth = decoded;
    req.user = { ...user, role };
    return next();
  } catch (error) {
    return next(error);
  }
};



/**
 * Verify a Firebase token WITHOUT requiring an existing MongoDB user.
 *
 * Used only by the account-bootstrap route. Every other protected route needs
 * `requireAuth`, because they act on a user who must already exist — but `sync`
 * is the call that CREATES that user, so requiring one first is circular: the
 * first login of every new account would fail with 401.
 */
export const requireAuthAllowNew = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Missing bearer token');

    let decoded;
    try {
      decoded = await verifyIdToken(token);
    } catch (error) {
      throw ApiError.unauthorized(`Invalid or expired token: ${error.code ?? 'auth/error'}`);
    }

    // The user may or may not exist yet — that is exactly what sync decides.
    const user = await User.findOne({ firebaseUid: decoded.uid }).lean();

    req.auth = decoded;
    req.user = user ? { ...user, role: decoded.role ?? user.role } : null;
    return next();
  } catch (error) {
    return next(error);
  }
};


/**
 * Attach the user when a token is present, but never reject anonymous traffic.
 * Used on public endpoints that behave better when they know who is asking
 * (e.g. marking a player's own profile as editable).
 */
export const optionalAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = await verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decoded.uid }).lean();
    if (user && user.active !== false) {
      req.auth = decoded;
      req.user = { ...user, role: decoded.role ?? user.role ?? ROLES.USER };
    }
  } catch {
    // An invalid token on an optional route simply means "stay anonymous".
  }
  return next();
};

/**
 * Restrict a route to specific roles. Must run after `requireAuth`.
 */
export const requireRole =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const role = req.user.role;
    if (allowedRoles.length === 0) return next();
    if (!allowedRoles.includes(role)) {
      return next(
        ApiError.forbidden(
          `This action requires one of: ${allowedRoles.join(", ")}`,
        ),
      );
    }
    return next();
  };

/**
 * Restrict a route to a minimum role level, using the shared hierarchy.
 * e.g. `requireMinRole(ROLES.ADMIN)` lets ADMIN and SUPER_ADMIN through.
 */
export const requireMinRole = (minimumRole) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  const current = ROLE_HIERARCHY[req.user.role] ?? -1;
  const required = ROLE_HIERARCHY[minimumRole] ?? Infinity;
  if (current < required) {
    return next(ApiError.forbidden(`Requires ${minimumRole} access or higher`));
  }
  return next();
};

/**
 * Allow a user to touch a resource they own, or anyone with an elevated role.
 * Anything finer-grained than "own record vs staff" belongs in the service layer.
 */
export const requireSelfOrStaff =
  (...staffRoles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const isStaff = staffRoles.includes(req.user.role);
    const isSelf = String(req.user._id) === String(req.params.id);
    if (!isStaff && !isSelf) {
      return next(ApiError.forbidden("You may only modify your own record"));
    }
    return next();
  };

export default requireAuth;

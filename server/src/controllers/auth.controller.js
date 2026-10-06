import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import { syncUser } from "../services/userService.js";
import ApiError from "../utils/ApiError.js";

/**
 * POST /api/v1/auth/sync
 *
 * Called by the client immediately after a successful Firebase login. `requireAuth`
 * has already verified the token, so identity is trustworthy by the time we get
 * here; this handler only needs to mirror the account and return it.
 */
export const sync = asyncHandler(async (req, res) => {
  const { name, photoUrl } = req.body ?? {};

  const user = await syncUser({
    decoded: req.auth,
    name,
    photoUrl,
  });

  res.status(200).json(ok(user));
});

/**
 * GET /api/v1/auth/me
 *
 * Returns the mirrored account for the current token. The client uses this to
 * decide which admin screens to show.
 */
export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  res.status(200).json(ok(req.user));
});

/**
 * DELETE /api/v1/auth/session
 *
 * Server-side logout hook. Firebase sessions are revoked client-side, so this only
 * records the intent — it exists so a future "sign out everywhere" feature has an
 * endpoint to grow into rather than requiring a new route.
 */
export const endSession = asyncHandler(async (req, res) => {
  res.status(200).json(ok({ ended: Boolean(req.user) }));
});

export default { sync, me, endSession };

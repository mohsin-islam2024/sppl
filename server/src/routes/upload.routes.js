import { Router } from "express";
import {
  getSignature,
  registerAsset,
  deleteAsset,
  listFolders,
} from "../controllers/upload.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { uploadLimiter, writeLimiter } from "../middleware/rateLimit.js";
import { ROLES } from "@sppl/shared/constants/roles.js";
import { signUploadSchema } from "@sppl/shared/validation/schemas.js";

const router = Router();

/**
 * Media upload routes.
 *
 * Signed uploads are admin-only. A public signature endpoint would let anyone fill
 * the site's Cloudinary account with arbitrary files — the storage bill lands on the
 * organizer, so the permission has to match.
 *
 * The upload limiter is separate from the write limiter because image uploads are
 * far more expensive than a form save: 30 per hour is generous for a four-team
 * tournament and still caps the damage from a stuck client.
 */
router.use(requireAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

/** Ask for a signature before uploading. */
router.post(
  "/sign",
  uploadLimiter,
  validate({ body: signUploadSchema }),
  getSignature,
);

/** Report an asset the browser has already uploaded. */
router.post("/register", writeLimiter, registerAsset);

/** Remove an asset from Cloudinary and from the Media table. */
router.delete("/:publicId", writeLimiter, deleteAsset);

/** The folder list, for the admin form. */
router.get("/folders", listFolders);

export default router;

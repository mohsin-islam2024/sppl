import { Router } from "express";
import {
  listUsers,
  getUser,
  updateUserRole,
  updateOwnProfile,
  deactivateUser,
} from "../controllers/user.controller.js";
import {
  requireAuth,
  requireRole,
  requireSelfOrStaff,
} from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  updateUserRoleSchema,
  updateProfileSchema,
} from "@sppl/shared/validation/schemas.js";
import { ROLES } from "@sppl/shared/constants/roles.js";

const router = Router();

router.use(requireAuth);

/** Self-service first so `/me` is never swallowed by the `/:id` matcher. */
router.patch(
  "/me",
  writeLimiter,
  validate({ body: updateProfileSchema }),
  updateOwnProfile,
);

router.get("/", requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), listUsers);
router.get(
  "/:id",
  requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  requireSelfOrStaff(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  getUser,
);
router.patch(
  "/:id/role",
  writeLimiter,
  requireRole(ROLES.SUPER_ADMIN),
  validate({ body: updateUserRoleSchema }),
  updateUserRole,
);
router.delete(
  "/:id",
  writeLimiter,
  requireRole(ROLES.SUPER_ADMIN),
  deactivateUser,
);

export default router;

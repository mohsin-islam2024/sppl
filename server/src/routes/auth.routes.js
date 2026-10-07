import { Router } from "express";
import { sync, me, endSession } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAuthAllowNew } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { syncUserSchema } from "@sppl/shared/validation/schemas.js";

const router = Router();

/**
 * Account bootstrap happens once per login, so it sits behind the write limiter —
 * a broken client loop should not be able to hammer Firebase verification.
 */
router.post(
  "/sync",
  writeLimiter,
  requireAuthAllowNew,
  validate({ body: syncUserSchema }),
  sync,
);

router.get("/me", requireAuth, me);
router.delete("/session", requireAuth, endSession);

export default router;

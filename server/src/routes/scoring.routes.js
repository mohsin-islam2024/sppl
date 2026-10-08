import { Router } from "express";
import * as scoring from "../controllers/scoring.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireAssigned } from "../middleware/requireAssigned.js";
import { validate } from "../middleware/validate.js";
import { scoringLimiter, writeLimiter } from "../middleware/rateLimit.js";
import { Match } from "../models/Match.js";
import {
  recordBallSchema,
  undoBallSchema,
} from "@sppl/shared/validation/schemas.js";
import { ROLES, SCORING_ROLES } from "@sppl/shared/constants/roles.js";

const router = Router();

/**
 * Scoring routes.
 *
 * Three gates, and each one catches something the others cannot:
 *
 *   requireAuth     verifies the Firebase token
 *   requireRole     SCORER, ADMIN or SUPER_ADMIN — checked on the verified claim
 *   requireAssigned the scorer must be assigned to THIS match
 *
 * Admins bypass the assignment check deliberately: when something goes wrong
 * mid-match the organizer needs to be able to take over immediately, and hunting for
 * a reassignment screen while a match is running would be absurd.
 */
router.use(requireAuth);
router.use(requireRole(...SCORING_ROLES));

/** Load a match and check the caller is allowed to score it. */
const assignedToMatch = requireAssigned({
  loadResource: (req) =>
    Match.findById(req.params.matchId).select("scorerId seasonId").lean(),
  isAssigned: (req, match) => {
    // An unassigned match is open to any scorer — a new fixture has nobody attached
    // yet, and blocking it would mean no match could ever be started.
    if (!match.scorerId) return true;
    return String(match.scorerId) === String(req.user._id);
  },
  message: "This match is assigned to a different scorer",
});

/** The list is open to any scorer so they can see what is coming up. */
router.get("/matches", scoring.listScorableMatches);

router.get("/:matchId", scoring.getScoringContext);
router.get("/:matchId/squad/:teamId", scoring.getSquad);

/** Starting a match claims it for the caller. */
router.post("/:matchId/start", writeLimiter, scoring.startMatch);

/**
 * The hot path. The scoring limiter allows 600 per 10 minutes, which is two full
 * innings plus corrections — generous enough never to block a real scorer, tight
 * enough to stop a stuck retry loop.
 */
router.post(
  "/:matchId/ball",
  scoringLimiter,
  assignedToMatch,
  validate({ body: recordBallSchema }),
  scoring.recordBall,
);

router.post(
  "/:matchId/players",
  writeLimiter,
  assignedToMatch,
  scoring.setPlayers,
);

router.post("/:matchId/undo", writeLimiter, assignedToMatch, scoring.undoBall);
router.post(
  "/:matchId/end-innings",
  writeLimiter,
  assignedToMatch,
  scoring.endInnings,
);
router.patch("/:matchId/result", writeLimiter, scoring.setResult);

export default router;

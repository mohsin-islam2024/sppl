import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { ROLES } from "@sppl/shared/constants/roles.js";
import {
  createSeasonSchema,
  updateSeasonSchema,
  createTeamSchema,
  updateTeamSchema,
  createPlayerSchema,
  updatePlayerSchema,
  createMatchSchema,
  updateMatchSchema,
} from "@sppl/shared/validation/schemas.js";

const router = Router();

/**
 * Admin routes.
 *
 * Two gates on every request, and both are necessary:
 *
 *   requireAuth   verifies the Firebase token and loads the mirrored user
 *   requireRole   checks the role ON THE VERIFIED TOKEN, never the request body
 *
 * Every write also passes the write limiter — an admin retrying a failed save in a
 * loop should not be able to hammer the database.
 */
router.use(requireAuth);
router.use(requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

/* Reads */
router.get("/seasons", admin.listSeasons);
router.get("/teams", admin.listTeams);
router.get("/players", admin.listPlayers);
router.get("/matches", admin.listMatches);
router.get("/selectors", admin.listSelectors);

/* Seasons */
router.post(
  "/seasons",
  writeLimiter,
  validate({ body: createSeasonSchema }),
  admin.createSeason,
);
router.patch(
  "/seasons/:id",
  writeLimiter,
  validate({ body: updateSeasonSchema }),
  admin.updateSeason,
);
router.delete("/seasons/:id", writeLimiter, admin.deleteSeason);

/* Teams */
router.post(
  "/teams",
  writeLimiter,
  validate({ body: createTeamSchema }),
  admin.createTeam,
);
router.patch(
  "/teams/:id",
  writeLimiter,
  validate({ body: updateTeamSchema }),
  admin.updateTeam,
);
router.delete("/teams/:id", writeLimiter, admin.deleteTeam);

/* Players */
router.post(
  "/players",
  writeLimiter,
  validate({ body: createPlayerSchema }),
  admin.createPlayer,
);
router.patch(
  "/players/:id",
  writeLimiter,
  validate({ body: updatePlayerSchema }),
  admin.updatePlayer,
);
router.delete("/players/:id", writeLimiter, admin.deletePlayer);

/* Matches */
router.post(
  "/matches",
  writeLimiter,
  validate({ body: createMatchSchema }),
  admin.createMatch,
);
router.patch(
  "/matches/:id",
  writeLimiter,
  validate({ body: updateMatchSchema }),
  admin.updateMatch,
);
router.delete("/matches/:id", writeLimiter, admin.deleteMatch);

export default router;

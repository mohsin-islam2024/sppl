import { Router } from "express";
import {
  listSeasons,
  getCurrentSeason,
  getSeason,
  getSeasonRules,
  getSeasonSummary,
  listSeasonTeams,
  listSeasonFixtures,
} from "../controllers/season.controller.js";

const router = Router();

/**
 * Public season reads. No authentication: the whole point of the site is that a
 * visitor can see fixtures and standings without an account.
 *
 * `/current` is declared before `/:identifier` so it is not swallowed by the
 * parameterised route.
 */
router.get("/seasons", listSeasons);
router.get("/seasons/current", getCurrentSeason);
router.get("/seasons/:identifier", getSeason);
router.get("/seasons/:identifier/rules", getSeasonRules);
router.get("/seasons/:identifier/summary", getSeasonSummary);
router.get("/seasons/:identifier/teams", listSeasonTeams);
router.get("/seasons/:identifier/fixtures", listSeasonFixtures);

export default router;

import { Router } from "express";
import {
  listMatches,
  getLiveMatch,
  getMatch,
  getScorecard,
  getBallByBall,
} from "../controllers/match.controller.js";

const router = Router();

/**
 * Public match reads.
 *
 * `/live` precedes `/:id` so the literal segment is not read as a match id.
 */
router.get("/live", getLiveMatch);
router.get("/", listMatches);
router.get("/:id", getMatch);
router.get("/:id/scorecard", getScorecard);
router.get("/:id/balls", getBallByBall);

export default router;

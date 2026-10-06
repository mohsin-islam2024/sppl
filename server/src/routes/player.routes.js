import { Router } from "express";
import {
  listPlayers,
  getPlayer,
  getPlayerStats,
  comparePlayers,
} from "../controllers/player.controller.js";
import { validate } from "../middleware/validate.js";
import { paginationSchema } from "@sppl/shared/validation/schemas.js";

const router = Router();

/**
 * Public player reads.
 *
 * `/compare` is declared before `/:id` so the literal path is not captured by the
 * id route — otherwise a request for `/players/compare` would look up a player
 * whose id is the string "compare".
 */
router.get("/compare", comparePlayers);
router.get("/", validate({ query: paginationSchema }), listPlayers);
router.get("/:id", getPlayer);
router.get("/:id/stats", getPlayerStats);

export default router;

import { Router } from "express";
import {
  listTeams,
  getTeam,
  listTeamPlayers,
} from "../controllers/team.controller.js";
import { validate } from "../middleware/validate.js";
import { paginationSchema } from "@sppl/shared/validation/schemas.js";

const router = Router();

/** Public team reads. */
router.get("/", listTeams);
router.get("/:slug", getTeam);
router.get(
  "/:slug/players",
  validate({ query: paginationSchema }),
  listTeamPlayers,
);

export default router;

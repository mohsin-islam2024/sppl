import { z } from "zod";
import { objectId } from "./schemas.js";

/** Body of PATCH /users/:id/active — switch an account on or off. */
export const setUserActiveSchema = z.object({
  active: z.boolean(),
});

/** One side of a super over: who batted, and what they made in their single over. */
const superOverSide = z.object({
  teamId: objectId,
  runs: z.coerce.number().int().min(0).max(200),
  wickets: z.coerce.number().int().min(0).max(10),
});

/**
 * Body of POST /scoring/:matchId/super-over.
 *
 * `tiebreakWinnerTeamId` is only read when a knockout super over is level and the
 * organisers have to name a winner.
 */
export const recordSuperOverSchema = z.object({
  first: superOverSide,
  second: superOverSide,
  tiebreakWinnerTeamId: objectId.nullable().optional(),
});

/** Body of POST /admin/matches/generate-final. */
export const generateFinalSchema = z.object({
  seasonId: objectId,
  startAt: z.coerce.date(),
  venue: z.string().trim().max(200).optional(),
});

/** Body of POST /scoring/:matchId/substitute — replace a player who cannot continue. */
export const substitutePlayerSchema = z.object({
  teamId: objectId,
  outPlayerId: objectId,
  inPlayerId: objectId,
});

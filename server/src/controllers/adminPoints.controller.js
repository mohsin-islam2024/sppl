import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import ApiError from "../utils/ApiError.js";
import { resolveSeason, sortStandings } from "../services/seasonService.js";
import { createMatch } from "../services/adminService.js";
import { Match } from "../models/Match.js";
import { PointsTable } from "../models/PointsTable.js";
import { Season } from "../models/Season.js";
import * as scoringService from "../services/scoringService.js";

/**
 * POST /api/v1/admin/points/recalculate?season=
 *
 * Rebuilds the standings of a season from its completed matches.
 *
 * The points table is never edited by hand: it is derived data. It is refreshed
 * automatically after every match, so this endpoint is for the occasions when the
 * inputs changed behind the scorer's back — a result corrected in the database, a
 * match deleted, a team renamed — and the stored table no longer agrees with them.
 */
export const recalculatePoints = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.badRequest("A season is required");

  await scoringService.refreshPointsTable(season._id, season.matchRules ?? {});

  res.status(200).json(ok({ seasonId: season._id }, "Points table recalculated"));
});

/** How many league matches are still to be played, counting only matches that can still change the table. */
const UNFINISHED = ["UPCOMING", "TOSS", "LIVE", "INNINGS_BREAK"];

/**
 * POST /api/v1/admin/matches/generate-final
 *
 * Creates the FINAL between the top two teams of the finished league.
 *
 * Refused unless the league is over, and refused if a final already exists, so a
 * double click cannot schedule two finals. The standings are rebuilt first so the
 * pairing comes from the matches as they stand, not from a stale stored table. Who
 * is "top" is decided by the same sort the points page uses (points, then net run
 * rate), never by a second implementation that could disagree with it.
 */
export const generateFinal = asyncHandler(async (req, res) => {
  const { seasonId, startAt, venue } = req.body;

  const season = await Season.findById(seasonId);
  if (!season) throw ApiError.badRequest("Season not found");

  const league = { seasonId: season._id, stage: { $nin: ["SEMI_FINAL", "FINAL"] } };

  const [unfinished, existingFinal] = await Promise.all([
    Match.countDocuments({ ...league, status: { $in: UNFINISHED } }),
    Match.findOne({ seasonId: season._id, stage: "FINAL" }).select("_id").lean(),
  ]);

  if (existingFinal) throw ApiError.conflict("This season already has a final");
  if (unfinished > 0) {
    throw ApiError.badRequest(
      `The league is not finished yet: ${unfinished} match(es) still to be played`,
    );
  }

  await scoringService.refreshPointsTable(season._id, season.matchRules ?? {});

  const rows = await PointsTable.find({ seasonId: season._id }).lean();
  const [top, second] = sortStandings(rows);
  if (!top || !second) throw ApiError.badRequest("At least two teams are needed for a final");

  const last = await Match.findOne({ seasonId: season._id }).sort({ matchNo: -1 }).select("matchNo").lean();

  const match = await createMatch({
    seasonId: season._id,
    matchNo: (last?.matchNo ?? 0) + 1,
    stage: "FINAL",
    teamAId: top.teamId,
    teamBId: second.teamId,
    venue: venue ?? "",
    startAt,
  });

  res.status(201).json(ok(match, "Final created"));
});

export default { recalculatePoints, generateFinal };

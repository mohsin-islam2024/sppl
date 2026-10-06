import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import { PointsTable } from "../models/PointsTable.js";
import { Match } from "../models/Match.js";
import {
  resolveSeason,
  sortStandings,
  toStandingRow,
} from "../services/seasonService.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/v1/points-table
 *
 * Standings for a season, in the correct order.
 *
 * Sorting happens on the server and positions are assigned here. The client must
 * never re-sort this table: with a four-team league the points tiebreak decides who
 * reaches the final, and two implementations would eventually disagree.
 */
export const getPointsTable = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.notFound("No season found");

  const rows = await PointsTable.find({ seasonId: season._id })
    .populate("teamId", "name shortName slug logoUrl themeColor")
    .lean();

  const ordered = sortStandings(rows).map((row, index) => ({
    ...toStandingRow(row),
    position: index + 1,
  }));

  // How far through the league the season is — useful for a "matchday" label and
  // for deciding whether the table is meaningful yet.
  const [totalMatches, completedMatches] = await Promise.all([
    Match.countDocuments({ seasonId: season._id, stage: "LEAGUE" }),
    Match.countDocuments({
      seasonId: season._id,
      stage: "LEAGUE",
      status: "COMPLETED",
    }),
  ]);

  res.status(200).json(
    ok({
      seasonId: season._id,
      seasonSlug: season.slug,
      status: season.status,
      progress: {
        totalMatches,
        completedMatches,
        isComplete: totalMatches > 0 && completedMatches >= totalMatches,
        // No points can have been earned before a ball is bowled, so the client can
        // show an empty-state notice rather than a table of zeros.
        hasPlayedAny: completedMatches > 0,
      },
      table: ordered,
    }),
  );
});

export default { getPointsTable };

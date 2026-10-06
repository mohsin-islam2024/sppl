import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, toArray } from "../utils/helpers.js";
import { Season } from "../models/Season.js";
import { Team } from "../models/Team.js";
import { Match } from "../models/Match.js";
import {
  resolveSeason,
  buildSeasonSummary,
  toSeasonCard,
  toTeamChip,
  toMatchCard,
} from "../services/seasonService.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/v1/seasons
 *
 * Every season, newest first, so the switcher can show Season 2 and Season 1
 * side by side. `current` marks the one a visitor should land on by default.
 */
export const listSeasons = asyncHandler(async (_req, res) => {
  const [seasons, current] = await Promise.all([
    Season.find({}).sort({ seasonNo: -1 }).lean(),
    resolveSeason(null),
  ]);

  const currentId = current?._id ? String(current._id) : null;

  const items = await Promise.all(
    seasons.map(async (season) => {
      const [teamCount, matchCount] = await Promise.all([
        Team.countDocuments({ seasonId: season._id, active: true }),
        Match.countDocuments({ seasonId: season._id }),
      ]);

      return {
        ...toSeasonCard(season),
        isCurrent: String(season._id) === currentId,
        teamCount,
        matchCount,
      };
    }),
  );

  res.status(200).json(ok(items));
});

/**
 * GET /api/v1/seasons/current
 *
 * The season the home page should default to. Resolves by status rather than by
 * date, because a season may be UPCOMING with no date set (Season 2 is exactly
 * that right now).
 */
export const getCurrentSeason = asyncHandler(async (_req, res) => {
  const season = await resolveSeason(null);
  if (!season) throw ApiError.notFound("No season has been created yet");
  res.status(200).json(ok(toSeasonCard(season)));
});

/**
 * GET /api/v1/seasons/:identifier
 *
 * `identifier` is a season slug (`sppl-2-2027`) or a Mongo id. The slug is what
 * the client puts in the URL, so the public link stays readable.
 */
export const getSeason = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.params.identifier, { required: true });
  res.status(200).json(ok(toSeasonCard(season)));
});

/**
 * GET /api/v1/seasons/:identifier/rules
 *
 * Rules and points system, for the Rules page. Kept on its own endpoint because
 * it is static text that the client caches indefinitely, while the season's
 * standings change with every match.
 */
export const getSeasonRules = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.params.identifier, { required: true });

  res.status(200).json(
    ok({
      seasonId: season._id,
      slug: season.slug,
      matchRules: season.matchRules ?? {},
      pointsSystem: season.pointsSystem ?? {},
    }),
  );
});

/**
 * GET /api/v1/seasons/:identifier/summary
 *
 * Everything the home page needs in one call: counts, the live match (if any),
 * the next fixture, the latest result and a trimmed points table.
 *
 * A single endpoint here is a deliberate choice — the home page would otherwise
 * fire five requests, and on the connection this audience actually uses, the
 * round trips cost more than the payload.
 */
export const getSeasonSummary = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.params.identifier, { required: true });
  const summary = await buildSeasonSummary(season);
  res.status(200).json(ok(summary));
});

/**
 * GET /api/v1/seasons/:identifier/teams
 * Teams in a season, in the organizer's display order.
 */
export const listSeasonTeams = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.params.identifier, { required: true });

  const teams = await Team.find({ seasonId: season._id, active: true })
    .sort({ order: 1, name: 1 })
    .lean();

  res.status(200).json(
    ok(
      teams.map((team) => ({
        ...toTeamChip(team),
        captainPlayerId: team.captainPlayerId ?? null,
        viceCaptainPlayerId: team.viceCaptainPlayerId ?? null,
        squadSize: team.squadSize ?? 0,
      })),
    ),
  );
});

/**
 * GET /api/v1/seasons/:identifier/fixtures
 *
 * Query params:
 *   status   comma separated match statuses, e.g. `UPCOMING` or `COMPLETED,LIVE`
 *   stage    `LEAGUE` or `FINAL`
 *   limit    default 100
 *
 * Fixtures and results share this endpoint: a result is simply a fixture whose
 * status is COMPLETED, and splitting them would duplicate the populate and sort.
 */
export const listSeasonFixtures = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.params.identifier, { required: true });

  const filter = { seasonId: season._id };

  const statuses = toArray(req.query.status);
  if (statuses.length) filter.status = { $in: statuses };

  if (req.query.stage) filter.stage = req.query.stage;

  const limit = Math.min(Number(req.query.limit) || 100, 200);

  const matches = await Match.find(filter)
    .sort({ startAt: 1, matchNo: 1 })
    .limit(limit)
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .lean();

  res.status(200).json(ok(matches.map(toMatchCard)));
});

export default {
  listSeasons,
  getCurrentSeason,
  getSeason,
  getSeasonRules,
  getSeasonSummary,
  listSeasonTeams,
  listSeasonFixtures,
};

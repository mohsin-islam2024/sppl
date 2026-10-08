import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, paginated, toArray } from "../utils/helpers.js";
import { Player } from "../models/Player.js";
import { PlayerStat } from "../models/PlayerStat.js";
import { Team } from "../models/Team.js";
import { resolveSeason } from "../services/seasonService.js";
import { getCareerTotals } from "../services/statsService.js";
import { PLAYER_ROLE } from "@sppl/shared/constants/tournament.js";
import ApiError from "../utils/ApiError.js";

/**
 * Public player reads.
 *
 * Career figures come from the materialised `PlayerStat` documents, rebuilt by
 * `statsService` whenever a match finishes — not by aggregating the Ball collection
 * per request. A season is a handful of matches today, but the same code has to
 * survive a long one without changing.
 */

/**
 * GET /api/v1/players
 */
export const listPlayers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, team } = req.query;

  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.notFound("No season found");

  const filter = { seasonId: season._id, active: true };

  if (role && Object.values(PLAYER_ROLE).includes(role)) filter.role = role;

  if (team) {
    // The user gives a slug; the model stores an id.
    const isObjectId = /^[a-f\d]{24}$/i.test(String(team));
    const teamDoc = await Team.findOne(
      isObjectId
        ? { _id: team }
        : { seasonId: season._id, slug: String(team).toLowerCase() },
    )
      .select("_id")
      .lean();
    if (!teamDoc) throw ApiError.notFound(`Team not found: ${team}`);
    filter.teamId = teamDoc._id;
  }

  if (search) {
    // Escaped so a stray `(` in a name cannot break the regex.
    const term = String(search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { fullName: new RegExp(term, "i") },
      { jerseyName: new RegExp(term, "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Player.find(filter)
      .sort({ teamId: 1, order: 1, jerseyNo: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("teamId", "name shortName slug logoUrl themeColor")
      .lean(),
    Player.countDocuments(filter),
  ]);

  // Attach the career row for each player in one query rather than N.
  const playerIds = items.map((player) => player._id);
  const stats = await PlayerStat.find({
    seasonId: season._id,
    playerId: { $in: playerIds },
  }).lean();
  const statByPlayer = new Map(
    stats.map((stat) => [String(stat.playerId), stat]),
  );

  const enriched = items.map((player) => ({
    ...toPlayerProfile(player),
    team: player.teamId?.name
      ? {
          id: player.teamId._id,
          name: player.teamId.name,
          shortName: player.teamId.shortName,
          slug: player.teamId.slug,
          logoUrl: player.teamId.logoUrl ?? "",
          themeColor: player.teamId.themeColor ?? "",
        }
      : null,
    stats: toStatSummary(statByPlayer.get(String(player._id))),
  }));

  res.status(200).json(paginated({ items: enriched, total, page, limit }));
});

/**
 * GET /api/v1/players/:id
 */
export const getPlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id)
    .populate("teamId", "name shortName slug logoUrl themeColor")
    .populate("seasonId", "seasonNo year shortName slug status")
    .lean();

  if (!player) throw ApiError.notFound("Player not found");

  const stat = await PlayerStat.findOne({
    seasonId: player.seasonId._id,
    playerId: player._id,
  }).lean();

  // The career view sums every season this player has appeared in. Derived on read
  // so it can never drift from the per-season figures.
  const careerTotals = await getCareerTotals(player._id);

  res.status(200).json(
    ok({
      player: toPlayerProfile(player),
      team: player.teamId?.name
        ? {
            id: player.teamId._id,
            name: player.teamId.name,
            shortName: player.teamId.shortName,
            slug: player.teamId.slug,
            logoUrl: player.teamId.logoUrl ?? "",
            themeColor: player.teamId.themeColor ?? "",
          }
        : null,
      season: player.seasonId
        ? {
            id: player.seasonId._id,
            seasonNo: player.seasonId.seasonNo,
            year: player.seasonId.year,
            shortName: player.seasonId.shortName,
            slug: player.seasonId.slug,
            status: player.seasonId.status,
          }
        : null,
      stats: toStatSummary(stat),
      // Two views: the season just selected, and the whole career across seasons.
      career: toCareerFigures(stat),
      careerTotals: toCareerTotals(careerTotals),
    }),
  );
});

/**
 * GET /api/v1/players/:id/stats
 */
export const getPlayerStats = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id)
    .select("seasonId fullName")
    .lean();
  if (!player) throw ApiError.notFound("Player not found");

  const stat = await PlayerStat.findOne({
    seasonId: player.seasonId,
    playerId: player._id,
  }).lean();
  const careerTotals = await getCareerTotals(player._id);

  res.status(200).json(
    ok({
      playerId: player._id,
      stats: toStatSummary(stat),
      career: toCareerFigures(stat),
      careerTotals: toCareerTotals(careerTotals),
    }),
  );
});

/**
 * GET /api/v1/players/compare?ids=a,b
 *
 * Two to four players, side by side. Bounded at four because the comparison table
 * stops being readable past that on a phone.
 */
export const comparePlayers = asyncHandler(async (req, res) => {
  const ids = toArray(req.query.ids);

  if (ids.length < 2 || ids.length > 4) {
    throw ApiError.badRequest("Provide between 2 and 4 player ids to compare");
  }
  const invalid = ids.filter((id) => !/^[a-f\d]{24}$/i.test(id));
  if (invalid.length)
    throw ApiError.badRequest(`Invalid player id(s): ${invalid.join(", ")}`);

  const players = await Player.find({ _id: { $in: ids } })
    .populate("teamId", "name shortName slug logoUrl themeColor")
    .lean();

  if (players.length !== ids.length) {
    throw ApiError.notFound("One or more players were not found");
  }

  const stats = await PlayerStat.find({ playerId: { $in: ids } }).lean();
  const statByPlayer = new Map(
    stats.map((stat) => [String(stat.playerId), stat]),
  );

  // Preserve the caller's order so the columns do not jump between requests.
  const ordered = ids
    .map((id) => players.find((player) => String(player._id) === id))
    .filter(Boolean)
    .map((player) => ({
      player: toPlayerProfile(player),
      team: player.teamId?.name
        ? {
            id: player.teamId._id,
            name: player.teamId.name,
            shortName: player.teamId.shortName,
            slug: player.teamId.slug,
            logoUrl: player.teamId.logoUrl ?? "",
          }
        : null,
      career: toCareerFigures(statByPlayer.get(String(player._id))),
    }));

  res.status(200).json(ok(ordered));
});

/* ------------------------------------------------------------------ *
 * Shape helpers
 * ------------------------------------------------------------------ */

/** The full player profile used by the player page and comparison columns. */
export function toPlayerProfile(player) {
  if (!player) return null;
  return {
    id: player._id,
    fullName: player.fullName,
    jerseyName: player.jerseyName,
    jerseyNo: player.jerseyNo,
    role: player.role,
    battingStyle: player.battingStyle ?? null,
    bowlingStyle: player.bowlingStyle ?? null,
    dateOfBirth: player.dateOfBirth ?? null,
    ageYears: player.ageYears ?? null,
    photoUrl: player.photoUrl ?? "",
    isCaptain: Boolean(player.isCaptain),
    isViceCaptain: Boolean(player.isViceCaptain),
    teamId:
      player.teamId && typeof player.teamId === "object"
        ? player.teamId._id
        : player.teamId,
    seasonId:
      player.seasonId && typeof player.seasonId === "object"
        ? player.seasonId._id
        : player.seasonId,
    // Jersey size is part of the profile because the organizer's sheet is the
    // record for the kit and this page is where a wrong size gets spotted.
    size: player.size,
    isKidsSize: Boolean(player.isKidsSize),
    jerseyConfirmed: Boolean(player.jerseyConfirmed),
  };
}

/** Raw counters, used when a caller wants the numbers without the rates. */
export function toStatSummary(stat) {
  if (!stat) return null;
  return {
    matches: stat.matches ?? 0,
    runs: stat.runs ?? 0,
    ballsFaced: stat.ballsFaced ?? 0,
    fours: stat.fours ?? 0,
    sixes: stat.sixes ?? 0,
    highScore: stat.highScore ?? 0,
    wickets: stat.wickets ?? 0,
    ballsBowled: stat.ballsBowled ?? 0,
    runsConceded: stat.runsConceded ?? 0,
    catches: stat.catches ?? 0,
    playerOfMatchAwards: stat.playerOfMatchAwards ?? 0,
  };
}

/**
 * Derived figures for one season.
 *
 * A blank average (no dismissals yet) is returned as `null`, not 0. Zero would claim
 * a batter averages nothing; null says the figure does not exist yet.
 */
export function toCareerFigures(stat) {
  const empty = {
    matches: 0,
    innings: 0,
    runs: 0,
    ballsFaced: 0,
    dismissals: 0,
    highScore: null,
    highScoreNotOut: false,
    average: null,
    strikeRate: null,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
    ballsBowled: 0,
    oversBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    bestBowling: null,
    economy: null,
    bowlingAverage: null,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    playerOfMatchAwards: 0,
  };

  if (!stat) return empty;

  const ballsFaced = stat.ballsFaced ?? 0;
  const ballsBowled = stat.ballsBowled ?? 0;
  const dismissals = stat.dismissals ?? 0;
  const wickets = stat.wickets ?? 0;

  return {
    matches: stat.matches ?? 0,
    innings: stat.inningsBatted ?? 0,
    runs: stat.runs ?? 0,
    ballsFaced,
    dismissals,
    highScore:
      (stat.runs ?? 0) > 0
        ? (stat.highScore ?? 0)
        : stat.highScore
          ? stat.highScore
          : null,
    highScoreNotOut: Boolean(stat.highScoreNotOut),
    average: dismissals > 0 ? round(stat.runs / dismissals, 2) : null,
    strikeRate:
      ballsFaced > 0 ? round((stat.runs / ballsFaced) * 100, 2) : null,
    fours: stat.fours ?? 0,
    sixes: stat.sixes ?? 0,
    fifties: stat.fifties ?? 0,
    hundreds: stat.hundreds ?? 0,
    ducks: stat.ducks ?? 0,
    ballsBowled,
    oversBowled: round(ballsBowled / 6, 1),
    runsConceded: stat.runsConceded ?? 0,
    wickets,
    maidens: stat.maidens ?? 0,
    bestBowling:
      wickets > 0 &&
      stat.bestBowlingRuns !== null &&
      stat.bestBowlingRuns !== undefined
        ? `${stat.bestBowlingWickets ?? 0}/${stat.bestBowlingRuns}`
        : null,
    economy:
      ballsBowled > 0
        ? round((stat.runsConceded ?? 0) / (ballsBowled / 6), 2)
        : null,
    bowlingAverage:
      wickets > 0 ? round((stat.runsConceded ?? 0) / wickets, 2) : null,
    catches: stat.catches ?? 0,
    runOuts: stat.runOuts ?? 0,
    stumpings: stat.stumpings ?? 0,
    playerOfMatchAwards: stat.playerOfMatchAwards ?? 0,
  };
}

/**
 * Shape the all-seasons totals the same way one season's figures are shaped, so the
 * profile page can render both with one set of components.
 */
export function toCareerTotals(totals) {
  if (!totals) return null;

  const ballsFaced = totals.ballsFaced ?? 0;
  const ballsBowled = totals.ballsBowled ?? 0;
  const wickets = totals.wickets ?? 0;
  const dismissals = totals.dismissals ?? 0;

  return {
    seasons: totals.seasons ?? 0,
    matches: totals.matches ?? 0,
    innings: totals.innings ?? 0,
    runs: totals.runs ?? 0,
    ballsFaced,
    dismissals,
    highScore: totals.highScore > 0 ? totals.highScore : null,
    highScoreNotOut: Boolean(totals.highScoreNotOut),
    average: dismissals > 0 ? round(totals.runs / dismissals, 2) : null,
    strikeRate:
      ballsFaced > 0 ? round((totals.runs / ballsFaced) * 100, 2) : null,
    fours: totals.fours ?? 0,
    sixes: totals.sixes ?? 0,
    fifties: totals.fifties ?? 0,
    hundreds: totals.hundreds ?? 0,
    ducks: totals.ducks ?? 0,
    ballsBowled,
    oversBowled: round(ballsBowled / 6, 1),
    runsConceded: totals.runsConceded ?? 0,
    wickets,
    maidens: totals.maidens ?? 0,
    bestBowling:
      wickets > 0 &&
      totals.bestBowlingRuns !== null &&
      totals.bestBowlingRuns !== undefined
        ? `${totals.bestBowlingWickets ?? 0}/${totals.bestBowlingRuns}`
        : null,
    economy:
      ballsBowled > 0
        ? round((totals.runsConceded ?? 0) / (ballsBowled / 6), 2)
        : null,
    bowlingAverage:
      wickets > 0 ? round((totals.runsConceded ?? 0) / wickets, 2) : null,
    threeWicketHauls: totals.threeWicketHauls ?? 0,
    catches: totals.catches ?? 0,
    runOuts: totals.runOuts ?? 0,
    stumpings: totals.stumpings ?? 0,
    playerOfMatchAwards: totals.playerOfMatchAwards ?? 0,
  };
}

/** Round to a fixed number of decimals, guarding against a non-finite input. */
function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

export default {
  listPlayers,
  getPlayer,
  getPlayerStats,
  comparePlayers,
  toPlayerProfile,
  toCareerFigures,
  toCareerTotals,
};

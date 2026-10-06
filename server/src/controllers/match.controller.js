import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import { Match } from "../models/Match.js";
import { Ball } from "../models/Ball.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";
import {
  resolveSeason,
  toMatchCard,
  oversFromBalls,
} from "../services/seasonService.js";
import { MATCH_STATUS } from "@sppl/shared/constants/matchStatus.js";
import ApiError from "../utils/ApiError.js";

/**
 * Public match reads.
 *
 * The list endpoints return the trimmed match card; the detail endpoints return the
 * full scorecard and the ball-by-ball feed. Keeping those separate matters on a slow
 * connection — a visitor checking the fixtures should never download a 600-ball
 * commentary list to see a date.
 */

/**
 * GET /api/v1/matches
 *
 * Query params:
 *   season   season slug or id; defaults to current
 *   status   comma separated statuses
 *   stage    LEAGUE | FINAL
 *   team     team slug to filter to one team's matches
 *   limit    default 100
 */
export const listMatches = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.notFound("No season found");

  const filter = { seasonId: season._id };

  const statuses = toArray(req.query.status);
  if (statuses.length) filter.status = { $in: statuses };

  if (req.query.stage) filter.stage = req.query.stage;

  if (req.query.team) {
    const team = await Team.findOne({
      seasonId: season._id,
      slug: String(req.query.team).toLowerCase(),
    })
      .select("_id")
      .lean();
    if (!team) throw ApiError.notFound(`Team not found: ${req.query.team}`);
    filter.$or = [{ teamAId: team._id }, { teamBId: team._id }];
  }

  const limit = Math.min(Number(req.query.limit) || 100, 200);

  const matches = await Match.find(filter)
    .sort({ startAt: 1, matchNo: 1 })
    .limit(limit)
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .lean();

  res.status(200).json(ok(matches.map(toMatchCard)));
});

/**
 * GET /api/v1/matches/live
 *
 * Returns `null` rather than a 404 when nothing is live — "no match is on right
 * now" is a normal state for the home page, not an error, and a 404 would make the
 * client log noise all week.
 */
export const getLiveMatch = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);

  const query = { status: MATCH_STATUS.LIVE };
  if (season) query.seasonId = season._id;

  const match = await Match.findOne(query)
    .sort({ startAt: -1 })
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .lean();

  if (!match) {
    res.status(200).json(ok(null));
    return;
  }

  const [scorecard, recentBalls] = await Promise.all([
    buildScorecard(match),
    recentCommentary(match._id, match.currentInnings, 12),
  ]);

  res.status(200).json(
    ok({
      ...toMatchCard(match),
      scorecard,
      recentBalls,
      freeHitPending: Boolean(match.freeHitPending),
    }),
  );
});

/**
 * GET /api/v1/matches/:id
 */
export const getMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .populate("motmPlayerId", "fullName jerseyName jerseyNo photoUrl")
    .lean();

  if (!match) throw ApiError.notFound("Match not found");

  const scorecard = await buildScorecard(match);

  res.status(200).json(
    ok({
      ...toMatchCard(match),
      toss: match.toss?.winnerTeamId
        ? {
            winnerTeamId: match.toss.winnerTeamId,
            decision: match.toss.decision,
            completedAt: match.toss.completedAt ?? null,
          }
        : null,
      motm: match.motmPlayerId ?? null,
      scorecard,
      freeHitPending: Boolean(match.freeHitPending),
    }),
  );
});

/**
 * GET /api/v1/matches/:id/scorecard
 */
export const getScorecard = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .lean();
  if (!match) throw ApiError.notFound("Match not found");

  res.status(200).json(ok(await buildScorecard(match)));
});

/**
 * GET /api/v1/matches/:id/balls
 *
 * Ball-by-ball feed, newest first.
 *
 * Query params:
 *   innings   0 or 1 (defaults to the current innings)
 *   limit     default 30, max 200
 *   before    sequence number — return deliveries older than this, for "load more"
 */
export const getBallByBall = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .select("_id currentInnings status")
    .lean();
  if (!match) throw ApiError.notFound("Match not found");

  const innings =
    req.query.innings !== undefined
      ? Number(req.query.innings)
      : match.currentInnings;
  if (![0, 1].includes(innings))
    throw ApiError.badRequest("innings must be 0 or 1");

  const limit = Math.min(Number(req.query.limit) || 30, 200);

  const filter = { matchId: match._id, innings };
  // Paging by sequence rather than skip/limit: new deliveries are appended while a
  // visitor is scrolling, and skip/limit would shift the window under them.
  if (req.query.before) filter.sequence = { $lt: Number(req.query.before) };

  const balls = await Ball.find(filter)
    .sort({ sequence: -1 })
    .limit(limit)
    .lean();

  const playerIds = new Set();
  for (const ball of balls) {
    playerIds.add(String(ball.batterId));
    playerIds.add(String(ball.bowlerId));
    if (ball.fielderId) playerIds.add(String(ball.fielderId));
    if (ball.dismissedPlayerId) playerIds.add(String(ball.dismissedPlayerId));
  }

  const players = await Player.find({ _id: { $in: [...playerIds] } })
    .select("_id fullName jerseyName jerseyNo")
    .lean();
  const nameById = new Map(
    players.map((player) => [
      String(player._id),
      player.jerseyName || player.fullName,
    ]),
  );

  const name = (id) => (id ? (nameById.get(String(id)) ?? "") : "");

  const items = balls.map((ball) => ({
    id: ball._id,
    sequence: ball.sequence,
    innings: ball.innings,
    overIndex: ball.overIndex,
    ballInOver: ball.ballInOver,
    displayOver: `${ball.overIndex}.${ball.ballInOver}`,
    batterId: ball.batterId,
    batterName: name(ball.batterId),
    bowlerId: ball.bowlerId,
    bowlerName: name(ball.bowlerId),
    runsBat: ball.runsBat,
    runsBye: ball.runsBye ?? 0,
    extraType: ball.extraType ?? null,
    totalRuns: ball.totalRuns,
    isWicket: Boolean(ball.isWicket),
    wicketType: ball.wicketType ?? null,
    dismissedPlayerName: ball.dismissedPlayerId
      ? name(ball.dismissedPlayerId)
      : "",
    fielderName: ball.fielderId ? name(ball.fielderId) : "",
    isFreeHit: Boolean(ball.isFreeHit),
    isBoundaryFour: Boolean(ball.isBoundaryFour),
    isBoundarySix: Boolean(ball.isBoundarySix),
    commentaryBn: ball.commentaryBn ?? "",
    commentaryEn: ball.commentaryEn ?? "",
    scoreAfter: ball.scoreAfter ?? null,
    createdAt: ball.createdAt,
  }));

  res.status(200).json(
    ok({
      matchId: match._id,
      innings,
      items,
      hasMore: items.length === limit,
      nextBefore: items.length ? items[items.length - 1].sequence : null,
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

/**
 * Build the full scorecard from the match document.
 *
 * The innings tree is stored on the match (see the Match model), so this is a
 * reshape rather than an aggregation over balls. Player names are fetched in one
 * query for the whole card instead of one per row.
 */
export async function buildScorecard(match) {
  const innings = match.innings ?? [];
  if (innings.length === 0) {
    return {
      innings: [],
      teams: { [String(match.teamAId?._id ?? match.teamAId)]: null },
    };
  }

  // Gather every player referenced anywhere on the card.
  const playerIds = new Set();
  for (const entry of innings) {
    for (const line of entry.batting ?? [])
      playerIds.add(String(line.playerId));
    for (const line of entry.bowling ?? [])
      playerIds.add(String(line.playerId));
    if (line.dismissedByPlayerId)
      playerIds.add(String(line.dismissedByPlayerId));
    if (line.fielderPlayerId) playerIds.add(String(line.fielderPlayerId));
  }

  const players = await Player.find({ _id: { $in: [...playerIds] } })
    .select("_id fullName jerseyName jerseyNo isCaptain")
    .lean();

  const playerById = new Map(
    players.map((player) => [String(player._id), player]),
  );
  const playerChip = (id) => {
    const player = playerById.get(String(id));
    if (!player) return { id, name: "", jerseyNo: null };
    return {
      id: player._id,
      name: player.jerseyName || player.fullName,
      fullName: player.fullName,
      jerseyNo: player.jerseyNo,
    };
  };

  const shaped = innings.map((entry, index) => ({
    index,
    battingTeamId: entry.battingTeamId,
    bowlingTeamId: entry.bowlingTeamId,
    runs: entry.runs ?? 0,
    wickets: entry.wickets ?? 0,
    balls: entry.balls ?? 0,
    overs: oversFromBalls(entry.balls),
    target: entry.target ?? null,
    isComplete: Boolean(entry.isComplete),
    closedReason: entry.closedReason ?? null,
    extras: {
      wides: entry.extras?.wides ?? 0,
      noBalls: entry.extras?.noBalls ?? 0,
      byes: entry.extras?.byes ?? 0,
      legByes: entry.extras?.legByes ?? 0,
      total:
        (entry.extras?.wides ?? 0) +
        (entry.extras?.noBalls ?? 0) +
        (entry.extras?.byes ?? 0) +
        (entry.extras?.legByes ?? 0),
    },
    batting: (entry.batting ?? [])
      .filter((line) => line.hasBatted || line.isStriker)
      .map((line) => ({
        player: playerChip(line.playerId),
        runs: line.runs ?? 0,
        balls: line.balls ?? 0,
        fours: line.fours ?? 0,
        sixes: line.sixes ?? 0,
        strikeRate:
          (line.balls ?? 0) > 0
            ? round((line.runs / line.balls) * 100, 2)
            : null,
        isOut: Boolean(line.isOut),
        dismissalType: line.dismissalType ?? null,
        dismissedBy: line.dismissedByPlayerId
          ? playerChip(line.dismissedByPlayerId)
          : null,
        fielder: line.fielderPlayerId ? playerChip(line.fielderPlayerId) : null,
        isStriker: Boolean(line.isStriker),
      })),
    didNotBat: (entry.batting ?? [])
      .filter((line) => !line.hasBatted && !line.isStriker)
      .map((line) => playerChip(line.playerId)),
    bowling: (entry.bowling ?? [])
      .filter((line) => (line.balls ?? 0) > 0 || line.isBowling)
      .map((line) => ({
        player: playerChip(line.playerId),
        balls: line.balls ?? 0,
        overs: oversFromBalls(line.balls),
        runs: line.runs ?? 0,
        wickets: line.wickets ?? 0,
        maidens: line.maidens ?? 0,
        wides: line.wides ?? 0,
        noBalls: line.noBalls ?? 0,
        economy:
          (line.balls ?? 0) > 0 ? round(line.runs / (line.balls / 6), 2) : null,
        isBowling: Boolean(line.isBowling),
      })),
  }));

  return { innings: shaped };
}

/** The most recent deliveries of an innings, oldest-last for a commentary list. */
async function recentCommentary(matchId, innings, limit) {
  const balls = await Ball.find({ matchId, innings })
    .sort({ sequence: -1 })
    .limit(limit)
    .lean();

  return balls.map((ball) => ({
    sequence: ball.sequence,
    displayOver: `${ball.overIndex}.${ball.ballInOver}`,
    totalRuns: ball.totalRuns,
    isWicket: Boolean(ball.isWicket),
    isBoundaryFour: Boolean(ball.isBoundaryFour),
    isBoundarySix: Boolean(ball.isBoundarySix),
    extraType: ball.extraType ?? null,
    commentaryBn: ball.commentaryBn ?? "",
    commentaryEn: ball.commentaryEn ?? "",
  }));
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

export default {
  listMatches,
  getLiveMatch,
  getMatch,
  getScorecard,
  getBallByBall,
  buildScorecard,
};

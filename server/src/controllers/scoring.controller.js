import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import * as scoringService from "../services/scoringService.js";
import { Match } from "../models/Match.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";
import ApiError from "../utils/ApiError.js";
import { MATCH_STATUS } from "@sppl/shared/constants/matchStatus.js";

/**
 * Scoring controllers.
 *
 * Every handler here runs behind `requireRole(SCORER, ADMIN, SUPER_ADMIN)` AND
 * `requireAssigned`, which checks that the scorer is the one assigned to this match.
 * A scorer may see every match in the admin panel; they may only write to theirs.
 */

/**
 * GET /api/v1/scoring/matches
 *
 * The matches this scorer may actually score right now. An admin sees all of them;
 * a scorer sees only their own assignments, so the console opens on a match they can
 * work with rather than an error.
 */
export const listScorableMatches = asyncHandler(async (req, res) => {
  const filter = {
    status: {
      $in: [
        MATCH_STATUS.UPCOMING,
        MATCH_STATUS.LIVE,
        MATCH_STATUS.INNINGS_BREAK,
      ],
    },
  };

  if (req.query.season) filter.seasonId = req.query.season;

  // A scorer is not restricted to their own matches in the LIST — they need to see
  // which match is next — but the write routes enforce the assignment.
  const matches = await Match.find(filter)
    .sort({ startAt: 1 })
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .lean();

  res.status(200).json(ok(matches));
});

/**
 * GET /api/v1/scoring/:matchId
 *
 * Everything the scoring console needs in one payload: the match, both squads, and
 * who is at the crease. Assembled here rather than on the client so the console can
 * open with one request — a scorer standing at the boundary is on a phone.
 */
export const getScoringContext = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId)
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .populate("playingSquads.playerIds", "fullName jerseyName jerseyNo role")
    .lean();

  if (!match) throw ApiError.notFound("Match not found");

  const currentInnings = match.innings?.[match.currentInnings] ?? null;

  // Who is at the crease, and who bowled the last over.
  const striker =
    currentInnings?.batting?.find((line) => line.isStriker) ?? null;
  const nonStriker =
    currentInnings?.batting?.find(
      (line) => line.hasBatted && !line.isOut && !line.isStriker,
    ) ?? null;
  const lastBowlerId =
    currentInnings?.bowling?.filter((line) => line.balls > 0)?.slice(-1)?.[0]
      ?.playerId ?? null;

  res.status(200).json(
    ok({
      match,
      currentInnings,
      striker: striker
        ? { id: striker.playerId, runs: striker.runs, balls: striker.balls }
        : null,
      nonStriker: nonStriker ? { id: nonStriker.playerId } : null,
      lastBowlerId,
      freeHitPending: Boolean(match.freeHitPending),
    }),
  );
});

/**
 * POST /api/v1/scoring/:matchId/start
 *
 * Move a match to LIVE and open the first innings from the chosen playing squads.
 * Until this happens the match is UPCOMING and no ball can be recorded.
 */
export const startMatch = asyncHandler(async (req, res) => {
  const { playingSquads, battingTeamId } = req.body;

  const match = await Match.findById(req.params.matchId);
  if (!match) throw ApiError.notFound("Match not found");

  if (match.status === MATCH_STATUS.LIVE) {
    throw ApiError.conflict("This match is already live");
  }

  if (!Array.isArray(playingSquads) || playingSquads.length !== 2) {
    throw ApiError.badRequest("Two playing squads are required");
  }

  for (const squad of playingSquads) {
    if (!Array.isArray(squad.playerIds) || squad.playerIds.length !== 9) {
      throw ApiError.badRequest("Each squad must name exactly 9 players");
    }
  }

  const battingTeam = playingSquads.find(
    (squad) => String(squad.teamId) === String(battingTeamId),
  );
  if (!battingTeam)
    throw ApiError.badRequest("The batting team must be one of the two squads");

  const bowlingTeam = playingSquads.find(
    (squad) => String(squad.teamId) !== String(battingTeamId),
  );

  match.playingSquads = playingSquads.map((squad) => ({
    teamId: squad.teamId,
    playerIds: squad.playerIds,
  }));

  // Only build the first innings if it does not already exist — restarting a match
  // that was accidentally marked completed must not wipe the recorded cricket.
  if (!match.innings?.length) {
    match.innings = [
      {
        battingTeamId: battingTeam.teamId,
        bowlingTeamId: bowlingTeam.teamId,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        batting: battingTeam.playerIds.map((playerId, index) => ({
          playerId,
          isStriker: index === 0,
          hasBatted: index < 2,
        })),
        bowling: bowlingTeam.playerIds.map((playerId) => ({ playerId })),
        isComplete: false,
      },
    ];
    match.currentInnings = 0;
  }

  match.status = MATCH_STATUS.LIVE;
  match.freeHitPending = false;
  if (req.user) match.scorerId = req.user._id;

  await match.save();

  res.status(200).json(ok(match.toJSON(), "Match started"));
});

/**
 * POST /api/v1/scoring/:matchId/ball
 *
 * Record one delivery. This is the hot path — a scorer taps it sixty times an innings.
 * The response carries everything the console needs to re-render, so the client never
 * has to refetch after a ball.
 */
export const recordBall = asyncHandler(async (req, res) => {
  const result = await scoringService.recordBall({
    matchId: req.params.matchId,
    delivery: req.body,
    userId: req.user?._id,
  });

  // Broadcast after the write succeeds, never before — a client that saw a ball that
  // failed to save would show a score the database does not have.
  const io = req.app.get("io");
  if (io) {
    const payload = {
      matchId: String(req.params.matchId),
      ball: result.ball,
      score: {
        runs: result.match.innings[result.ball.innings].runs,
        wickets: result.match.innings[result.ball.innings].wickets,
        legalBalls: result.match.innings[result.ball.innings].balls,
        target: result.match.innings[result.ball.innings].target,
      },
      commentary: {
        sequence: result.ball.sequence,
        displayOver: `${result.ball.overIndex}.${result.ball.ballInOver}`,
        totalRuns: result.ball.totalRuns,
        isWicket: result.ball.isWicket,
        isBoundaryFour: result.ball.isBoundaryFour,
        isBoundarySix: result.ball.isBoundarySix,
        extraType: result.ball.extraType,
        commentaryBn: result.ball.commentaryBn,
        commentaryEn: result.ball.commentaryEn,
      },
    };

    // Imported lazily to keep this controller free of a hard socket import.
    const { emitBall, emitMatchStatus, emitMatchCompleted } =
      await import("../socket/index.js");
    emitBall(io, payload);

    if (result.inningsEnded) {
      emitMatchStatus(io, {
        matchId: String(req.params.matchId),
        status: result.match.status,
        inningsEnded: true,
        reason: result.inningsEndReason,
      });
    }

    if (result.matchCompleted) {
      emitMatchCompleted(io, {
        matchId: String(req.params.matchId),
        result: result.match.result,
      });
    }
  }

  res.status(201).json(
    ok(
      {
        ball: result.ball,
        inningsEnded: result.inningsEnded,
        inningsEndReason: result.inningsEndReason,
        matchCompleted: result.matchCompleted,
        status: result.match.status,
      },
      "Ball recorded",
    ),
  );
});

/**
 * POST /api/v1/scoring/:matchId/undo
 *
 * Remove the last delivery and rebuild the innings from what remains.
 */
export const undoBall = asyncHandler(async (req, res) => {
  const result = await scoringService.undoLastBall({
    matchId: req.params.matchId,
    innings: req.body?.innings,
  });

  const io = req.app.get("io");
  if (io) {
    const { emitUndo } = await import("../socket/index.js");
    emitUndo(io, { matchId: String(req.params.matchId) });
  }

  res
    .status(200)
    .json(ok({ undone: result.undoneBall.sequence }, "Last ball undone"));
});

/**
 * POST /api/v1/scoring/:matchId/end-innings
 *
 * Declare the current innings over early — rain, or a walkover. The next ball would
 * have moved things along anyway; this makes it explicit.
 */
export const endInnings = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId);
  if (!match) throw ApiError.notFound("Match not found");

  const innings = match.innings[match.currentInnings];
  if (!innings) throw ApiError.badRequest("No innings is in progress");

  innings.isComplete = true;
  innings.closedReason = req.body?.reason ?? "DECLARED";

  if (match.currentInnings === 0) {
    const season = await import("../services/seasonService.js").then((m) =>
      m.resolveSeason(match.seasonId, { required: true }),
    );
    scoringService.openSecondInnings(match, season.matchRules ?? {});
  } else {
    scoringService.closeMatch(match);
  }

  await match.save();

  const io = req.app.get("io");
  if (io) {
    const { emitMatchStatus } = await import("../socket/index.js");
    emitMatchStatus(io, {
      matchId: String(req.params.matchId),
      status: match.status,
      inningsEnded: true,
    });
  }

  res.status(200).json(ok(match.toJSON(), "Innings ended"));
});

/**
 * PATCH /api/v1/scoring/:matchId/result
 *
 * Set the winner, margin and man of the match by hand. Used when the scorer has to
 * override the computed result — an abandoned match, or a super over decided on the
 * field.
 */
export const setResult = asyncHandler(async (req, res) => {
  const { resultType, winnerTeamId, margin, motmPlayerId } = req.body;

  const match = await Match.findById(req.params.matchId);
  if (!match) throw ApiError.notFound("Match not found");

  match.result = {
    ...match.result,
    resultType: resultType ?? match.result?.resultType ?? null,
    winnerTeamId: winnerTeamId ?? null,
    margin: margin ?? "",
    textBn: req.body.textBn ?? match.result?.textBn ?? "",
    textEn: req.body.textEn ?? match.result?.textEn ?? "",
    completedAt: new Date(),
  };

  if (resultType === "NO_RESULT") match.status = MATCH_STATUS.ABANDONED;
  else match.status = MATCH_STATUS.COMPLETED;

  if (motmPlayerId) match.motmPlayerId = motmPlayerId;

  await match.save();

  // The standings depend on the result, so they move with it.
  const season = await import("../services/seasonService.js").then((m) =>
    m.resolveSeason(match.seasonId),
  );
  await scoringService.refreshPointsTable(
    match.seasonId,
    season?.matchRules ?? {},
  );

  const io = req.app.get("io");
  if (io) {
    const { emitMatchCompleted, emitPointsUpdate } =
      await import("../socket/index.js");
    emitMatchCompleted(io, {
      matchId: String(req.params.matchId),
      result: match.result,
    });
    emitPointsUpdate(io, { seasonId: String(match.seasonId) });
  }

  res.status(200).json(ok(match.toJSON(), "Result saved"));
});

/**
 * GET /api/v1/scoring/:matchId/squad/:teamId
 *
 * The full squad of a team, so the console can offer the players who are NOT in the
 * playing nine — a substitute fielder or a late replacement.
 */
export const getSquad = asyncHandler(async (req, res) => {
  const players = await Player.find({ teamId: req.params.teamId, active: true })
    .sort({ order: 1, jerseyNo: 1 })
    .select("fullName jerseyName jerseyNo role")
    .lean();

  const team = await Team.findById(req.params.teamId)
    .select("name shortName")
    .lean();

  res.status(200).json(ok({ team, players }));
});

export default {
  listScorableMatches,
  getScoringContext,
  startMatch,
  recordBall,
  undoBall,
  endInnings,
  setResult,
  getSquad,
};

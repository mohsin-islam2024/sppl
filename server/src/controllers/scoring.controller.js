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
 */

/** GET /api/v1/scoring/matches */
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
 * who is at the crease.
 */
export const getScoringContext = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.matchId)
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .populate("playingSquads.playerIds", "fullName jerseyName jerseyNo role")
    .lean();

  if (!match) throw ApiError.notFound("Match not found");

  const currentInnings = match.innings?.[match.currentInnings] ?? null;

  // The batting and bowling lines hold only ids, so the client needs the populated
  // squad to resolve names. Sending both lets it render without a second request.
  const playerIndex = new Map();
  for (const squad of match.playingSquads ?? []) {
    for (const player of squad.playerIds ?? []) {
      playerIndex.set(String(player._id ?? player.id), player);
    }
  }

  const battingLines = (currentInnings?.batting ?? []).map((line) => ({
    ...line,
    player: playerIndex.get(String(line.playerId)) ?? null,
  }));

  const bowlingLines = (currentInnings?.bowling ?? []).map((line) => ({
    ...line,
    player: playerIndex.get(String(line.playerId)) ?? null,
  }));

  const striker = battingLines.find((line) => line.isStriker) ?? null;
  const nonStriker =
    battingLines.find(
      (line) => line.hasBatted && !line.isOut && !line.isStriker,
    ) ?? null;
  const bowler = bowlingLines.find((line) => line.isBowling) ?? null;

  // Offered as a suggestion only — the scorer decides who comes in.
  const nextBatter =
    battingLines.find((line) => !line.hasBatted && !line.isOut)?.playerId ??
    null;

  res.status(200).json(
    ok({
      match,
      currentInnings: currentInnings
        ? { ...currentInnings, batting: battingLines, bowling: bowlingLines }
        : null,
      striker,
      nonStriker,
      bowler,
      nextBatterSuggestion: nextBatter,
      freeHitPending: Boolean(match.freeHitPending),
    }),
  );
});

/** POST /api/v1/scoring/:matchId/start */
export const startMatch = asyncHandler(async (req, res) => {
  const { playingSquads, battingTeamId, strikerId, nonStrikerId, bowlerId } =
    req.body;

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

  if (!match.innings?.length) {
    match.innings = [
      {
        battingTeamId: battingTeam.teamId,
        bowlingTeamId: bowlingTeam.teamId,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        batting: battingTeam.playerIds.map((playerId) => ({
          playerId,
          isStriker: false,
          hasBatted: false,
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

  // The opening pair is set through the same service call the mid-innings changes
  // use, so there is one implementation of "who is at the crease".
  if (strikerId || nonStrikerId || bowlerId) {
    await scoringService.setPlayers({
      matchId: match._id,
      strikerId,
      nonStrikerId,
      bowlerId,
    });
  }

  const fresh = await Match.findById(match._id);

  res.status(200).json(ok(fresh.toJSON(), "Match started"));
});

/**
 * POST /api/v1/scoring/:matchId/players
 *
 * Set or change the striker, non-striker and bowler while the match is live. Called
 * after a wicket to bring the next batter in, and between overs for the next bowler.
 */
export const setPlayers = asyncHandler(async (req, res) => {
  const { strikerId, nonStrikerId, bowlerId } = req.body;

  if (!strikerId && !nonStrikerId && !bowlerId) {
    throw ApiError.badRequest("Name at least one player to set");
  }

  const match = await scoringService.setPlayers({
    matchId: req.params.matchId,
    strikerId,
    nonStrikerId,
    bowlerId,
  });

  const io = req.app.get("io");
  if (io) {
    const { emitMatchStatus } = await import("../socket/index.js");
    emitMatchStatus(io, {
      matchId: String(req.params.matchId),
      status: match.status,
    });
  }

  res.status(200).json(ok(match.toJSON(), "Players set"));
});

/** POST /api/v1/scoring/:matchId/ball */
export const recordBall = asyncHandler(async (req, res) => {
  const result = await scoringService.recordBall({
    matchId: req.params.matchId,
    delivery: req.body,
    userId: req.user?._id,
  });

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

/** POST /api/v1/scoring/:matchId/undo */
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

/** POST /api/v1/scoring/:matchId/end-innings */
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

/** PATCH /api/v1/scoring/:matchId/result */
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

  const season = await import("../services/seasonService.js").then((m) =>
    m.resolveSeason(match.seasonId),
  );
  await scoringService.refreshPointsTable(
    match.seasonId,
    season?.matchRules ?? {},
  );

  // A hand-set result completes the match, so the player figures move with it.
  await scoringService.recomputeStats(match.seasonId);

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

/** GET /api/v1/scoring/:matchId/squad/:teamId */
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
  setPlayers,
  recordBall,
  undoBall,
  endInnings,
  setResult,
  getSquad,
};

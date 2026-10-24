import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import * as scoringService from "../services/scoringService.js";
import { Match } from "../models/Match.js";
import { Ball } from "../models/Ball.js";
import { Player } from "../models/Player.js";
import { Team } from "../models/Team.js";
import ApiError from "../utils/ApiError.js";
import { MATCH_STATUS } from "@sppl/shared/constants/matchStatus.js";
import { decideSuperOver, formatSide } from "../utils/superOver.js";
import { rulesForMatch } from "../utils/matchRules.js";
import { applySubstitution } from "../utils/substitution.js";
import { MIN_PLAYERS_PER_SIDE } from "../utils/matchRules.js";

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

  // The latest deliveries of the innings in progress. The console draws its "ball by
  // ball" list and the last-ball line from `innings.recentBalls`, but nothing ever
  // filled it in, so the scorer saw "No balls yet" at 19/1 after 2.2 overs. This is
  // also what lets them see WHICH ball an undo is about to remove.
  //
  // `currentInnings` is the very object inside `match.innings`, so setting it here
  // reaches the client both ways it reads it.
  if (currentInnings) {
    const latest = await Ball.find({
      matchId: match._id,
      innings: match.currentInnings,
    })
      .sort({ sequence: -1 })
      .limit(12)
      .lean();

    // Newest last: the console takes the final entry as "the last ball".
    currentInnings.recentBalls = latest.reverse().map((ball) => ({
      sequence: ball.sequence,
      overIndex: ball.overIndex,
      ballInOver: ball.ballInOver,
      displayOver: `${ball.overIndex}.${ball.ballInOver}`,
      runsBat: ball.runsBat ?? 0,
      totalRuns: ball.totalRuns ?? 0,
      extraType: ball.extraType ?? null,
      isWicket: Boolean(ball.isWicket),
      wicketType: ball.wicketType ?? null,
      isBoundaryFour: Boolean(ball.isBoundaryFour),
      isBoundarySix: Boolean(ball.isBoundarySix),
      isFreeHit: Boolean(ball.isFreeHit),
      commentaryBn: ball.commentaryBn ?? "",
      commentaryEn: ball.commentaryEn ?? "",
    }));
  }

  // The batting and bowling lines hold only ids, so the client needs the populated
  // squad to resolve names. Sending both lets it render without a second request.
  const playerIndex = new Map();
  for (const squad of match.playingSquads ?? []) {
    for (const player of squad.playerIds ?? []) {
      playerIndex.set(String(player._id ?? player.id), player);
    }
  }

  // A replaced player is no longer in a playing squad, but the scorecard lines that
  // carry his runs and overs still name him. Resolve him too, or those lines would
  // show up nameless.
  const replacedIds = (match.substitutions ?? []).map((entry) => entry.outPlayerId);
  if (replacedIds.length) {
    const replaced = await Player.find({ _id: { $in: replacedIds } })
      .select("fullName jerseyName jerseyNo role")
      .lean();
    for (const player of replaced) playerIndex.set(String(player._id), player);
  }

  const substitutions = (match.substitutions ?? []).map((entry) => ({
    teamId: entry.teamId,
    inningsIndex: entry.inningsIndex,
    at: entry.at,
    out: playerIndex.get(String(entry.outPlayerId)) ?? null,
    in: playerIndex.get(String(entry.inPlayerId)) ?? null,
  }));

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
      substitutions,
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

  // A side normally takes the field with the season's full number (9), but a player
  // may be missing on the day, so a smaller side is allowed down to a sane floor.
  // Nothing larger than the season's rule is: that would be more than a side may field.
  const season = await import("../services/seasonService.js").then((m) =>
    m.resolveSeason(match.seasonId),
  );
  const maxPlayers = season?.matchRules?.playersPerSide ?? 9;

  const matchTeamIds = [String(match.teamAId), String(match.teamBId)];
  const squadTeamIds = new Set(playingSquads.map((squad) => String(squad.teamId)));
  if (
    squadTeamIds.size !== 2 ||
    !matchTeamIds.every((teamId) => squadTeamIds.has(teamId))
  ) {
    throw ApiError.badRequest("One squad is needed for each of the two teams");
  }

  const everyone = new Set();
  for (const squad of playingSquads) {
    if (
      !Array.isArray(squad.playerIds) ||
      squad.playerIds.length < MIN_PLAYERS_PER_SIDE ||
      squad.playerIds.length > maxPlayers
    ) {
      throw ApiError.badRequest(
        `Each side needs between ${MIN_PLAYERS_PER_SIDE} and ${maxPlayers} players`,
      );
    }

    for (const playerId of squad.playerIds) {
      if (everyone.has(String(playerId))) {
        throw ApiError.badRequest("A player cannot be picked twice");
      }
      everyone.add(String(playerId));
    }

    // The ids come from the client. Without this, a stray or stale id would put a
    // player of another team (or one who has left) into the XI.
    const members = await Player.countDocuments({
      _id: { $in: squad.playerIds },
      teamId: squad.teamId,
      active: true,
    });
    if (members !== squad.playerIds.length) {
      throw ApiError.badRequest("Every picked player must be an active member of that team");
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

  // A resend of a ball that was already recorded: answer exactly as for the original,
  // but do not broadcast it again. Viewers already received it the first time.
  if (result.duplicate) {
    return res.status(200).json(
      ok(
        {
          ball: result.ball,
          inningsEnded: result.inningsEnded,
          inningsEndReason: result.inningsEndReason,
          matchCompleted: result.matchCompleted,
          status: result.match.status,
          duplicate: true,
        },
        "Ball already recorded",
      ),
    );
  }

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
    scoringService.openSecondInnings(match, rulesForMatch(match, season.matchRules));
  } else {
    scoringService.closeMatch(match);
  }

  await match.save();

  // Ending the second innings by hand closes the match. Everything that follows a
  // finished match has to follow this one too, or the points table and the player
  // figures stay as they were until some later ball happens to refresh them.
  if (match.status === MATCH_STATUS.COMPLETED) {
    const season = await import("../services/seasonService.js").then((m) =>
      m.resolveSeason(match.seasonId),
    );
    await scoringService.refreshPointsTable(match.seasonId, season?.matchRules ?? {});
    await scoringService.recomputeStats(match.seasonId);
    await scoringService.syncFinalAwards(match);
  }

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
  await scoringService.syncFinalAwards(match);

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
 * POST /api/v1/scoring/:matchId/substitute
 *
 * Replace a player who cannot continue (injury, illness) with another player of the
 * same team. The rules for what the replacement takes over live in
 * utils/substitution.js; this handler does the checks that need the database and
 * saves.
 *
 * Allowed while the match is live or at the innings break. Once it has finished a
 * scorecard is history, and before it starts the playing squads are simply chosen.
 */
export const substitutePlayer = asyncHandler(async (req, res) => {
  const { teamId, outPlayerId, inPlayerId } = req.body;

  const match = await Match.findById(req.params.matchId);
  if (!match) throw ApiError.notFound("Match not found");

  if (![MATCH_STATUS.LIVE, MATCH_STATUS.INNINGS_BREAK].includes(match.status)) {
    throw ApiError.badRequest("A player can only be replaced while the match is in progress");
  }

  if (![String(match.teamAId), String(match.teamBId)].includes(String(teamId))) {
    throw ApiError.badRequest("That team is not playing in this match");
  }

  // The replacement has to be a registered, active player of THIS team in THIS
  // season. The squad endpoint only ever offers those, but the id comes from the
  // client and nothing else would stop a stray id from putting a stranger on the field.
  const incoming = await Player.findOne({
    _id: inPlayerId,
    teamId,
    seasonId: match.seasonId,
    active: true,
  })
    .select("_id")
    .lean();
  if (!incoming) {
    throw ApiError.badRequest("The replacement must be an active player of the same team");
  }

  const result = applySubstitution(match, { teamId, outPlayerId, inPlayerId });
  if (!result.ok) throw ApiError.badRequest(result.reason);

  match.substitutions.push({
    teamId,
    outPlayerId,
    inPlayerId,
    inningsIndex: match.currentInnings ?? 0,
    atSequence: match.ballSequence ?? 0,
    byUserId: req.user?._id ?? null,
  });

  await match.save();

  const io = req.app.get("io");
  if (io) {
    const { emitMatchStatus } = await import("../socket/index.js");
    emitMatchStatus(io, {
      matchId: String(req.params.matchId),
      status: match.status,
      playersChanged: true,
    });
  }

  res.status(200).json(
    ok(
      {
        retiredAtCrease: result.retiredAtCrease,
        replacedBowler: result.replacedBowler,
      },
      "Player replaced",
    ),
  );
});

/**
 * POST /api/v1/scoring/:matchId/super-over
 *
 * Records the super over of a tied match: one over each, entered as the two
 * scores. The match result becomes a win for the higher side, or stays a tie (and the
 * points are shared) when a league match is level again. A knockout match cannot end
 * level, so there the organisers' choice of winner is required.
 *
 * Only the two totals are kept. A super over is deliberately not scored ball by
 * ball, and its runs and wickets stay out of the players' season figures, as is the
 * convention for super overs.
 *
 * It can be run again to correct a mistake: the previous super over is replaced.
 */
export const recordSuperOver = asyncHandler(async (req, res) => {
  const { first, second, tiebreakWinnerTeamId } = req.body;

  const match = await Match.findById(req.params.matchId);
  if (!match) throw ApiError.notFound("Match not found");

  if (match.status !== MATCH_STATUS.COMPLETED) {
    throw ApiError.badRequest("A super over can only be recorded once the match has finished");
  }

  // It has to be a genuine tie. The innings totals are the evidence: this endpoint
  // must not be a way to overwrite the result of a match that somebody won.
  const [firstInnings, secondInnings] = match.innings;
  if (!firstInnings || !secondInnings || firstInnings.runs !== secondInnings.runs) {
    throw ApiError.badRequest("This match was not tied, so it has no super over");
  }

  const teamIds = [String(match.teamAId), String(match.teamBId)];
  if (!teamIds.includes(String(first.teamId)) || !teamIds.includes(String(second.teamId))) {
    throw ApiError.badRequest("The super over sides must be the two teams of this match");
  }

  const decision = decideSuperOver({
    first,
    second,
    stage: match.stage,
    tiebreakWinnerTeamId,
  });
  if (!decision.ok) throw ApiError.badRequest(decision.reason);

  const teams = await Team.find({ _id: { $in: teamIds } })
    .select("name shortName")
    .lean();
  const teamById = new Map(teams.map((team) => [String(team._id), team]));
  const nameOf = (id) => teamById.get(String(id))?.name ?? "";
  const shortOf = (id) => teamById.get(String(id))?.shortName ?? nameOf(id);

  const score = `${shortOf(first.teamId)} ${formatSide(first)}, ${shortOf(second.teamId)} ${formatSide(second)}`;

  match.superOver = {
    played: true,
    innings: [
      { battingTeamId: first.teamId, bowlingTeamId: second.teamId, runs: first.runs, wickets: first.wickets, balls: 6, isComplete: true },
      { battingTeamId: second.teamId, bowlingTeamId: first.teamId, runs: second.runs, wickets: second.wickets, balls: 6, isComplete: true },
    ],
    result: decision.decidedBy,
  };

  if (decision.winnerTeamId) {
    const winner = nameOf(decision.winnerTeamId);
    const byOrganisers = decision.decidedBy === "ORGANISERS";

    match.result.resultType = "SUPER_OVER_WIN";
    match.result.winnerTeamId = decision.winnerTeamId;
    match.result.margin = "super over";
    match.result.textEn = `${winner} won the super over (${score})${byOrganisers ? ", decided by the organisers" : ""}`;
    match.result.textBn = `${winner} সুপার ওভারে জিতেছে (${score})${byOrganisers ? ", আয়োজকদের সিদ্ধান্তে" : ""}`;
  } else {
    match.result.resultType = "TIE";
    match.result.winnerTeamId = null;
    match.result.margin = "";
    match.result.textEn = `Match tied and the super over was tied too (${score}). Points shared`;
    match.result.textBn = `ম্যাচ টাই, সুপার ওভারও টাই (${score})। পয়েন্ট ভাগ`;
  }

  await match.save();

  const season = await import("../services/seasonService.js").then((m) =>
    m.resolveSeason(match.seasonId),
  );
  await scoringService.refreshPointsTable(match.seasonId, season?.matchRules ?? {});
  await scoringService.syncFinalAwards(match);

  const io = req.app.get("io");
  if (io) {
    const { emitMatchCompleted, emitPointsUpdate } = await import("../socket/index.js");
    emitMatchCompleted(io, { matchId: String(req.params.matchId), result: match.result });
    emitPointsUpdate(io, { seasonId: String(match.seasonId) });
  }

  res.status(200).json(ok(match.toJSON(), "Super over recorded"));
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
  substitutePlayer,
  undoBall,
  endInnings,
  setResult,
  getSquad,
};

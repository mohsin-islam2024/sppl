import { Match } from "../models/Match.js";
import { Ball } from "../models/Ball.js";
import { Player } from "../models/Player.js";
import { PointsTable } from "../models/PointsTable.js";
import { Award } from "../models/Award.js";
import { resolveSeason } from "./seasonService.js";
import { recomputeSeasonStats } from "./statsService.js";
import * as engine from "./scoringEngine.js";
import {
  EXTRA_TYPE,
  WICKET_TYPE,
  MATCH_STATUS,
} from "@sppl/shared/constants/matchStatus.js";
import { netRunRate } from "@sppl/shared/utils/nrr.js";
import ApiError from "../utils/ApiError.js";
import { rulesForMatch, maxWicketsFor, squadSizeFor } from "../utils/matchRules.js";
import { restoreRetirements } from "../utils/substitution.js";
import { applyCreaseSelection } from "../utils/crease.js";

/**
 * Live scoring service.
 *
 * The engine (`scoringEngine.js`) contains the pure cricket rules and knows nothing
 * about the database. This file is the other half: it loads the match, applies the
 * engine's verdict, writes the delivery and keeps every derived structure — the
 * innings totals, the batting and bowling lines, the points table and the player
 * statistics — in step.
 *
 * It is a SEQUENTIAL service by necessity. Two balls recorded at once would both read
 * the same "balls before" value and both write the same position, corrupting the
 * innings.
 */

/* ------------------------------------------------------------------ *
 * Players at the crease
 * ------------------------------------------------------------------ */

/**
 * Set or replace the striker, non-striker and bowler for the current innings.
 *
 * Called at three moments in a match's life:
 *   - right after start, to name the opening pair and the first bowler
 *   - after a wicket, to bring the next batter in
 *   - at the end of an over, to name the next bowler
 *
 * One function handles all three because the operation is identical: clear the old
 * markers, set the new ones.
 */
export async function setPlayers({
  matchId,
  strikerId,
  nonStrikerId,
  bowlerId,
}) {
  const match = await Match.findById(matchId);
  if (!match) throw ApiError.notFound("Match not found");

  if (match.status !== MATCH_STATUS.LIVE) {
    throw ApiError.badRequest(
      "Players can only be set while the match is live",
    );
  }

  const innings = match.innings[match.currentInnings];
  if (!innings) throw ApiError.badRequest("No innings is in progress");

  // Every id must belong to one of the two playing squads. A stray id from the
  // season roster would put a non-playing player on the field.
  const playingIds = new Set(
    (match.playingSquads ?? []).flatMap((squad) => squad.playerIds.map(String)),
  );

  for (const [label, id] of [
    ["striker", strikerId],
    ["non-striker", nonStrikerId],
    ["bowler", bowlerId],
  ]) {
    if (id && !playingIds.has(String(id))) {
      throw ApiError.badRequest(`The ${label} is not in either playing squad`);
    }
  }

  if (strikerId && nonStrikerId && String(strikerId) === String(nonStrikerId)) {
    throw ApiError.badRequest(
      "The striker and non-striker must be different players",
    );
  }

  const battingLine = (id) =>
    (innings.batting ?? []).find(
      (line) => String(line.playerId) === String(id),
    );

  for (const [label, id] of [
    ["striker", strikerId],
    ["non-striker", nonStrikerId],
  ]) {
    if (!id) continue;
    const line = battingLine(id);
    if (!line)
      throw ApiError.badRequest(`The ${label} is not in the batting side`);
    if (line.isOut) throw ApiError.badRequest(`The ${label} is already out`);
  }

  // The marker rules live in one tested place. Naming only a non-striker must leave
  // the striker on strike; clearing it here is what made the striker vanish in the
  // second innings, where the openers are chosen one at a time.
  applyCreaseSelection(innings.batting, { strikerId, nonStrikerId });

  if (bowlerId) {
    const isInBowlingSide = (innings.bowling ?? []).some(
      (line) => String(line.playerId) === String(bowlerId),
    );
    if (!isInBowlingSide) {
      throw ApiError.badRequest("The bowler is not in the bowling side");
    }

    for (const line of innings.bowling ?? []) {
      const isTheBowler = String(line.playerId) === String(bowlerId);
      line.isBowling = isTheBowler;
      if (isTheBowler) {
        // A fresh over, so the maiden check restarts.
        line.currentOverRuns = 0;
        line.currentOverBalls = 0;
      }
    }
  }

  await match.save();
  return match;
}

/* ------------------------------------------------------------------ *
 * Recording a delivery
 * ------------------------------------------------------------------ */

/** How long a ball may sit unreflected in the match before it is treated as a leftover. */
const ORPHAN_BALL_AFTER_MS = 15 * 1000;

/** The reply for a delivery that had already been recorded when it was sent again. */
function duplicateBallResult(match, ball) {
  const innings = match.innings?.[ball.innings];
  return {
    ball: ball.toObject(),
    match,
    inningsEnded: Boolean(innings?.isComplete),
    inningsEndReason: innings?.closedReason ?? null,
    matchCompleted: match.status === MATCH_STATUS.COMPLETED,
    duplicate: true,
  };
}

/**
 * Record one delivery and return the new match state.
 */
export async function recordBall({ matchId, delivery, userId, healed = false }) {
  const match = await Match.findById(matchId);
  if (!match) throw ApiError.notFound("Match not found");

  // A retried request must be recognised BEFORE anything else is checked. If the
  // ball that finished the match had its reply lost, the retry arrives when the match
  // is no longer live, and the "only while live" check below would call a successful
  // ball a failure.
  if (delivery.clientBallId) {
    const earlier = await Ball.findOne({
      matchId: match._id,
      clientBallId: delivery.clientBallId,
    });

    if (earlier) {
      if (earlier.sequence <= match.ballSequence) {
        return duplicateBallResult(match, earlier);
      }

      // The ball was saved but the match never advanced to include it (the server
      // stopped between the two writes). Remove the orphan and record it properly
      // below; returning "already recorded" here would leave the score short by a
      // ball and every later ball colliding with the orphan's sequence number.
      await Ball.deleteOne({ _id: earlier._id });
    }
  }

  if (match.status !== MATCH_STATUS.LIVE) {
    throw ApiError.badRequest(
      `Scoring is only possible while the match is live (currently ${match.status})`,
    );
  }

  const season = await resolveSeason(match.seasonId, { required: true });
  // The match may override the season's overs, so the innings limit is read from the
  // match's own rules, not from the season directly.
  const rules = rulesForMatch(match, season.matchRules);

  const inningsIndex = delivery.innings;
  const innings = match.innings[inningsIndex];
  if (!innings) throw ApiError.badRequest("That innings has not started");

  const rulesForDelivery = {
    runsWideValue: rules.wideRuns ?? 1,
    runsNoBallValue: rules.noBallRuns ?? 1,
  };

  const ballsPerInnings =
    (rules.oversPerInnings ?? 10) * (rules.ballsPerOver ?? 6);
  // All out is decided by the players this side really has, not the season's nominal 9.
  const maxWickets = maxWicketsFor(match, innings.battingTeamId, rules);

  engine.validateDelivery(delivery, {
    isFreeHit: Boolean(match.freeHitPending),
    rules,
    inningsComplete: innings.isComplete,
  });

  const totalRuns = engine.computeDeliveryRuns(delivery, rulesForDelivery);
  const bowlerRuns = engine.runsChargedToBowler(delivery, rulesForDelivery);
  const runsRun = engine.runsRunByBatters(delivery);

  const counter = engine.advanceBallCounter(innings.balls, delivery.extraType);
  const overComplete = engine.completesOver(
    counter.legalBalls,
    rules.ballsPerOver ?? 6,
    delivery.extraType,
  );

  const nextRuns = innings.runs + totalRuns;
  const nextWickets = innings.wickets + (delivery.isWicket ? 1 : 0);

  const endCheck = engine.checkInningsEnd({
    legalBalls: counter.legalBalls,
    ballsPerInnings,
    wickets: nextWickets,
    maxWickets,
    target: innings.target,
    runs: nextRuns,
  });

  applyDeliveryToInnings({
    innings,
    delivery,
    rules: rulesForDelivery,
    counter,
    bowlerRuns,
    totalRuns,
  });

  innings.runs = nextRuns;
  innings.wickets = nextWickets;
  innings.balls = counter.legalBalls;

  // The console sends player ids, not names, and a wicket's commentary needs both
  // ("Sohel strikes: Saddam out"). Without them it came out as "  strikes —  out".
  // Wickets are rare, so one small lookup then is cheap; any failure falls back to the
  // old (nameless) text rather than ever holding up a ball.
  let batterName = delivery.batterName ?? "";
  let bowlerName = delivery.bowlerName ?? "";
  if (
    delivery.isWicket &&
    !(delivery.commentaryBn || delivery.commentaryEn) &&
    (!batterName || !bowlerName)
  ) {
    try {
      const outId = delivery.dismissedPlayerId ?? delivery.batterId;
      const people = await Player.find({ _id: { $in: [outId, delivery.bowlerId] } })
        .select("fullName jerseyName")
        .lean();
      const nameOf = (id) => {
        const person = people.find((entry) => String(entry._id) === String(id));
        return person?.jerseyName || person?.fullName || "";
      };
      batterName = batterName || nameOf(outId);
      bowlerName = bowlerName || nameOf(delivery.bowlerId);
    } catch {
      // Keep the nameless text; the ball itself must still be recorded.
    }
  }

  const commentary =
    delivery.commentaryBn || delivery.commentaryEn
      ? {
          commentaryBn: delivery.commentaryBn ?? "",
          commentaryEn: delivery.commentaryEn ?? "",
        }
      : engine.buildCommentary(delivery, { batterName, bowlerName });

  const ball = new Ball({
    matchId: match._id,
    seasonId: match.seasonId,
    innings: inningsIndex,
    overIndex: counter.overIndex,
    ballInOver: counter.ballInOver,
    legalBallNumber: counter.legalBallNumber,
    sequence: match.ballSequence + 1,
    clientBallId: delivery.clientBallId ?? null,
    batterId: delivery.batterId,
    nonStrikerId: delivery.nonStrikerId,
    bowlerId: delivery.bowlerId,
    runsBat: delivery.runsBat ?? 0,
    runsBye: delivery.runsBye ?? 0,
    extraType: delivery.extraType ?? null,
    totalRuns,
    isWicket: Boolean(delivery.isWicket),
    wicketType: delivery.wicketType ?? null,
    dismissedPlayerId: delivery.dismissedPlayerId ?? null,
    fielderId: delivery.fielderId ?? null,
    isFreeHit: Boolean(match.freeHitPending),
    grantsFreeHit: engine.grantsFreeHit(delivery, rules),
    isBoundaryFour: (delivery.runsBat ?? 0) === 4 && !delivery.extraType,
    isBoundarySix: (delivery.runsBat ?? 0) === 6 && !delivery.extraType,
    scoreAfter: {
      runs: nextRuns,
      wickets: nextWickets,
      legalBalls: counter.legalBalls,
      display: engine.displayOvers(counter.legalBalls),
    },
    ...commentary,
    recordedBy: userId ?? null,
  });

  // The unique index on (matchId, innings, sequence) is the concurrency guard: a
  // double-tap produces the same sequence twice and the second insert is rejected.
  try {
    await ball.save();
  } catch (error) {
    if (error.code === 11000) {
      // Two copies of the same request in flight at once (a retry racing the
      // original): the one that lost is a duplicate, not a conflict.
      if (delivery.clientBallId && error.keyPattern?.clientBallId) {
        const winner = await Ball.findOne({
          matchId: match._id,
          clientBallId: delivery.clientBallId,
        });
        if (winner) {
          return duplicateBallResult(await Match.findById(match._id), winner);
        }
      }

      // Not a retry: some earlier request saved a ball at this very position but the
      // match never advanced to include it (the server stopped between the two
      // writes). Left alone it blocks EVERY further ball, because each new ball asks
      // for the same position. A genuine concurrent request finishes in well under a
      // second, so a ball that has sat there longer than that is such a leftover.
      // It is not in the score (ballSequence never reached it), so removing it
      // loses nothing; then the delivery is tried again, once.
      if (!healed) {
        const stuck = await Ball.findOne({
          matchId: match._id,
          sequence: match.ballSequence + 1,
        });
        const age = stuck ? Date.now() - new Date(stuck.createdAt).getTime() : 0;
        if (stuck && age > ORPHAN_BALL_AFTER_MS) {
          await Ball.deleteOne({ _id: stuck._id });
          return recordBall({ matchId, delivery, userId, healed: true });
        }
      }

      throw ApiError.conflict("That delivery was already recorded");
    }
    throw error;
  }

  match.ballSequence += 1;
  match.freeHitPending = engine.grantsFreeHit(delivery, rules);

  if (engine.shouldRotateStrike({ runsRun, overComplete })) {
    swapStrike(innings);
  }

  // A wicket removes whoever was dismissed and leaves the crease empty for them.
  // The scorer then names the incoming batter through setPlayers.
  removeDismissedBatter(innings, delivery);

  // An over change clears the bowler marker so the console can ask for the next one.
  if (overComplete && innings.bowling?.length) {
    for (const line of innings.bowling) line.isBowling = false;
  }

  let inningsEnded = false;
  if (endCheck.complete) {
    innings.isComplete = true;
    innings.closedReason = endCheck.reason;
    inningsEnded = true;

    if (inningsIndex === 1 || endCheck.reason === "TARGET_REACHED") {
      closeMatch(match);
    } else {
      openSecondInnings(match, rules);
    }
  }

  await match.save();

  if (endCheck.complete) {
    await refreshPointsTable(match.seasonId, rules);
    await syncFinalAwards(match);
  }

  // Player statistics are rebuilt once the match is over, not on every delivery. A
  // season is small enough to recompute from scratch, and rebuilding is what makes
  // an undo safe: the figures are derived, never accumulated.
  if (match.status === MATCH_STATUS.COMPLETED) {
    await recomputeSeasonStats(match.seasonId);
  }

  return {
    ball: ball.toObject(),
    match,
    inningsEnded,
    inningsEndReason: endCheck.reason,
    matchCompleted: match.status === MATCH_STATUS.COMPLETED,
  };
}

/**
 * Undo the last delivery.
 */
export async function undoLastBall({ matchId, innings: requestedInnings }) {
  const match = await Match.findById(matchId);
  if (!match) throw ApiError.notFound("Match not found");

  // Only 0 or 1 is a real innings. Anything else (an object, text, nothing) means "the
  // one in progress". Passing it to the query unchecked turned a malformed request into
  // a database cast error that reached the scorer as "Invalid value for innings".
  const asNumber =
    requestedInnings === null ||
    requestedInnings === undefined ||
    typeof requestedInnings === "object"
      ? NaN
      : Number(requestedInnings);
  const inningsIndex = asNumber === 0 || asNumber === 1 ? asNumber : match.currentInnings;

  const lastBall = await Ball.findOne({
    matchId: match._id,
    innings: inningsIndex,
  })
    .sort({ sequence: -1 })
    .lean();

  if (!lastBall)
    throw ApiError.badRequest("There is no delivery to undo in this innings");

  await Ball.deleteOne({ _id: lastBall._id });

  const season = await resolveSeason(match.seasonId, { required: true });
  await rebuildInnings(match, inningsIndex, rulesForMatch(match, season.matchRules));

  // Undoing the very FIRST ball leaves no deliveries to replay, and a rebuild from
  // nothing empties the crease: the openers and the bowler would have to be chosen
  // all over again. Put them back, exactly as they were for that ball.
  const remaining = await Ball.countDocuments({ matchId: match._id, innings: inningsIndex });
  if (remaining === 0) {
    const rebuilt = match.innings[inningsIndex];
    applyCreaseSelection(rebuilt.batting, {
      strikerId: lastBall.batterId,
      nonStrikerId: lastBall.nonStrikerId,
    });
    for (const line of rebuilt.bowling ?? []) {
      line.isBowling = String(line.playerId) === String(lastBall.bowlerId);
    }
  }

  match.ballSequence = Math.max(0, match.ballSequence - 1);

  if (match.status === MATCH_STATUS.COMPLETED) {
    match.status = MATCH_STATUS.LIVE;
    match.result = {
      resultType: null,
      winnerTeamId: null,
      margin: "",
      textBn: "",
      textEn: "",
      completedAt: null,
    };
    match.pointsProcessed = false;

    // A result that is being taken back drags its consequences with it: a recorded
    // super over, and the champion / runner-up that a final's result had set.
    match.superOver = { played: false, innings: [], result: null };
    await clearFinalAwards(match);
  }

  await match.save();
  await refreshPointsTable(match.seasonId, season.matchRules ?? {});

  // An undo can take a finished match back to live, so the season's player
  // statistics have to move with it — otherwise the figures keep the undone runs.
  await recomputeSeasonStats(match.seasonId);

  return { undoneBall: lastBall, match };
}

/**
 * Rebuild one innings entirely from its remaining deliveries.
 */
export async function rebuildInnings(match, inningsIndex, rules) {
  const balls = await Ball.find({ matchId: match._id, innings: inningsIndex })
    .sort({ sequence: 1 })
    .lean();

  const innings = match.innings[inningsIndex];
  if (!innings) throw ApiError.badRequest("That innings does not exist");

  const ballsPerOver = rules.ballsPerOver ?? 6;
  const ballsPerInnings = (rules.oversPerInnings ?? 10) * ballsPerOver;
  const maxWickets = maxWicketsFor(match, innings.battingTeamId, rules);

  innings.runs = 0;
  innings.wickets = 0;
  innings.balls = 0;
  innings.extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  innings.isComplete = false;
  innings.closedReason = null;

  for (const line of innings.batting ?? []) {
    line.runs = 0;
    line.balls = 0;
    line.fours = 0;
    line.sixes = 0;
    line.isOut = false;
    line.dismissalType = null;
    line.dismissedByPlayerId = null;
    line.fielderPlayerId = null;
    line.hasBatted = false;
    line.isStriker = false;
  }
  for (const line of innings.bowling ?? []) {
    line.balls = 0;
    line.runs = 0;
    line.wickets = 0;
    line.maidens = 0;
    line.wides = 0;
    line.noBalls = 0;
    line.currentOverRuns = 0;
    line.currentOverBalls = 0;
    line.isBowling = false;
  }

  const rulesForDelivery = {
    runsWideValue: rules.wideRuns ?? 1,
    runsNoBallValue: rules.noBallRuns ?? 1,
  };

  match.freeHitPending = false;

  for (const ball of balls) {
    const counter = engine.advanceBallCounter(innings.balls, ball.extraType);
    const bowlerRuns = engine.runsChargedToBowler(ball, rulesForDelivery);
    const totalRuns = ball.totalRuns;
    const runsRun = engine.runsRunByBatters(ball);
    const overComplete = engine.completesOver(
      counter.legalBalls,
      ballsPerOver,
      ball.extraType,
    );

    applyDeliveryToInnings({
      innings,
      delivery: ball,
      rules: rulesForDelivery,
      counter,
      bowlerRuns,
      totalRuns,
    });

    innings.runs += totalRuns;
    innings.wickets += ball.isWicket ? 1 : 0;
    innings.balls = counter.legalBalls;

    match.freeHitPending = ball.grantsFreeHit;

    if (engine.shouldRotateStrike({ runsRun, overComplete }))
      swapStrike(innings);

    // The same order as when the ball was first recorded: strike first, then the
    // dismissed batter leaves. Without this an undo would bring the wicket back with
    // the dismissed striker still flagged as the one on strike.
    removeDismissedBatter(innings, ball);
  }

  // The replay only knows about deliveries, so a batter who retired hurt would come
  // back as if nothing had happened. Put the retirements back.
  restoreRetirements(innings);

  const endCheck = engine.checkInningsEnd({
    legalBalls: innings.balls,
    ballsPerInnings,
    wickets: innings.wickets,
    maxWickets,
    target: innings.target,
    runs: innings.runs,
  });

  if (endCheck.complete) {
    innings.isComplete = true;
    innings.closedReason = endCheck.reason;
  }

  return innings;
}

/* ------------------------------------------------------------------ *
 * Innings and match transitions
 * ------------------------------------------------------------------ */

/**
 * Open the second innings.
 */
export function openSecondInnings(match, rules) {
  const first = match.innings[0];

  if (match.innings.length > 1) {
    match.innings[1].target = first.runs + 1;
    match.currentInnings = 1;
    return match;
  }

  const battingTeamId =
    match.playingSquads?.length === 2
      ? match.playingSquads.find(
          (squad) => String(squad.teamId) !== String(first.battingTeamId),
        )?.teamId
      : match.teamAId;

  const bowlingTeamId = first.battingTeamId;

  const resolveSquad = (teamId) =>
    match.playingSquads?.find(
      (squad) => String(squad.teamId) === String(teamId),
    )?.playerIds ?? [];

  const battingOrder = resolveSquad(battingTeamId);
  const bowlingSquad = resolveSquad(bowlingTeamId);

  match.innings.push({
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    batting: battingOrder.map((playerId) => ({
      playerId,
      isStriker: false,
      hasBatted: false,
    })),
    bowling: bowlingSquad.map((playerId) => ({ playerId })),
    target: first.runs + 1,
    isComplete: false,
  });

  match.currentInnings = 1;
  match.status = MATCH_STATUS.LIVE;

  return match;
}

/**
 * Finish the match and write the result text.
 */
export function closeMatch(match) {
  const first = match.innings[0];
  const second = match.innings[1];

  if (!second) {
    match.status = MATCH_STATUS.COMPLETED;
    return match;
  }

  match.status = MATCH_STATUS.COMPLETED;

  if (second.runs >= second.target) {
    // The chasing side's own squad: the margin is how many of THEIR wickets were left.
    // (It used to read the first squad in the list, which is the wrong team half the
    // time and wrong whenever the two sides have different numbers of players.)
    const wicketsLeft = squadSizeFor(match, second.battingTeamId, 9) - 1 - second.wickets;
    const margin = `${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    match.result = {
      resultType: "WIN",
      winnerTeamId: second.battingTeamId,
      margin,
      textBn: `${wicketsLeft} উইকেটে জয়`,
      textEn: `Won by ${margin}`,
      completedAt: new Date(),
    };
    return match;
  }

  if (second.runs === first.runs) {
    match.result = {
      resultType: "TIE",
      winnerTeamId: null,
      margin: "tie",
      textBn: "ম্যাচ টাই হয়েছে",
      textEn: "Match tied",
      completedAt: new Date(),
    };
    return match;
  }

  const margin = `${first.runs - second.runs} run${first.runs - second.runs === 1 ? "" : "s"}`;
  match.result = {
    resultType: "WIN",
    winnerTeamId: first.battingTeamId,
    margin,
    textBn: `${first.runs - second.runs} রানে জয়`,
    textEn: `Won by ${margin}`,
    completedAt: new Date(),
  };

  return match;
}

/* ------------------------------------------------------------------ *
 * Points table
 * ------------------------------------------------------------------ */

export async function refreshPointsTable(seasonId, rules = {}) {
  const oversPerInnings = rules.oversPerInnings ?? 10;

  // Only league matches earn table points. A semi-final or the final is decided by
  // knockout, and counting it here would hand the finalists extra wins and shift the
  // net run rate the league was ranked on. `$nin` (rather than `stage: "LEAGUE"`)
  // keeps matches saved before the stage field existed, which have no stage at all.
  const leagueOnly = { stage: { $nin: ["SEMI_FINAL", "FINAL"] } };

  const [teams, matches] = await Promise.all([
    Match.distinct("teamAId", { seasonId, ...leagueOnly }),
    Match.find({
      seasonId,
      status: MATCH_STATUS.COMPLETED,
      ...leagueOnly,
    }).lean(),
  ]);

  const allTeams = new Set(teams.map(String));
  for (const match of matches) {
    allTeams.add(String(match.teamAId));
    allTeams.add(String(match.teamBId));
  }

  const table = new Map();
  for (const teamId of allTeams) {
    table.set(teamId, {
      seasonId,
      teamId,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      ballsFor: 0,
      runsAgainst: 0,
      ballsAgainst: 0,
      nrr: 0,
      recentForm: [],
    });
  }

  const pointsSystem = rules.pointsSystem ?? {
    win: 2,
    loss: 0,
    tieOrNoResult: 1,
  };

  for (const match of matches) {
    const first = match.innings?.[0];
    const second = match.innings?.[1];
    if (!first || !second) continue;

    const teamA = table.get(String(match.teamAId));
    const teamB = table.get(String(match.teamBId));
    if (!teamA || !teamB) continue;

    const sideA =
      String(first.battingTeamId) === String(match.teamAId) ? first : second;
    const sideB = sideA === first ? second : first;

    teamA.played += 1;
    teamB.played += 1;

    teamA.runsFor += sideA.runs ?? 0;
    teamA.ballsFor += sideA.balls ?? 0;
    teamA.runsAgainst += sideB.runs ?? 0;
    teamA.ballsAgainst += sideB.balls ?? 0;

    teamB.runsFor += sideB.runs ?? 0;
    teamB.ballsFor += sideB.balls ?? 0;
    teamB.runsAgainst += sideA.runs ?? 0;
    teamB.ballsAgainst += sideA.balls ?? 0;

    const winner = match.result?.winnerTeamId;
    const isTie =
      match.result?.resultType === "TIE" ||
      match.result?.resultType === "NO_RESULT";

    if (isTie) {
      // A match that stayed level through its super over shares the points by the
      // season's own super-over rule; a plain tie or no-result uses the ordinary one.
      const shared = match.superOver?.played
        ? (pointsSystem.superOverTieSplit ?? pointsSystem.tieOrNoResult ?? 1)
        : (pointsSystem.tieOrNoResult ?? 1);

      teamA.tied += 1;
      teamB.tied += 1;
      teamA.points += shared;
      teamB.points += shared;
      teamA.recentForm.push("T");
      teamB.recentForm.push("T");
    } else if (winner && String(winner) === String(match.teamAId)) {
      teamA.won += 1;
      teamB.lost += 1;
      teamA.points += pointsSystem.win ?? 2;
      teamA.recentForm.push("W");
      teamB.recentForm.push("L");
    } else if (winner && String(winner) === String(match.teamBId)) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += pointsSystem.win ?? 2;
      teamB.recentForm.push("W");
      teamA.recentForm.push("L");
    }
  }

  for (const row of table.values()) {
    row.nrr = netRunRate({
      runsFor: row.runsFor,
      ballsFor: row.ballsFor,
      runsAgainst: row.runsAgainst,
      ballsAgainst: row.ballsAgainst,
      oversPerInnings,
    });
    row.recentForm = row.recentForm.slice(-5);
  }

  await Promise.all(
    [...table.values()].map((row) =>
      PointsTable.findOneAndUpdate(
        { seasonId, teamId: row.teamId },
        { $set: row },
        { upsert: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  return table;
}

/* ------------------------------------------------------------------ *
 * Final result -> champion and runner-up
 * ------------------------------------------------------------------ */

/**
 * When the FINAL finishes with a winner, record the champion and the runner-up.
 *
 * The two awards are tied to the final through `matchId`, which is what lets an undo
 * remove exactly these and nothing an admin typed by hand. Only the winner fields
 * are written, so a note or a figure an admin added to the award survives a re-run.
 *
 * It does nothing for any other stage, for a match still in play, and for a final
 * with no winner yet (a tie waiting on its super over).
 */
export async function syncFinalAwards(match) {
  if (match.stage !== "FINAL") return;
  if (match.status !== MATCH_STATUS.COMPLETED) return;

  const winnerId = match.result?.winnerTeamId;
  if (!winnerId) return;

  const loserId =
    String(winnerId) === String(match.teamAId) ? match.teamBId : match.teamAId;

  const write = (type, teamId) =>
    Award.findOneAndUpdate(
      { seasonId: match.seasonId, type },
      { $set: { winnerTeamId: teamId, matchId: match._id } },
      { upsert: true, setDefaultsOnInsert: true },
    );

  await Promise.all([write("CHAMPION", winnerId), write("RUNNER_UP", loserId)]);
}

/** Remove the champion / runner-up that this final's result created. */
export async function clearFinalAwards(match) {
  if (match.stage !== "FINAL") return;
  await Award.deleteMany({
    matchId: match._id,
    type: { $in: ["CHAMPION", "RUNNER_UP"] },
  });
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function applyDeliveryToInnings({
  innings,
  delivery,
  rules,
  counter,
  bowlerRuns,
  totalRuns,
}) {
  const batterId = String(delivery.batterId);
  const bowlerId = String(delivery.bowlerId);

  const batter = (innings.batting ?? []).find(
    (line) => String(line.playerId) === batterId,
  );
  const bowler = (innings.bowling ?? []).find(
    (line) => String(line.playerId) === bowlerId,
  );

  if (batter) {
    batter.hasBatted = true;
    if (delivery.extraType !== EXTRA_TYPE.WIDE) batter.balls += 1;
    if (!delivery.extraType || delivery.extraType === EXTRA_TYPE.NO_BALL) {
      batter.runs += delivery.runsBat ?? 0;
      if (delivery.runsBat === 4) batter.fours += 1;
      if (delivery.runsBat === 6) batter.sixes += 1;
    }
  }

  if (bowler) {
    bowler.isBowling = true;
    if (![EXTRA_TYPE.WIDE, EXTRA_TYPE.NO_BALL].includes(delivery.extraType)) {
      bowler.balls += 1;
      bowler.currentOverBalls += 1;
    }
    bowler.runs += bowlerRuns;
    bowler.currentOverRuns += bowlerRuns;

    if (delivery.extraType === EXTRA_TYPE.WIDE) bowler.wides += 1;
    if (delivery.extraType === EXTRA_TYPE.NO_BALL) bowler.noBalls += 1;

    if (
      delivery.isWicket &&
      ![WICKET_TYPE.RUN_OUT].includes(delivery.wicketType)
    ) {
      bowler.wickets += 1;
    }

    if (
      engine.completesOver(
        counter.legalBalls,
        rules.ballsPerOver ?? 6,
        delivery.extraType,
      )
    ) {
      if (bowler.currentOverRuns === 0) bowler.maidens += 1;
      bowler.currentOverRuns = 0;
      bowler.currentOverBalls = 0;
    }
  }

  if (delivery.isWicket && delivery.dismissedPlayerId) {
    const dismissed = (innings.batting ?? []).find(
      (line) => String(line.playerId) === String(delivery.dismissedPlayerId),
    );
    if (dismissed) {
      // The details of the dismissal are recorded here, but `isOut` is NOT set yet.
      // The strike has to be settled while BOTH batters are still at the crease:
      // swapStrike works on the two batters at the crease and does nothing when one
      // is already out. Marking him out first meant that a wicket on the last ball of
      // an over (where the ends must change) skipped the change completely, so the
      // survivor never took the strike and the new batter was put on strike instead.
      // removeDismissedBatter() takes him off, after the strike has moved.
      dismissed.dismissalType = delivery.wicketType;
      dismissed.dismissedByPlayerId =
        delivery.wicketType === WICKET_TYPE.RUN_OUT ? null : delivery.bowlerId;
      dismissed.fielderPlayerId = delivery.fielderId ?? null;
    }
  }

  if (delivery.extraType === EXTRA_TYPE.WIDE) innings.extras.wides += 1;
  if (delivery.extraType === EXTRA_TYPE.NO_BALL) innings.extras.noBalls += 1;
  if (delivery.extraType === EXTRA_TYPE.BYE)
    innings.extras.byes += delivery.runsBye ?? 0;
  if (delivery.extraType === EXTRA_TYPE.LEG_BYE)
    innings.extras.legByes += delivery.runsBye ?? 0;

  for (const line of innings.batting ?? []) {
    line.isStriker = String(line.playerId) === String(delivery.batterId);
  }
}

/** Swap striker and non-striker. */
/**
 * Take the dismissed batter off the crease. Always called AFTER the strike has been
 * rotated for the delivery (see the note in applyDeliveryToInnings).
 */
function removeDismissedBatter(innings, delivery) {
  if (!delivery.isWicket || !delivery.dismissedPlayerId) return;

  for (const line of innings.batting ?? []) {
    if (String(line.playerId) === String(delivery.dismissedPlayerId)) {
      line.isOut = true;
      line.isStriker = false;
    }
  }
}

function swapStrike(innings) {
  const batters = (innings.batting ?? []).filter(
    (line) => line.hasBatted && !line.isOut,
  );
  if (batters.length < 2) return;

  const striker = batters.find((line) => line.isStriker) ?? batters[0];
  const other = batters.find((line) => line !== striker);
  if (!other) return;

  striker.isStriker = false;
  other.isStriker = true;
}

/**
 * Also a NAMED export. The controllers import this module as a namespace
 * (`import * as scoringService`) and call `scoringService.recomputeStats(...)`, but the
 * function existed only inside the default export below, so every such call threw
 * "scoringService.recomputeStats is not a function". That broke ending the second
 * innings by hand ("End innings") and the manual result endpoint, after the match had
 * already been saved, so the scorer saw an error for something that had half worked.
 */
export { recomputeSeasonStats as recomputeStats };

export default {
  recordBall,
  undoLastBall,
  rebuildInnings,
  refreshPointsTable,
  syncFinalAwards,
  clearFinalAwards,
  closeMatch,
  setPlayers,
  recomputeStats: recomputeSeasonStats,
};

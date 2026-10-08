import mongoose from "mongoose";
import { Match } from "../models/Match.js";
import { Player } from "../models/Player.js";
import { PlayerStat } from "../models/PlayerStat.js";
import { Team } from "../models/Team.js";
import {
  WICKET_TYPE,
  MATCH_STATUS,
} from "@sppl/shared/constants/matchStatus.js";


/**
 * Career statistics, rebuilt from match data.
 *
 * Recomputed rather than incremented. An undo can un-complete a match, and an
 * incremented total has no way back from that — the innings would say 44 runs while
 * the player's season total still said 88. Rebuilding is exact at any moment, and a
 * season is small enough that the cost is irrelevant.
 *
 * Called when a match reaches COMPLETED, and available as a script so an existing
 * database can be backfilled.
 */

/**
 * Rebuild every player's season statistics for one season.
 *
 * @param {string|import('mongoose').Types.ObjectId} seasonId
 * @returns {Promise<{players: number, matches: number}>}
 */
export async function recomputeSeasonStats(seasonId) {
  const seasonObjectId = new mongoose.Types.ObjectId(String(seasonId));

  const [matches, players] = await Promise.all([
    Match.find({
      seasonId: seasonObjectId,
      status: MATCH_STATUS.COMPLETED,
    }).lean(),
    Player.find({ seasonId: seasonObjectId }).lean(),
  ]);

  // One accumulator per player, seeded so a player with no appearances still gets a
  // row of zeros rather than no row at all — the squad page reads these.
  const stats = new Map();

  for (const player of players) {
    stats.set(
      String(player._id),
      emptyStats({
        seasonId: seasonObjectId,
        playerId: player._id,
        teamId: player.teamId,
      }),
    );
  }

  /** Find or create the accumulator for a player id. */
  const rowFor = (playerId, teamId) => {
    const key = String(playerId);
    if (!stats.has(key)) {
      stats.set(
        key,
        emptyStats({ seasonId: seasonObjectId, playerId, teamId }),
      );
    }
    return stats.get(key);
  };

  for (const match of matches) {
    const playingIds = new Set(
      (match.playingSquads ?? []).flatMap((squad) =>
        squad.playerIds.map(String),
      ),
    );

    // Who actually took the field: everyone named in a playing squad. A player who
    // was in the squad but never batted still counts as one appearance.
    for (const squad of match.playingSquads ?? []) {
      for (const playerId of squad.playerIds ?? []) {
        const row = rowFor(playerId, squad.teamId);
        row.matches += 1;
      }
    }

    const manOfMatch = match.motmPlayerId ? String(match.motmPlayerId) : null;
    if (manOfMatch) {
      rowFor(match.motmPlayerId, null).playerOfMatchAwards += 1;
    }

    for (const [inningsIndex, innings] of (match.innings ?? []).entries()) {
      // --- Batting -----------------------------------------------------------
      for (const line of innings.batting ?? []) {
        if (!line.hasBatted && !line.isStriker && (line.balls ?? 0) === 0)
          continue;

        const row = rowFor(line.playerId, innings.battingTeamId);
        row.inningsBatted += 1;
        row.runs += line.runs ?? 0;
        row.ballsFaced += line.balls ?? 0;
        row.fours += line.fours ?? 0;
        row.sixes += line.sixes ?? 0;

        if (line.isOut) {
          row.dismissals += 1;
          if ((line.runs ?? 0) === 0) row.ducks += 1;
        } else {
          row.notOuts += 1;
        }

        // High score keeps its not-out marker, so "45*" is not reported as "45".
        const score = line.runs ?? 0;
        if (
          score > row.highScore ||
          (score === row.highScore && !line.isOut && !row.highScoreNotOut)
        ) {
          row.highScore = score;
          row.highScoreNotOut = !line.isOut;
        }

        if (score >= 100) row.hundreds += 1;
        else if (score >= 50) row.fifties += 1;
      }

      // --- Bowling -----------------------------------------------------------
      for (const line of innings.bowling ?? []) {
        if ((line.balls ?? 0) === 0) continue;

        const row = rowFor(line.playerId, innings.bowlingTeamId);
        row.ballsBowled += line.balls ?? 0;
        row.runsConceded += line.runs ?? 0;
        row.wickets += line.wickets ?? 0;
        row.maidens += line.maidens ?? 0;

        if ((line.wickets ?? 0) >= 3) row.threeWicketHauls += 1;

        // Best bowling: more wickets first, then fewer runs.
        const wickets = line.wickets ?? 0;
        const runs = line.runs ?? 0;
        const isBetter =
          wickets > (row.bestBowlingWickets ?? 0) ||
          (wickets === row.bestBowlingWickets &&
            runs < (row.bestBowlingRuns ?? Infinity));

        if (wickets > 0 && isBetter) {
          row.bestBowlingWickets = wickets;
          row.bestBowlingRuns = runs;
        }
      }

      // --- Fielding ----------------------------------------------------------
      // Only dismissals that name a fielder count — a bowled or lbw has none.
      for (const line of innings.batting ?? []) {
        if (!line.isOut) continue;
        if (!line.fielderPlayerId) continue;

        const type = line.dismissalType;
        if (type === WICKET_TYPE.CAUGHT) {
          rowFor(line.fielderPlayerId, innings.bowlingTeamId).catches += 1;
        } else if (type === WICKET_TYPE.RUN_OUT) {
          rowFor(line.fielderPlayerId, innings.bowlingTeamId).runOuts += 1;
        } else if (type === WICKET_TYPE.STUMPED) {
          rowFor(line.fielderPlayerId, innings.bowlingTeamId).stumpings += 1;
        }
      }

      // A dismissal without a fielder credited it to nobody; nothing to record.
      void inningsIndex;
    }
  }

  // Replace this season's rows wholesale — an upsert per player would leave behind
  // a row for someone who is no longer in the season.
  await PlayerStat.deleteMany({ seasonId: seasonObjectId });

  const rows = [...stats.values()].filter((row) => row.playerId);
  if (rows.length) {
    await PlayerStat.insertMany(rows, { ordered: false });
  }

  // A cached squad size keeps the team cards honest without a per-request count.
  await refreshTeamSquadSizes(seasonObjectId);

  return { players: rows.length, matches: matches.length };
}

/**
 * Rebuild statistics for every season.
 *
 * Used to backfill a database that was populated before this service existed.
 *
 * @returns {Promise<Array<{seasonId: string, players: number, matches: number}>>}
 */
export async function recomputeAllStats() {
  const seasonIds = await Match.distinct("seasonId");
  const results = [];

  for (const seasonId of seasonIds) {
    const result = await recomputeSeasonStats(seasonId);
    results.push({ seasonId: String(seasonId), ...result });
  }

  return results;
}

/**
 * A player's career figures: every season added together.
 *
 * Derived on read rather than stored, because a stored career total would have to be
 * kept in step with every season rebuild and would silently drift the first time one
 * of those rebuilds was missed.
 *
 * @param {string} playerId
 */
export async function getCareerTotals(playerId) {
  const rows = await PlayerStat.find({ playerId }).lean();
  if (!rows.length) return null;

  const total = rows.reduce(
    (accumulator, row) => {
      accumulator.matches += row.matches ?? 0;
      accumulator.innings += row.inningsBatted ?? 0;
      accumulator.notOuts += row.notOuts ?? 0;
      accumulator.runs += row.runs ?? 0;
      accumulator.ballsFaced += row.ballsFaced ?? 0;
      accumulator.fours += row.fours ?? 0;
      accumulator.sixes += row.sixes ?? 0;
      accumulator.fifties += row.fifties ?? 0;
      accumulator.hundreds += row.hundreds ?? 0;
      accumulator.ducks += row.ducks ?? 0;
      accumulator.dismissals += row.dismissals ?? 0;
      accumulator.ballsBowled += row.ballsBowled ?? 0;
      accumulator.runsConceded += row.runsConceded ?? 0;
      accumulator.wickets += row.wickets ?? 0;
      accumulator.maidens += row.maidens ?? 0;
      accumulator.threeWicketHauls += row.threeWicketHauls ?? 0;
      accumulator.catches += row.catches ?? 0;
      accumulator.runOuts += row.runOuts ?? 0;
      accumulator.stumpings += row.stumpings ?? 0;
      accumulator.playerOfMatchAwards += row.playerOfMatchAwards ?? 0;

      // A career high score is the best across seasons, keeping its not-out marker.
      if (
        (row.highScore ?? 0) > accumulator.highScore ||
        ((row.highScore ?? 0) === accumulator.highScore && row.highScoreNotOut)
      ) {
        accumulator.highScore = row.highScore ?? 0;
        accumulator.highScoreNotOut = Boolean(row.highScoreNotOut);
      }

      // Best bowling across seasons: more wickets first, then fewer runs.
      const wickets = row.bestBowlingWickets ?? 0;
      const runs = row.bestBowlingRuns;
      if (wickets > 0) {
        const isBetter =
          wickets > accumulator.bestBowlingWickets ||
          (wickets === accumulator.bestBowlingWickets &&
            runs !== null &&
            runs !== undefined &&
            (accumulator.bestBowlingRuns === null ||
              runs < accumulator.bestBowlingRuns));

        if (isBetter) {
          accumulator.bestBowlingWickets = wickets;
          accumulator.bestBowlingRuns = runs;
        }
      }

      return accumulator;
    },
    {
      matches: 0,
      innings: 0,
      notOuts: 0,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      fifties: 0,
      hundreds: 0,
      ducks: 0,
      dismissals: 0,
      ballsBowled: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
      threeWicketHauls: 0,
      catches: 0,
      runOuts: 0,
      stumpings: 0,
      playerOfMatchAwards: 0,
      highScore: 0,
      highScoreNotOut: false,
      bestBowlingWickets: 0,
      bestBowlingRuns: null,
      seasons: rows.length,
    },
  );

  return total;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function emptyStats({ seasonId, playerId, teamId }) {
  return {
    seasonId,
    playerId,
    teamId,
    matches: 0,
    inningsBatted: 0,
    notOuts: 0,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    highScore: 0,
    highScoreNotOut: false,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
    dismissals: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    bestBowlingWickets: 0,
    bestBowlingRuns: null,
    threeWicketHauls: 0,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    playerOfMatchAwards: 0,
  };
}

async function refreshTeamSquadSizes(seasonId) {
  const teams = await Team.find({ seasonId }).select("_id").lean();

  await Promise.all(
    teams.map(async (team) => {
      const count = await Player.countDocuments({
        teamId: team._id,
        active: true,
      });
      await Team.findByIdAndUpdate(team._id, { squadSize: count });
    }),
  );
}

export default { recomputeSeasonStats, recomputeAllStats, getCareerTotals };

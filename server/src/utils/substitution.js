/**
 * Replacing a player who cannot continue (injury, illness) with another player of
 * the same team, while a match is in progress.
 *
 * The tournament allows an injured player to be replaced by a different player, who
 * then takes over what the injured player had left to do. This module holds that rule
 * as plain functions over the match document, with no database access, so every
 * situation can be tested without a database.
 *
 * What "takes over" means, per innings the team plays in:
 *
 *   BATTING   the player has not batted        -> the replacement takes the same place
 *                                                 in the batting order
 *             the player is at the crease      -> he retires hurt (his runs stay on the
 *                                                 scorecard, he is NOT counted as a
 *                                                 wicket) and the replacement is added to
 *                                                 bat; the scorer then brings him in
 *                                                 the same way as after a wicket
 *             the player already batted / is out -> his innings stays as it was; the
 *                                                 replacement is added to bat if needed
 *   BOWLING   the player has not bowled        -> the replacement takes his place
 *             the player has bowled            -> his figures stay; the replacement gets
 *                                                 a fresh bowling line
 *
 * A line that carries figures is NEVER removed or reassigned. Undoing a ball rebuilds
 * an innings from the recorded deliveries, and those deliveries still name the
 * injured player; a line that had been taken away would leave them with nowhere to
 * land and his runs and wickets would vanish from the scorecard.
 */

const same = (a, b) => String(a) === String(b);

/**
 * Check a substitution and, if it is allowed, apply it to the match in place.
 *
 * Does not save. The caller saves, and records the substitution in match.substitutions
 * (that part needs the user and the ball sequence, which this module should not know).
 *
 * @param {object} match  a Match document (or any object of the same shape)
 * @param {{ teamId: string, outPlayerId: string, inPlayerId: string }} change
 * @returns {{ ok: true, retiredAtCrease: boolean, replacedBowler: boolean }
 *          | { ok: false, reason: string }}
 */
export function applySubstitution(match, { teamId, outPlayerId, inPlayerId }) {
  if (same(outPlayerId, inPlayerId)) {
    return { ok: false, reason: "The replacement must be a different player" };
  }

  const squad = (match.playingSquads ?? []).find((entry) => same(entry.teamId, teamId));
  if (!squad) {
    return { ok: false, reason: "That team is not playing in this match" };
  }

  const position = squad.playerIds.findIndex((id) => same(id, outPlayerId));
  if (position === -1) {
    return { ok: false, reason: "The player to replace is not in this team's playing squad" };
  }

  // Neither side may already have him: a player cannot be on the field twice, and a
  // player of the other team cannot be borrowed.
  const alreadyPlaying = (match.playingSquads ?? []).some((entry) =>
    entry.playerIds.some((id) => same(id, inPlayerId)),
  );
  if (alreadyPlaying) {
    return { ok: false, reason: "That player is already in a playing squad" };
  }

  // Someone who has been replaced is injured by definition; letting him back in would
  // also reuse a scorecard line that was closed off.
  const wasReplaced = (match.substitutions ?? []).some((entry) =>
    same(entry.outPlayerId, inPlayerId),
  );
  if (wasReplaced) {
    return { ok: false, reason: "That player was replaced earlier in this match and cannot return" };
  }

  squad.playerIds.splice(position, 1, inPlayerId);

  let retiredAtCrease = false;
  let replacedBowler = false;

  for (const innings of match.innings ?? []) {
    /* ---------------- the team is batting in this innings ---------------- */
    if (same(innings.battingTeamId, teamId)) {
      const batting = innings.batting ?? [];
      const line = batting.find((entry) => same(entry.playerId, outPlayerId));
      const hasReplacementLine = batting.some((entry) => same(entry.playerId, inPlayerId));

      if (line) {
        const hasFigures =
          line.hasBatted || line.isOut || (line.balls ?? 0) > 0 || (line.runs ?? 0) > 0;

        if (!hasFigures) {
          // Never came to the crease: the replacement simply takes the place.
          if (hasReplacementLine) {
            // Cannot happen with a well-formed innings; refusing is safer than
            // silently producing a batting order with the same player twice.
            return { ok: false, reason: "The replacement already has a place in this innings" };
          }
          line.playerId = inPlayerId;
        } else {
          const atCrease = line.hasBatted && !line.isOut;

          if (atCrease && !innings.isComplete) {
            // Retired hurt: leaves not out, and is not a wicket. `retiredHurt` is what
            // lets a rebuild after an undo restore this, because rebuilding clears
            // isOut and replays only the deliveries.
            line.retiredHurt = true;
            line.isOut = true;
            line.dismissalType = "RETIRED";
            line.isStriker = false;
            retiredAtCrease = true;
          }

          if (!hasReplacementLine && !innings.isComplete) {
            batting.push({ playerId: inPlayerId });
          }
        }
      } else if (!hasReplacementLine) {
        batting.push({ playerId: inPlayerId });
      }
    }

    /* ---------------- the team is bowling in this innings ---------------- */
    if (same(innings.bowlingTeamId, teamId)) {
      const bowling = innings.bowling ?? [];
      const line = bowling.find((entry) => same(entry.playerId, outPlayerId));
      const hasReplacementLine = bowling.some((entry) => same(entry.playerId, inPlayerId));

      if (line) {
        const hasFigures =
          (line.balls ?? 0) > 0 ||
          (line.runs ?? 0) > 0 ||
          (line.wickets ?? 0) > 0 ||
          (line.wides ?? 0) > 0 ||
          (line.noBalls ?? 0) > 0;

        if (!hasFigures) {
          if (hasReplacementLine) {
            return { ok: false, reason: "The replacement already has a place in this innings" };
          }
          line.playerId = inPlayerId;
        } else {
          if (line.isBowling) {
            // Mid-over: the scorer picks who bowls the rest, as at any change of bowler.
            line.isBowling = false;
            replacedBowler = true;
          }
          if (!hasReplacementLine && !innings.isComplete) {
            bowling.push({ playerId: inPlayerId });
          }
        }
      } else if (!hasReplacementLine) {
        bowling.push({ playerId: inPlayerId });
      }
    }
  }

  return { ok: true, retiredAtCrease, replacedBowler };
}

/**
 * Put back what a rebuild wipes: a batter who retired hurt.
 *
 * rebuildInnings zeroes every batting line (including isOut) and replays the recorded
 * deliveries, none of which mention a retirement. Calling this afterwards restores the
 * retired state from the one field that survives a rebuild.
 *
 * @param {{ batting?: Array }} innings
 */
export function restoreRetirements(innings) {
  for (const line of innings.batting ?? []) {
    if (line.retiredHurt) {
      line.isOut = true;
      line.dismissalType = "RETIRED";
      line.isStriker = false;
    }
  }
}

export default { applySubstitution, restoreRetirements };

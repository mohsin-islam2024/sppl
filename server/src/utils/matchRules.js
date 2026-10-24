/**
 * The rules that apply to ONE match.
 *
 * A season carries the default rules (overs per innings, players per side, and so
 * on). A single match may override how many overs it is played over: a rain-shortened
 * day, a semi-final played over a different length, a league that mixes formats.
 *
 * Everything that enforces a limit while scoring — when an innings ends, how the
 * innings is rebuilt after an undo — has to read the overs from here instead of from
 * the season directly, or a match set to 6 overs would still run to the season's 10.
 *
 * A match with no override (null / undefined, which is every match created before
 * this existed) falls back to the season, so existing matches behave exactly as they
 * did.
 *
 * @param {{ oversPerInnings?: number|null }} match
 * @param {object} [seasonRules]
 * @returns {object} a new rules object; the season's own is never modified
 */
export function rulesForMatch(match, seasonRules = {}) {
  const override = match?.oversPerInnings;

  if (Number.isInteger(override) && override > 0) {
    return { ...seasonRules, oversPerInnings: override };
  }
  return { ...seasonRules };
}

/**
 * The fewest players a side may take the field with. A real cricket match needs two
 * batters at the crease and enough bowlers to share the overs; below this the match
 * stops being cricket. It exists so that "a player is missing" can be handled, not so
 * that sides can shrink to nothing.
 */
export const MIN_PLAYERS_PER_SIDE = 5;

/** How many players a side has in this match: the squad that was actually picked. */
export function squadSizeFor(match, teamId, fallback = 9) {
  const squad = (match?.playingSquads ?? []).find(
    (entry) => String(entry.teamId) === String(teamId),
  );
  const size = squad?.playerIds?.length;
  return Number.isInteger(size) && size > 0 ? size : fallback;
}

/**
 * Wickets that end an innings: one fewer than the batting side's players, because the
 * last batter has nobody to bat with.
 *
 * It follows the squad that is really on the field, not the season's nominal figure.
 * With the season's 9 hard-wired, a side of 8 could never be bowled out: the innings
 * would wait for an 8th wicket that has no batter to fall.
 */
export function maxWicketsFor(match, battingTeamId, rules = {}) {
  return Math.max(1, squadSizeFor(match, battingTeamId, rules.playersPerSide ?? 9) - 1);
}

export default { rulesForMatch, squadSizeFor, maxWicketsFor, MIN_PLAYERS_PER_SIDE };

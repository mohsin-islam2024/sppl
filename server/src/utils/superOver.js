/**
 * Deciding the winner of a super over.
 *
 * A super over is one over each. The side with more runs wins. If the runs are level
 * the tournament rules split into two cases, because a league table can share the
 * points but a knockout match cannot end without a winner:
 *
 *   - LEAGUE       tied again -> the points are shared (the match stays a tie)
 *   - SEMI / FINAL tied again -> someone has to decide: the organisers name the
 *                                winner (for example on boundaries), and this
 *                                function refuses to guess
 *
 * Kept free of any database code so the rule can be tested on its own.
 *
 * @param {object} input
 * @param {{ teamId: string, runs: number, wickets: number }} input.first   side that batted first
 * @param {{ teamId: string, runs: number, wickets: number }} input.second  side that batted second
 * @param {string} input.stage  'LEAGUE' | 'SEMI_FINAL' | 'FINAL'
 * @param {string|null} [input.tiebreakWinnerTeamId]  organisers' call, knockouts only
 * @returns {{ ok: true, winnerTeamId: string|null, decidedBy: 'RUNS'|'ORGANISERS'|'TIED' }
 *          | { ok: false, reason: string }}
 */
export function decideSuperOver({ first, second, stage, tiebreakWinnerTeamId = null }) {
  if (String(first.teamId) === String(second.teamId)) {
    return { ok: false, reason: "The two super over sides must be different teams" };
  }

  if (first.runs > second.runs) {
    return { ok: true, winnerTeamId: String(first.teamId), decidedBy: "RUNS" };
  }
  if (second.runs > first.runs) {
    return { ok: true, winnerTeamId: String(second.teamId), decidedBy: "RUNS" };
  }

  // Level on runs.
  if (stage === "LEAGUE") {
    return { ok: true, winnerTeamId: null, decidedBy: "TIED" };
  }

  const named = tiebreakWinnerTeamId ? String(tiebreakWinnerTeamId) : "";
  if (named && [String(first.teamId), String(second.teamId)].includes(named)) {
    return { ok: true, winnerTeamId: named, decidedBy: "ORGANISERS" };
  }

  return {
    ok: false,
    reason: "The super over is tied and a knockout match needs a winner: choose one",
  };
}

/** "1 over, 11/1" style line for a super over side. */
export function formatSide({ runs, wickets }) {
  return `${runs}/${wickets}`;
}

export default { decideSuperOver, formatSide };

import { oversForRate } from "./overs.js";

/**
 * Net Run Rate, computed the way cricket governing bodies define it:
 *
 *   NRR = (runsFor / oversFaced) - (runsAgainst / oversBowled)
 *
 * A team all out before its full quota is treated as having faced its FULL quota
 * of overs (this is the standard rule and the caller decides when to apply it by
 * passing `isAllOut`).
 */
export function netRunRate({
  runsFor = 0,
  ballsFor = 0,
  runsAgainst = 0,
  ballsAgainst = 0,
  oversPerInnings,
  isAllOut = false,
  isOppositionAllOut = false,
} = {}) {
  const ballsPerInnings = (oversPerInnings ?? 0) * 6;

  const effectiveBallsFor =
    isAllOut && ballsPerInnings > 0
      ? Math.max(ballsFor, ballsPerInnings)
      : ballsFor;

  const effectiveBallsAgainst =
    isOppositionAllOut && ballsPerInnings > 0
      ? Math.max(ballsAgainst, ballsPerInnings)
      : ballsAgainst;

  const oversFaced = oversForRate(effectiveBallsFor);
  const oversBowled = oversForRate(effectiveBallsAgainst);

  const forRate = oversFaced > 0 ? runsFor / oversFaced : 0;
  const againstRate = oversBowled > 0 ? runsAgainst / oversBowled : 0;

  return forRate - againstRate;
}

/**
 * Round an NRR for display. Cricket convention is three decimals (e.g. +0.852).
 * @returns {string} signed, e.g. "+0.852" / "-0.300" / "0.000"
 */
export function formatNrr(value, decimals = 3) {
  const n = Number.isFinite(value) ? value : 0;
  const rounded = n.toFixed(decimals);
  return Number.parseFloat(rounded) > 0 ? `+${rounded}` : rounded;
}

/**
 * Sort comparator for a points table:
 *   1. points desc
 *   2. NRR desc
 *   3. wins desc
 *   4. name asc   (caller supplies `name` on each row for a stable tiebreak)
 */
export function comparePointsTableRows(a, b) {
  if ((b.points ?? 0) !== (a.points ?? 0))
    return (b.points ?? 0) - (a.points ?? 0);
  if ((b.nrr ?? 0) !== (a.nrr ?? 0)) return (b.nrr ?? 0) - (a.nrr ?? 0);
  if ((b.won ?? 0) !== (a.won ?? 0)) return (b.won ?? 0) - (a.won ?? 0);
  return String(a.name ?? "").localeCompare(String(b.name ?? ""));
}

/**
 * Attach table position after sorting.
 */
export function withPositions(rows = []) {
  return [...rows].sort(comparePointsTableRows).map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}

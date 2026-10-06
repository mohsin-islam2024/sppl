export const BALLS_PER_OVER = 6;

export function oversToBalls(oversDisplay) {
  if (typeof oversDisplay !== "number" || Number.isNaN(oversDisplay)) return 0;
  const completedOvers = Math.floor(oversDisplay);
  const ballPart = Math.round((oversDisplay - completedOvers) * 10);
  return completedOvers * BALLS_PER_OVER + ballPart;
}

export function ballsToOvers(balls) {
  const safeBalls = Math.max(0, Math.floor(balls || 0));
  return (
    Math.floor(safeBalls / BALLS_PER_OVER) + (safeBalls % BALLS_PER_OVER) / 10
  );
}

export function formatOvers(balls) {
  return ballsToOvers(balls).toFixed(1);
}

export function oversForRate(balls) {
  const safeBalls = Math.max(0, Math.floor(balls || 0));
  return safeBalls / BALLS_PER_OVER;
}

export function runRate(runs, balls) {
  const overs = oversForRate(balls);
  if (overs <= 0) return 0;
  return runs / overs;
}

export function requiredRunRate(target, runsScored, ballsRemaining) {
  const overs = oversForRate(ballsRemaining);
  if (overs <= 0) return null;
  return Math.max(0, target - runsScored) / overs;
}

export function isOverComplete(ballsInOver, ballsPerOver = BALLS_PER_OVER) {
  return ballsInOver >= ballsPerOver;
}

export function shouldRotateStrike({ runsRun = 0, overComplete = false } = {}) {
  const oddRuns = runsRun % 2 === 1;
  return overComplete ? !oddRuns : oddRuns;
}

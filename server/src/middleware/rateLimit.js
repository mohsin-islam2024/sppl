import rateLimit from "express-rate-limit";

/**
 * Rate limiters.
 *
 * The public read API stays generous — a live match page polls, and a whole village
 * on one connection should never be throttled. The strict limits sit on the paths
 * that write, and on scoring, where a stuck client retry loop is the realistic risk.
 */

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Broad limit for the public API: 1200 requests / 5 minutes / IP.
 *
 * The limit is per IP address, and at a ground the audience shares one: the venue's
 * wifi, or a mobile carrier that puts many phones behind one address. Fifty people
 * with a live match open easily exceed a few hundred requests in five minutes, and
 * when the shared budget runs out EVERYONE on that address is refused, the scorer
 * included. So scoring is excluded below, and the budget itself is sized for a crowd.
 */
export const globalLimiter = rateLimit({
  ...standardOptions,
  windowMs: 5 * 60 * 1000,
  max: 1200,
  // Scoring has its own limiter (scoringLimiter). It must not also draw on, or be
  // refused by, the budget the spectators are using up.
  skip: (req) => req.originalUrl.startsWith("/api/v1/scoring"),
  message: { success: false, message: "Too many requests, please slow down." },
});

/** Auth bootstrap and admin writes: 60 / 15 minutes / IP. */
export const writeLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: "Too many write requests, please try again later.",
  },
});

/**
 * Everything a scorer does gets its own budget: balls, undo, choosing batters and
 * bowlers, ending an innings, replacing a player. A 10-over innings is ~60 legal balls
 * per side plus a change of bowler every over and a new batter at every wicket, so 600
 * per 10 minutes comfortably covers two innings plus corrections, while still stopping
 * a runaway retry loop. (Only balls used to draw on this. The rest shared the 60 / 15
 * minutes meant for admin edits, which a busy innings plus an admin editing in another
 * tab could exhaust.)
 */
export const scoringLimiter = rateLimit({
  ...standardOptions,
  windowMs: 10 * 60 * 1000,
  max: 600,
  message: {
    success: false,
    message: "Scoring rate limit reached. Please wait a moment.",
  },
});

/** Signed uploads: expensive and rare — 30 / hour / IP. */
export const uploadLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Upload limit reached, please try again later.",
  },
});

export default globalLimiter;

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

/** Broad limit for everything: 300 requests / 5 minutes / IP. */
export const globalLimiter = rateLimit({
  ...standardOptions,
  windowMs: 5 * 60 * 1000,
  max: 300,
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
 * Ball submission gets its own budget: a 10-over innings is ~60 legal balls per
 * side, so 600 per 10 minutes comfortably covers two innings plus corrections,
 * while still stopping a runaway retry loop.
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

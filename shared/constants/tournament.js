/**
 * SPPL tournament defaults, taken from the official Season 1 (2026) organizer sheet.
 *
 * IMPORTANT: These are the values COPIED into a new Season document when an admin
 * creates a season. The scoring engine always reads rules from that season document,
 * never from these constants — so a future season may change overs or points freely.
 */
export const DEFAULT_MATCH_RULES = Object.freeze({
  oversPerInnings: 10,
  playersPerSide: 9,
  ballsPerOver: 6,
  wideRuns: 1,
  noBallRuns: 1,
  byeRuns: true,
  legByeRuns: true,
  freeHit: {
    enabled: true,
    /** On a free hit, the batter can only be dismissed run out. */
    dismissalRestriction: "RUN_OUT_ONLY",
  },
  superOverOnTie: true,
  /** If the super over is also tied, points are shared. */
  sharePointsIfSuperOverTied: true,
  /** Organizer representative at the boundary decides four / out. Final call. */
  boundaryJudgeDecisionFinal: true,
  /** Throwing with a slinging arm or bowling off a long run-up is not allowed. */
  bowlingActionRestrictions: ["NO_SLINGING_ARM", "NO_LONG_RUN_UP"],
  /** Code of conduct shown on the Rules page. */
  conductRulesBn: [
    "মাঠের মধ্যে কোনো অশালীন কথা বলা যাবে না।",
    "আম্পায়ারের সাথে উচ্চস্বরে কথা বলা যাবে না।",
    "বাউন্ডারির সাইডে আয়োজক প্রতিনিধির সিদ্ধান্ত চূড়ান্ত।",
    "হাত ঘুরে বা লং দৌড়ে বল করা যাবে না।",
  ],
  conductRulesEn: [
    "No abusive language inside the field.",
    "Do not speak loudly with the umpire.",
    "The organizer representative at the boundary has the final decision on four / out.",
    "Bowling with a slinging arm or off a long run-up is not allowed.",
  ],
});

export const DEFAULT_POINTS_SYSTEM = Object.freeze({
  win: 2,
  loss: 0,
  tieOrNoResult: 1,
  /** When a super over is also tied, each side receives this many points. */
  superOverTieSplit: 1,
});

export const SEASON_STATUS = Object.freeze({
  UPCOMING: "UPCOMING",
  ONGOING: "ONGOING",
  COMPLETED: "COMPLETED",
});

export const PLAYER_ROLE = Object.freeze({
  BATTER: "BATTER",
  BOWLER: "BOWLER",
  ALL_ROUNDER: "ALL_ROUNDER",
  WICKET_KEEPER: "WICKET_KEEPER",
});

export const BATTING_STYLE = Object.freeze({
  RIGHT_HAND: "RIGHT_HAND",
  LEFT_HAND: "LEFT_HAND",
});

export const BOWLING_STYLE = Object.freeze({
  RIGHT_ARM_FAST: "RIGHT_ARM_FAST",
  RIGHT_ARM_MEDIUM: "RIGHT_ARM_MEDIUM",
  RIGHT_ARM_OFF_SPIN: "RIGHT_ARM_OFF_SPIN",
  RIGHT_ARM_LEG_SPIN: "RIGHT_ARM_LEG_SPIN",
  LEFT_ARM_FAST: "LEFT_ARM_FAST",
  LEFT_ARM_MEDIUM: "LEFT_ARM_MEDIUM",
  LEFT_ARM_ORTHODOX: "LEFT_ARM_ORTHODOX",
  LEFT_ARM_CHINAMAN: "LEFT_ARM_CHINAMAN",
});

export const JERSEY_SIZES = Object.freeze(["S", "M", "L", "XL", "XXL", "XXXL"]);

export const AWARD_TYPES = Object.freeze({
  CHAMPION: "CHAMPION",
  RUNNER_UP: "RUNNER_UP",
  MAN_OF_THE_MATCH: "MAN_OF_THE_MATCH",
  MAN_OF_THE_TOURNAMENT: "MAN_OF_THE_TOURNAMENT",
  BEST_BATTER: "BEST_BATTER",
  BEST_BOWLER: "BEST_BOWLER",
  BEST_FIELDER: "BEST_FIELDER",
  PARTICIPATION_MEDAL: "PARTICIPATION_MEDAL",
});

export const SPONSOR_TIER = Object.freeze({
  TITLE: "TITLE",
  PLATINUM: "PLATINUM",
  GOLD: "GOLD",
  PARTNER: "PARTNER",
});

export const ANNOUNCEMENT_PRIORITY = Object.freeze({
  NORMAL: "NORMAL",
  IMPORTANT: "IMPORTANT",
  URGENT: "URGENT",
});

export const MEDIA_TYPE = Object.freeze({
  PHOTO: "PHOTO",
  VIDEO: "VIDEO",
});

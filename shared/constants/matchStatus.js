export const MATCH_STATUS = Object.freeze({
  UPCOMING: "UPCOMING",
  TOSS: "TOSS",
  LIVE: "LIVE",
  INNINGS_BREAK: "INNINGS_BREAK",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
});

export const MATCH_STAGE = Object.freeze({
  LEAGUE: "LEAGUE",
  SEMI_FINAL: "SEMI_FINAL",
  FINAL: "FINAL",
});

export const MATCH_RESULT_TYPE = Object.freeze({
  WIN: "WIN",
  TIE: "TIE",
  NO_RESULT: "NO_RESULT",
  SUPER_OVER_WIN: "SUPER_OVER_WIN",
});

export const TOSS_DECISION = Object.freeze({
  BAT: "BAT",
  BOWL: "BOWL",
});

export const EXTRA_TYPE = Object.freeze({
  WIDE: "WIDE",
  NO_BALL: "NO_BALL",
  BYE: "BYE",
  LEG_BYE: "LEG_BYE",
});

export const WICKET_TYPE = Object.freeze({
  BOWLED: "BOWLED",
  CAUGHT: "CAUGHT",
  LBW: "LBW",
  RUN_OUT: "RUN_OUT",
  STUMPED: "STUMPED",
  HIT_WICKET: "HIT_WICKET",
  RETIRED: "RETIRED",
});

/** Only run out is possible on a free hit. */
export const FREE_HIT_ALLOWED_DISMISSALS = Object.freeze([WICKET_TYPE.RUN_OUT]);

/** Match statuses in which the scoring engine accepts a new ball. */
export const SCORABLE_STATUSES = Object.freeze([MATCH_STATUS.LIVE]);

/** Statuses after which no further ball may be recorded. */
export const TERMINAL_STATUSES = Object.freeze([
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.ABANDONED,
]);

export const isMatchLive = (status) => status === MATCH_STATUS.LIVE;
export const isMatchFinished = (status) => TERMINAL_STATUSES.includes(status);
export const isBallRecordable = (status) => status === MATCH_STATUS.LIVE;

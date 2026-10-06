/**
 * Scoring engine — the heart of the live platform.
 *
 * Design rules that follow directly from the SPPL rule sheet:
 *
 *  1. A delivery is recorded through REST only, and the engine recomputes the
 *     innings from the ball list rather than mutating counters in place. That way
 *     an "undo" cannot leave the score drifted.
 *  2. Extras: a wide and a no-ball each add the season's configured run value plus
 *     any runs run. Byes and leg byes add only the runs actually run, and are NOT
 *     charged to the bowler.
 *  3. Free hit: a wide or no-ball arms the free hit for the NEXT delivery. On a
 *     free hit the batter can only be dismissed run out.
 *  4. An over ends after `ballsPerOver` LEGAL deliveries; wides and no-balls do not
 *     count toward the over.
 *  5. The strike rotates on odd runs run, and again at the end of an over.
 */

import { EXTRA_TYPE, WICKET_TYPE } from "@sppl/shared/constants/matchStatus.js";
import { ballsToOvers } from "@sppl/shared/utils/overs.js";
import ApiError from "../utils/ApiError.js";

/** Extras that do not consume one of the over's legal deliveries. */
const NON_LEGAL_EXTRAS = [EXTRA_TYPE.WIDE, EXTRA_TYPE.NO_BALL];

const isNonLegal = (extraType) => NON_LEGAL_EXTRAS.includes(extraType);

/**
 * Total runs added to the team score by a delivery.
 */
export function computeDeliveryRuns(
  { runsBat = 0, runsBye = 0, extraType = null },
  { runsWideValue = 1, runsNoBallValue = 1 } = {},
) {
  switch (extraType) {
    case EXTRA_TYPE.WIDE:
      // A wide is always at least its base value, plus any extra runs run.
      return runsWideValue + runsBye;
    case EXTRA_TYPE.NO_BALL:
      // No-ball adds its base value; runs off the bat still count, and the batter
      // is credited with them.
      return runsNoBallValue + runsBat + runsBye;
    case EXTRA_TYPE.BYE:
    case EXTRA_TYPE.LEG_BYE:
      return runsBye;
    default:
      return runsBat;
  }
}

/**
 * Runs charged to the bowler's analysis. Byes and leg byes are the keeper's /
 * fielding side's fault, not the bowler's.
 */
export function runsChargedToBowler(
  { runsBat = 0, runsBye = 0, extraType = null },
  rules = {},
) {
  if (extraType === EXTRA_TYPE.BYE || extraType === EXTRA_TYPE.LEG_BYE)
    return 0;
  return computeDeliveryRuns({ runsBat, runsBye, extraType }, rules);
}

/**
 * Runs physically run by the batters, which is what drives the strike rotation.
 */
export function runsRunByBatters({
  runsBat = 0,
  runsBye = 0,
  extraType = null,
}) {
  if (extraType === EXTRA_TYPE.BYE || extraType === EXTRA_TYPE.LEG_BYE)
    return runsBye;
  if (extraType === EXTRA_TYPE.WIDE) return runsBye;
  return runsBat;
}

/**
 * Does this delivery arm a free hit for the next ball?
 */
export function grantsFreeHit(delivery, rules) {
  if (!rules?.freeHit?.enabled) return false;
  return isNonLegal(delivery.extraType);
}

/**
 * Validate a delivery against the season rules before it is recorded.
 * Throws an `ApiError` with a readable message so the scorer sees the reason.
 */
export function validateDelivery(
  delivery,
  { isFreeHit = false, rules = {}, inningsComplete = false },
) {
  if (inningsComplete) {
    throw ApiError.badRequest("This innings is already complete");
  }

  const {
    runsBat = 0,
    runsBye = 0,
    extraType = null,
    isWicket = false,
    wicketType = null,
  } = delivery;

  if (runsBat < 0 || runsBat > 6) {
    throw ApiError.badRequest("Runs off the bat must be between 0 and 6");
  }

  if ([EXTRA_TYPE.BYE, EXTRA_TYPE.LEG_BYE].includes(extraType) && runsBat > 0) {
    throw ApiError.badRequest(
      "Byes and leg byes cannot also carry runs off the bat",
    );
  }

  if (extraType === EXTRA_TYPE.BYE && rules.byeRuns === false) {
    throw ApiError.badRequest("Byes are not enabled for this season");
  }
  if (extraType === EXTRA_TYPE.LEG_BYE && rules.legByeRuns === false) {
    throw ApiError.badRequest("Leg byes are not enabled for this season");
  }

  if (isWicket && !wicketType) {
    throw ApiError.badRequest("A wicket needs a dismissal type");
  }

  // Rule 3: on a free hit only a run out is possible.
  if (
    isWicket &&
    isFreeHit &&
    rules.freeHit?.dismissalRestriction === "RUN_OUT_ONLY"
  ) {
    if (wicketType !== WICKET_TYPE.RUN_OUT) {
      throw ApiError.badRequest(
        "On a free hit the batter can only be dismissed run out",
      );
    }
  }

  return true;
}

/**
 * Work out the legal-ball counter after this delivery.
 * Wides and no-balls repeat the current ball number; everything else advances it.
 */
export function advanceBallCounter(ballsBefore, extraType) {
  const legalBalls = isNonLegal(extraType) ? ballsBefore : ballsBefore + 1;
  const overIndex = isNonLegal(extraType)
    ? Math.floor(ballsBefore / 6)
    : Math.floor(legalBalls / 6);
  const ballInOver = isNonLegal(extraType)
    ? (ballsBefore % 6) + 1
    : ((legalBalls - 1) % 6) + 1;

  return { legalBallNumber: legalBalls, legalBalls, overIndex, ballInOver };
}

/**
 * Whether the delivery just recorded completes the over.
 */
export function completesOver(legalBalls, ballsPerOver = 6) {
  return legalBalls > 0 && legalBalls % ballsPerOver === 0;
}

/**
 * Whether the strike rotates after this delivery.
 * Odd runs run → rotate. End of over → rotate back, so both together cancel.
 */
export function shouldRotateStrike({ runsRun = 0, overComplete = false }) {
  const oddRuns = runsRun % 2 === 1;
  return overComplete ? !oddRuns : oddRuns;
}

/**
 * Has the innings finished?
 * An innings ends when the over quota is bowled, or when all batters but one are out.
 */
export function checkInningsEnd({
  legalBalls,
  ballsPerInnings,
  wickets,
  maxWickets,
  target,
  runs,
}) {
  if (target !== null && target !== undefined && runs >= target) {
    return { complete: true, reason: "TARGET_REACHED" };
  }
  if (wickets >= maxWickets) {
    return { complete: true, reason: "ALL_OUT" };
  }
  if (legalBalls >= ballsPerInnings) {
    return { complete: true, reason: "OVERS_COMPLETE" };
  }
  return { complete: false, reason: null };
}

/**
 * Build a short commentary line for a delivery in both languages.
 * Only used when the scorer has not typed their own.
 */
export function buildCommentary(
  delivery,
  { bowlerName = "", batterName = "" } = {},
) {
  const {
    runsBat = 0,
    extraType = null,
    isWicket = false,
    wicketType = null,
  } = delivery;

  if (isWicket) {
    return {
      commentaryBn: `${bowlerName} 🔥 ${batterName} আউট (${wicketType})`,
      commentaryEn: `${bowlerName} strikes — ${batterName} out (${wicketType})`,
    };
  }

  if (extraType === EXTRA_TYPE.WIDE) {
    return { commentaryBn: "ওয়াইড", commentaryEn: "Wide" };
  }
  if (extraType === EXTRA_TYPE.NO_BALL) {
    return { commentaryBn: "নো বল", commentaryEn: "No ball" };
  }
  if (extraType === EXTRA_TYPE.BYE) {
    return { commentaryBn: "বাই", commentaryEn: "Byes" };
  }
  if (extraType === EXTRA_TYPE.LEG_BYE) {
    return { commentaryBn: "লেগ বাই", commentaryEn: "Leg byes" };
  }

  if (runsBat === 0) return { commentaryBn: "ডট বল", commentaryEn: "Dot ball" };
  if (runsBat === 4) return { commentaryBn: "চার!", commentaryEn: "Four!" };
  if (runsBat === 6) return { commentaryBn: "ছক্কা!", commentaryEn: "Six!" };

  return {
    commentaryBn: `${runsBat} রান`,
    commentaryEn: `${runsBat} run${runsBat > 1 ? "s" : ""}`,
  };
}

/** Display helper: legal balls to the familiar over figure. */
export const displayOvers = (legalBalls) => ballsToOvers(legalBalls).toFixed(1);

export default {
  computeDeliveryRuns,
  runsChargedToBowler,
  runsRunByBatters,
  grantsFreeHit,
  validateDelivery,
  advanceBallCounter,
  completesOver,
  shouldRotateStrike,
  checkInningsEnd,
  buildCommentary,
  displayOvers,
};

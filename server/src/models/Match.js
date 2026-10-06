import mongoose from "mongoose";
import {
  MATCH_STAGE,
  MATCH_STATUS,
  TOSS_DECISION,
} from "@sppl/shared/constants/matchStatus.js";

/** One batter's / bowler's line inside an innings. */
const battingLineSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    runs: { type: Number, default: 0, min: 0 },
    balls: { type: Number, default: 0, min: 0 },
    fours: { type: Number, default: 0, min: 0 },
    sixes: { type: Number, default: 0, min: 0 },
    isOut: { type: Boolean, default: false },
    dismissalType: { type: String, default: null },
    dismissedByPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    fielderPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    isStriker: { type: Boolean, default: false },
    /** True once the player has come to the crease. */
    hasBatted: { type: Boolean, default: false },
  },
  { _id: false },
);

const bowlingLineSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    /** Legal balls bowled (not the display over figure). */
    balls: { type: Number, default: 0, min: 0 },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0 },
    maidens: { type: Number, default: 0, min: 0 },
    wides: { type: Number, default: 0, min: 0 },
    noBalls: { type: Number, default: 0, min: 0 },
    /** Runs conceded in the current over, used for the maiden-over check. */
    currentOverRuns: { type: Number, default: 0 },
    currentOverBalls: { type: Number, default: 0 },
    isBowling: { type: Boolean, default: false },
  },
  { _id: false },
);

const inningsSchema = new mongoose.Schema(
  {
    battingTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    bowlingTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0, max: 10 },
    /** Legal balls bowled — convert with helpers when displaying. */
    balls: { type: Number, default: 0, min: 0 },
    extras: {
      wides: { type: Number, default: 0, min: 0 },
      noBalls: { type: Number, default: 0, min: 0 },
      byes: { type: Number, default: 0, min: 0 },
      legByes: { type: Number, default: 0, min: 0 },
    },
    batting: { type: [battingLineSchema], default: [] },
    bowling: { type: [bowlingLineSchema], default: [] },
    /** Runs needed by the chasing side; null for the first innings. */
    target: { type: Number, default: null },
    isComplete: { type: Boolean, default: false },
    closedReason: { type: String, default: null },
  },
  { _id: false },
);

/**
 * A Match holds the live state of one game. Innings and line-ups are stored inline
 * so a single document read gives the scorer everything needed to render the card.
 * Individual deliveries live in the Ball collection (append-only).
 */
const matchSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    matchNo: { type: Number, required: true, min: 1 },
    stage: {
      type: String,
      enum: Object.values(MATCH_STAGE),
      default: MATCH_STAGE.LEAGUE,
    },
    teamAId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    teamBId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    venue: { type: String, trim: true, maxlength: 200, default: "" },
    startAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(MATCH_STATUS),
      default: MATCH_STATUS.UPCOMING,
      index: true,
    },
    toss: {
      winnerTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: null,
      },
      decision: {
        type: String,
        enum: [...Object.values(TOSS_DECISION), null],
        default: null,
      },
      completedAt: { type: Date, default: null },
    },
    /** teams[0].players is the IX actually playing, chosen before the toss. */
    playingSquads: {
      type: [
        {
          _id: false,
          teamId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true,
          },
          playerIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Player",
            default: [],
          },
        },
      ],
      default: [],
    },
    innings: { type: [inningsSchema], default: [] },
    currentInnings: { type: Number, default: 0, min: 0, max: 1 },
    /** Set when a free hit is pending for the next delivery. */
    freeHitPending: { type: Boolean, default: false },
    result: {
      resultType: {
        type: String,
        enum: ["WIN", "TIE", "NO_RESULT", "SUPER_OVER_WIN", null],
        default: null,
      },
      winnerTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
        default: null,
      },
      margin: { type: String, trim: true, default: "" },
      textBn: { type: String, trim: true, default: "" },
      textEn: { type: String, trim: true, default: "" },
      completedAt: { type: Date, default: null },
    },
    superOver: {
      played: { type: Boolean, default: false },
      innings: { type: [inningsSchema], default: [] },
      result: { type: String, default: null },
    },
    motmPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    scorerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    umpireIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    streamUrl: { type: String, trim: true, default: "" },
    pointsProcessed: { type: Boolean, default: false },
    /** Monotonic counter used to guard against out-of-order ball submissions. */
    ballSequence: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

matchSchema.index({ seasonId: 1, matchNo: 1 }, { unique: true });
matchSchema.index({ seasonId: 1, status: 1, startAt: 1 });
matchSchema.index({ seasonId: 1, startAt: 1 });

export const Match =
  mongoose.models.Match ?? mongoose.model("Match", matchSchema);
export default Match;

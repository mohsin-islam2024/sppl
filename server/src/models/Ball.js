import mongoose from "mongoose";
import { EXTRA_TYPE, WICKET_TYPE } from "@sppl/shared/constants/matchStatus.js";

/**
 * An append-only record of one delivery.
 *
 * Balls are never mutated after insert; an "undo" deletes the last ball and
 * recomputes the match innings state from the remaining balls. Nothing derived is
 * stored here except the display helpers, so a full match can always be rebuilt.
 */
const ballSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      index: true,
    },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    /** 0 = first innings, 1 = second innings. Super over uses 90 / 91. */
    innings: { type: Number, required: true, min: 0, max: 91 },
    /** 0-based over index. */
    overIndex: { type: Number, required: true, min: 0 },
    /** 1-based legal ball number inside the over. */
    ballInOver: { type: Number, required: true, min: 1 },
    /** Total legal balls bowled after this delivery (1-based). */
    legalBallNumber: { type: Number, required: true, min: 1 },
    sequence: { type: Number, required: true, min: 1 },

    batterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    nonStrikerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    bowlerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },

    /** Runs off the bat. */
    runsBat: { type: Number, default: 0, min: 0, max: 6 },
    /** Byes / leg byes actually run. */
    runsBye: { type: Number, default: 0, min: 0, max: 6 },
    extraType: {
      type: String,
      enum: [...Object.values(EXTRA_TYPE), null],
      default: null,
    },
    /** Total runs added to the team score by this delivery. */
    totalRuns: { type: Number, default: 0, min: 0 },

    isWicket: { type: Boolean, default: false },
    wicketType: {
      type: String,
      enum: [...Object.values(WICKET_TYPE), null],
      default: null,
    },
    dismissedPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    fielderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },

    isFreeHit: { type: Boolean, default: false },
    /** True when this delivery makes the NEXT one a free hit. */
    grantsFreeHit: { type: Boolean, default: false },

    isBoundaryFour: { type: Boolean, default: false },
    isBoundarySix: { type: Boolean, default: false },

    /** Score snapshot after this ball — lets the client replay without recomputing. */
    scoreAfter: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      legalBalls: { type: Number, default: 0 },
      display: { type: String, default: "0.0" },
    },

    commentaryBn: { type: String, trim: true, maxlength: 300, default: "" },
    commentaryEn: { type: String, trim: true, maxlength: 300, default: "" },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

/** A legal position in a match may hold only one delivery. */
ballSchema.index({ matchId: 1, innings: 1, sequence: 1 }, { unique: true });
ballSchema.index({ matchId: 1, innings: 1, overIndex: 1, ballInOver: 1 });
ballSchema.index({ matchId: 1, createdAt: 1 });

export const Ball = mongoose.models.Ball ?? mongoose.model("Ball", ballSchema);
export default Ball;

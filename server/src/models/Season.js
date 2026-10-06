import mongoose from "mongoose";
import {
  SEASON_STATUS,
  DEFAULT_POINTS_SYSTEM,
} from "@sppl/shared/constants/tournament.js";

const pointsSystemSchema = new mongoose.Schema(
  {
    win: { type: Number, default: DEFAULT_POINTS_SYSTEM.win, min: 0 },
    loss: { type: Number, default: DEFAULT_POINTS_SYSTEM.loss, min: 0 },
    tieOrNoResult: {
      type: Number,
      default: DEFAULT_POINTS_SYSTEM.tieOrNoResult,
      min: 0,
    },
    superOverTieSplit: {
      type: Number,
      default: DEFAULT_POINTS_SYSTEM.superOverTieSplit,
      min: 0,
    },
  },
  { _id: false },
);

const matchRulesSchema = new mongoose.Schema(
  {
    oversPerInnings: { type: Number, default: 10, min: 1, max: 50 },
    playersPerSide: { type: Number, default: 9, min: 2, max: 11 },
    ballsPerOver: { type: Number, default: 6, min: 1, max: 10 },
    wideRuns: { type: Number, default: 1, min: 0, max: 5 },
    noBallRuns: { type: Number, default: 1, min: 0, max: 5 },
    byeRuns: { type: Boolean, default: true },
    legByeRuns: { type: Boolean, default: true },
    freeHit: {
      enabled: { type: Boolean, default: true },
      dismissalRestriction: {
        type: String,
        enum: ["RUN_OUT_ONLY", "ALL"],
        default: "RUN_OUT_ONLY",
      },
    },
    superOverOnTie: { type: Boolean, default: true },
    sharePointsIfSuperOverTied: { type: Boolean, default: true },
    boundaryJudgeDecisionFinal: { type: Boolean, default: true },
    bowlingActionRestrictions: {
      type: [String],
      default: ["NO_SLINGING_ARM", "NO_LONG_RUN_UP"],
    },
    conductRulesBn: { type: [String], default: [] },
    conductRulesEn: { type: [String], default: [] },
  },
  { _id: false },
);

/**
 * A Season is the root container. Every other season-bound collection points here,
 * which is what lets Season 1, 2, 3 ... live side by side with no schema migration.
 */
const seasonSchema = new mongoose.Schema(
  {
    seasonNo: { type: Number, required: true, min: 1, max: 999 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    nameBn: { type: String, required: true, trim: true, maxlength: 200 },
    nameEn: { type: String, required: true, trim: true, maxlength: 200 },
    shortName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
      default: "SPPL",
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(SEASON_STATUS),
      default: SEASON_STATUS.UPCOMING,
      index: true,
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    venue: { type: String, trim: true, maxlength: 200, default: "" },
    location: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "Sotahar Poshchim Para",
    },
    logoUrl: { type: String, trim: true, default: "" },
    bannerUrl: { type: String, trim: true, default: "" },
    pointsSystem: { type: pointsSystemSchema, default: () => ({}) },
    matchRules: { type: matchRulesSchema, default: () => ({}) },
    teamCount: { type: Number, default: 0, min: 0 },
    championTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    runnerUpTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
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

/** seasonNo and year are unique together; slug is the public URL key. */
seasonSchema.index({ seasonNo: 1, year: 1 }, { unique: true });
seasonSchema.index({ status: 1, year: -1 });

/** Generate a stable slug when one is not supplied. */
seasonSchema.pre("validate", function generateSlug(next) {
  if (!this.slug && this.shortName && this.seasonNo) {
    this.slug = `${this.shortName}-${this.seasonNo}-${this.year}`.toLowerCase();
  }
  next();
});

export const Season =
  mongoose.models.Season ?? mongoose.model("Season", seasonSchema);
export default Season;

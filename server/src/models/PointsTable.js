import mongoose from "mongoose";

/**
 * One row per team per season. Recalculated after every completed match by
 * `pointsService`, never edited by hand.
 */
const pointsTableSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    played: { type: Number, default: 0, min: 0 },
    won: { type: Number, default: 0, min: 0 },
    lost: { type: Number, default: 0, min: 0 },
    tied: { type: Number, default: 0, min: 0 },
    noResult: { type: Number, default: 0, min: 0 },
    points: { type: Number, default: 0, min: 0 },

    runsFor: { type: Number, default: 0, min: 0 },
    /** Legal balls faced — converted to overs when computing the run rate. */
    ballsFor: { type: Number, default: 0, min: 0 },
    runsAgainst: { type: Number, default: 0, min: 0 },
    ballsAgainst: { type: Number, default: 0, min: 0 },

    /** Cached, sorted value; recomputed by the points service. */
    nrr: { type: Number, default: 0 },
    isAllOut: { type: Boolean, default: false },
    streak: {
      type: String,
      enum: ["", "W", "L", "T", "NR"],
      default: "",
    },
    recentForm: { type: [String], default: [] },
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

pointsTableSchema.index({ seasonId: 1, teamId: 1 }, { unique: true });
pointsTableSchema.index({ seasonId: 1, points: -1, nrr: -1 });

export const PointsTable =
  mongoose.models.PointsTable ??
  mongoose.model("PointsTable", pointsTableSchema);
export default PointsTable;

import mongoose from "mongoose";

/**
 * Career aggregate per player per season, rebuilt from Ball + Match data by
 * `statsService`. Keeping it materialised makes player pages and the "compare"
 * screen fast without aggregating thousands of ball documents on every request.
 */
const playerStatSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },

    matches: { type: Number, default: 0, min: 0 },
    inningsBatted: { type: Number, default: 0, min: 0 },
    notOuts: { type: Number, default: 0, min: 0 },

    runs: { type: Number, default: 0, min: 0 },
    ballsFaced: { type: Number, default: 0, min: 0 },
    fours: { type: Number, default: 0, min: 0 },
    sixes: { type: Number, default: 0, min: 0 },
    highScore: { type: Number, default: 0, min: 0 },
    highScoreNotOut: { type: Boolean, default: false },
    fifties: { type: Number, default: 0, min: 0 },
    hundreds: { type: Number, default: 0, min: 0 },
    ducks: { type: Number, default: 0, min: 0 },
    dismissals: { type: Number, default: 0, min: 0 },

    ballsBowled: { type: Number, default: 0, min: 0 },
    runsConceded: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0 },
    maidens: { type: Number, default: 0, min: 0 },
    bestBowlingWickets: { type: Number, default: 0, min: 0 },
    bestBowlingRuns: { type: Number, default: null },
    threeWicketHauls: { type: Number, default: 0, min: 0 },

    catches: { type: Number, default: 0, min: 0 },
    runOuts: { type: Number, default: 0, min: 0 },
    stumpings: { type: Number, default: 0, min: 0 },

    playerOfMatchAwards: { type: Number, default: 0, min: 0 },
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

playerStatSchema.index({ seasonId: 1, playerId: 1 }, { unique: true });
playerStatSchema.index({ seasonId: 1, runs: -1 });
playerStatSchema.index({ seasonId: 1, wickets: -1 });

/** Virtual career figures — not stored, only used for display. */
playerStatSchema.virtual("battingAverage").get(function average() {
  if (!this.dismissals) return null;
  return this.runs / this.dismissals;
});

playerStatSchema.virtual("strikeRate").get(function strikeRate() {
  if (!this.ballsFaced) return null;
  return (this.runs / this.ballsFaced) * 100;
});

playerStatSchema.virtual("economy").get(function economy() {
  if (!this.ballsBowled) return null;
  return this.runsConceded / (this.ballsBowled / 6);
});

playerStatSchema.virtual("bowlingAverage").get(function bowlingAverage() {
  if (!this.wickets) return null;
  return this.runsConceded / this.wickets;
});

playerStatSchema.set("toJSON", { virtuals: true });
playerStatSchema.set("toObject", { virtuals: true });

export const PlayerStat =
  mongoose.models.PlayerStat ?? mongoose.model("PlayerStat", playerStatSchema);
export default PlayerStat;

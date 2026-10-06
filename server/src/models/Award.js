import mongoose from "mongoose";

/**
 * Tournament honours. A match-level award carries `matchId`; season-level awards
 * (champion, best batter) leave it null.
 */
const awardSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "CHAMPION",
        "RUNNER_UP",
        "MAN_OF_THE_MATCH",
        "MAN_OF_THE_TOURNAMENT",
        "BEST_BATTER",
        "BEST_BOWLER",
        "BEST_FIELDER",
        "PARTICIPATION_MEDAL",
      ],
      index: true,
    },
    winnerPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    winnerTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    /** Award value that produced the honour, e.g. "312 runs, SR 158.4". */
    statValue: { type: String, trim: true, default: "" },
    noteBn: { type: String, trim: true, maxlength: 300, default: "" },
    noteEn: { type: String, trim: true, maxlength: 300, default: "" },
    /** Medals awarded to every squad member — stored per player, not per team. */
    isSquadWide: { type: Boolean, default: false },
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

awardSchema.index({ seasonId: 1, type: 1, createdAt: -1 });

export const Award =
  mongoose.models.Award ?? mongoose.model("Award", awardSchema);
export default Award;

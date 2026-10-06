import mongoose from "mongoose";

/**
 * A Team belongs to exactly one season. The same club name in a later season is a
 * NEW document with a new `seasonId`, which keeps historical squads intact.
 */
const teamSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    shortName: { type: String, required: true, trim: true, maxlength: 8 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    logoUrl: { type: String, trim: true, default: "" },
    logoPublicId: { type: String, trim: true, default: "" },
    themeColor: {
      type: String,
      trim: true,
      match: /^#[0-9a-f]{6}$/i,
      default: "#1e6fd9",
    },
    captainPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    viceCaptainPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    squadSize: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
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

/** A slug is unique inside a season, not across seasons. */
teamSchema.index({ seasonId: 1, slug: 1 }, { unique: true });
teamSchema.index({ seasonId: 1, order: 1 });

export const Team = mongoose.models.Team ?? mongoose.model("Team", teamSchema);
export default Team;

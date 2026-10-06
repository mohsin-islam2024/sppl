import mongoose from "mongoose";
import {
  PLAYER_ROLE,
  BATTING_STYLE,
  BOWLING_STYLE,
} from "@sppl/shared/constants/tournament.js";

/**
 * A Player is a per-season squad record. Jersey details come straight from the
 * organizer's jersey sheet; `size` accepts an adult size or a kids size ("8y").
 */
const playerSchema = new mongoose.Schema(
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
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    /** Name printed on the jersey, which is often shorter than the full name. */
    jerseyName: { type: String, required: true, trim: true, maxlength: 20 },
    jerseyNo: { type: Number, required: true, min: 0, max: 999 },
    size: { type: String, required: true, trim: true },
    isKidsSize: { type: Boolean, default: false },
    role: {
      type: String,
      enum: Object.values(PLAYER_ROLE),
      default: PLAYER_ROLE.BATTER,
    },
    battingStyle: {
      type: String,
      enum: Object.values(BATTING_STYLE),
      default: null,
    },
    bowlingStyle: {
      type: String,
      enum: Object.values(BOWLING_STYLE),
      default: null,
    },
    dateOfBirth: { type: Date, default: null },
    ageYears: { type: Number, default: null, min: 0, max: 99 },
    photoUrl: { type: String, trim: true, default: "" },
    photoPublicId: { type: String, trim: true, default: "" },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
    /** Jersey confirmed by the organizer (matches the ✅ marks on the sheet). */
    jerseyConfirmed: { type: Boolean, default: false },
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

playerSchema.index({ seasonId: 1, teamId: 1, order: 1 });
/**
 * Jersey numbers should be unique inside one team. This is NOT declared unique in
 * MongoDB so an admin can still save a squad mid-correction; the API surfaces a
 * warning instead. Flip to `unique: true` once the jersey sheet is final.
 */
playerSchema.index({ seasonId: 1, teamId: 1, jerseyNo: 1 }, { unique: false });
playerSchema.index({ fullName: "text", jerseyName: "text" });

export const Player =
  mongoose.models.Player ?? mongoose.model("Player", playerSchema);
export default Player;

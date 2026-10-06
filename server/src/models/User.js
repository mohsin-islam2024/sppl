import mongoose from "mongoose";
import { ROLES } from "@sppl/shared/constants/roles.js";

/**
 * A User mirrors a Firebase Auth account.
 *
 * Firebase owns credentials (email, password, Google, verification). This document
 * owns everything the app needs: display name, role, and the optional link to a
 * player / team for the current season.
 *
 * The `role` here is a MIRROR of the Firebase custom claim and is used for display
 * and admin listing. Authorization always re-checks the verified token claim.
 */
const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
    },
    name: { type: String, trim: true, maxlength: 120, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: "",
    },
    photoUrl: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
      index: true,
    },
    /** Links a PLAYER account to the squad entry for a season. */
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: null },
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

userSchema.index({ role: 1, createdAt: -1 });

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
export default User;

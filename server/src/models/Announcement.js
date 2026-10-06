import mongoose from "mongoose";
import { ANNOUNCEMENT_PRIORITY } from "@sppl/shared/constants/tournament.js";

const announcementSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    titleBn: { type: String, required: true, trim: true, maxlength: 200 },
    titleEn: { type: String, required: true, trim: true, maxlength: 200 },
    bodyBn: { type: String, required: true, maxlength: 5000 },
    bodyEn: { type: String, required: true, maxlength: 5000 },
    priority: {
      type: String,
      enum: Object.values(ANNOUNCEMENT_PRIORITY),
      default: ANNOUNCEMENT_PRIORITY.NORMAL,
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    /** Set once a season finishes so old notices drop out of the ticker. */
    expiresAt: { type: Date, default: null },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

announcementSchema.index({ seasonId: 1, active: 1, createdAt: -1 });

export const Announcement =
  mongoose.models.Announcement ??
  mongoose.model("Announcement", announcementSchema);
export default Announcement;

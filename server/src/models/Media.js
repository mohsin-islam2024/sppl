import mongoose from "mongoose";

/**
 * A registry of Cloudinary assets the site owns.
 *
 * Why keep this at all when the URL is already on each document? Because deleting
 * a team, sponsor or gallery item should also clean up the asset in Cloudinary —
 * and only this table knows the `publicId` and which document owns it. It also
 * makes it possible to find orphaned uploads during housekeeping.
 */
const mediaSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    secureUrl: { type: String, trim: true, default: "" },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      default: "image",
    },
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
    folder: { type: String, trim: true, default: "" },
    /** Which collection and document this asset belongs to. */
    ownerType: {
      type: String,
      enum: ["Season", "Team", "Player", "News", "Gallery", "Sponsor", "Video"],
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

mediaSchema.index({ publicId: 1 }, { unique: true });
mediaSchema.index({ ownerType: 1, ownerId: 1 });

export const Media =
  mongoose.models.Media ?? mongoose.model("Media", mediaSchema);
export default Media;

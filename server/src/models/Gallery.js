import mongoose from "mongoose";
import { MEDIA_TYPE } from "@sppl/shared/constants/tournament.js";

/**
 * Gallery items are references to Cloudinary assets. `publicId` is stored so the
 * asset can be removed from Cloudinary when the gallery entry is deleted.
 */
const gallerySchema = new mongoose.Schema(
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
      enum: Object.values(MEDIA_TYPE),
      default: MEDIA_TYPE.PHOTO,
    },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, trim: true, default: "" },
    captionBn: { type: String, trim: true, maxlength: 300, default: "" },
    captionEn: { type: String, trim: true, maxlength: 300, default: "" },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
    capturedAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    uploadedBy: {
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

gallerySchema.index({ seasonId: 1, order: 1, createdAt: -1 });
gallerySchema.index({ matchId: 1 });

export const Gallery =
  mongoose.models.Gallery ?? mongoose.model("Gallery", gallerySchema);
export default Gallery;

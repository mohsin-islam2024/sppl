import mongoose from "mongoose";

/**
 * A video entry. The site never re-hosts footage — it embeds an existing YouTube /
 * Facebook link, or plays a Cloudinary video. `provider` tells the frontend which
 * embed to render.
 */
const videoSchema = new mongoose.Schema(
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
    titleBn: { type: String, required: true, trim: true, maxlength: 200 },
    titleEn: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true, trim: true },
    /** Extracted from the URL so the player can be embedded without parsing client-side. */
    embedId: { type: String, trim: true, default: "" },
    provider: {
      type: String,
      enum: ["YOUTUBE", "FACEBOOK", "CLOUDINARY", "OTHER"],
      default: "YOUTUBE",
    },
    thumbnailUrl: { type: String, trim: true, default: "" },
    duration: { type: Number, default: null },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null, index: true },
    views: { type: Number, default: 0, min: 0 },
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

videoSchema.index({ seasonId: 1, published: 1, publishedAt: -1 });

export const Video =
  mongoose.models.Video ?? mongoose.model("Video", videoSchema);
export default Video;

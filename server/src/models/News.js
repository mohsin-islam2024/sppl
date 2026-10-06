import mongoose from "mongoose";

const newsSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    slug: { type: String, required: true, lowercase: true, trim: true },
    titleBn: { type: String, required: true, trim: true, maxlength: 200 },
    titleEn: { type: String, required: true, trim: true, maxlength: 200 },
    excerptBn: { type: String, trim: true, maxlength: 500, default: "" },
    excerptEn: { type: String, trim: true, maxlength: 500, default: "" },
    bodyBn: { type: String, required: true, maxlength: 20000 },
    bodyEn: { type: String, required: true, maxlength: 20000 },
    coverUrl: { type: String, trim: true, default: "" },
    coverPublicId: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null, index: true },
    views: { type: Number, default: 0, min: 0 },
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

newsSchema.index({ seasonId: 1, slug: 1 }, { unique: true });
newsSchema.index({ published: 1, publishedAt: -1 });
newsSchema.index({ titleBn: "text", titleEn: "text", tags: "text" });

export const News = mongoose.models.News ?? mongoose.model("News", newsSchema);
export default News;

import mongoose from "mongoose";
import { SPONSOR_TIER } from "@sppl/shared/constants/tournament.js";

const sponsorSchema = new mongoose.Schema(
  {
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    logoUrl: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    tier: {
      type: String,
      enum: Object.values(SPONSOR_TIER),
      default: SPONSOR_TIER.PARTNER,
      index: true,
    },
    website: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    address: { type: String, trim: true, maxlength: 300, default: "" },
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

sponsorSchema.index({ seasonId: 1, tier: 1, order: 1 });

export const Sponsor =
  mongoose.models.Sponsor ?? mongoose.model("Sponsor", sponsorSchema);
export default Sponsor;

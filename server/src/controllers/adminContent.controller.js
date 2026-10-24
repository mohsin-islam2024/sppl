import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, slugifyUnique } from "../utils/helpers.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { resolveSeason } from "../services/seasonService.js";
import { destroyAsset } from "../config/cloudinary.js";
import { Season } from "../models/Season.js";
import { Media } from "../models/Media.js";
import { News } from "../models/News.js";
import { Gallery } from "../models/Gallery.js";
import { Sponsor } from "../models/Sponsor.js";
import { Award } from "../models/Award.js";
import { Announcement } from "../models/Announcement.js";
import { Video } from "../models/Video.js";
import { parseVideoUrl } from "../utils/video.js";

/**
 * Admin content manager: news, gallery, sponsors, awards, announcements.
 *
 * All five follow the same four operations, so they are built by one factory
 * instead of five copies that drift apart. What differs per resource is declared in
 * the config at the bottom: sort order, how a new document is prepared, and which
 * Cloudinary assets a document owns.
 *
 * Authorisation is not checked here: these handlers are mounted behind
 * `requireAuth` + `requireRole(ADMIN, SUPER_ADMIN)` in admin.routes.js.
 */

/* ------------------------------------------------------------------ *
 * Cloudinary asset bookkeeping
 * ------------------------------------------------------------------ */

const THUMBNAIL = "c_fill,w_400,h_400,q_auto,f_auto";

/** A 400px square derived from a Cloudinary image URL; "" for anything else. */
function thumbnailFrom(url) {
  if (typeof url !== "string") return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return "";
  }
  return url.replace("/image/upload/", `/image/upload/${THUMBNAIL}/`);
}

/**
 * Record that a document owns an asset. Best effort: the Media table exists so a
 * deleted document can clean up Cloudinary, and a bookkeeping failure must never
 * turn a successful save into an error.
 */
async function trackAsset(asset, ownerType, ownerId, userId) {
  if (!asset?.publicId) return;
  try {
    await Media.findOneAndUpdate(
      { publicId: asset.publicId },
      {
        $set: {
          publicId: asset.publicId,
          url: asset.url || asset.publicId,
          secureUrl: asset.url || "",
          resourceType: asset.resourceType ?? "image",
          folder: asset.folder ?? "",
          ownerType,
          ownerId,
          uploadedBy: userId ?? null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    logger.warn(`[media] could not track ${asset.publicId}: ${error.message}`);
  }
}

/** Remove an asset from Cloudinary and from the Media table. Never throws. */
async function releaseAsset(asset) {
  if (!asset?.publicId) return;
  await destroyAsset(asset.publicId, asset.resourceType ?? "image");
  try {
    await Media.deleteOne({ publicId: asset.publicId });
  } catch (error) {
    logger.warn(`[media] could not untrack ${asset.publicId}: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * The factory
 * ------------------------------------------------------------------ */

/**
 * @param {object} config
 * @param {import('mongoose').Model} config.Model
 * @param {string} config.ownerType     Media.ownerType value
 * @param {object} config.sort          sort for the admin list
 * @param {Array}  [config.populate]    populate arguments for the admin list
 * @param {(body:object, req:object) => object} [config.prepareCreate]
 * @param {(body:object, doc:object) => object} [config.prepareUpdate]
 * @param {(doc:object) => Array} [config.assets]   assets this document owns
 */
function buildCrud({
  Model,
  ownerType,
  sort,
  populate = [],
  prepareCreate = (body) => body,
  prepareUpdate = (body) => body,
  assets = () => [],
}) {
  /** GET /api/v1/admin/<resource>?season= — everything, including unpublished. */
  const list = asyncHandler(async (req, res) => {
    const season = await resolveSeason(req.query.season);
    if (!season) throw ApiError.badRequest("A season is required");

    let query = Model.find({ seasonId: season._id }).sort(sort);
    for (const args of populate) query = query.populate(...args);

    res.status(200).json(ok(await query.lean()));
  });

  /** POST /api/v1/admin/<resource> */
  const create = asyncHandler(async (req, res) => {
    const season = await Season.findById(req.body.seasonId).select("_id").lean();
    if (!season) throw ApiError.badRequest("Season not found");

    const doc = await Model.create(prepareCreate(req.body, req));

    for (const asset of assets(doc)) {
      await trackAsset(asset, ownerType, doc._id, req.user?._id);
    }

    res.status(201).json(ok(doc, "Created"));
  });

  /** PATCH /api/v1/admin/<resource>/:id */
  const update = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound("Record not found");

    const before = assets(doc);
    doc.set(prepareUpdate(req.body, doc));
    await doc.save();
    const after = assets(doc);

    // An image that was replaced is no longer referenced anywhere: remove it so the
    // Cloudinary account does not fill up with orphans.
    for (const old of before) {
      if (!after.some((asset) => asset.publicId === old.publicId)) {
        await releaseAsset(old);
      }
    }
    for (const asset of after) {
      await trackAsset(asset, ownerType, doc._id, req.user?._id);
    }

    res.status(200).json(ok(doc, "Updated"));
  });

  /** DELETE /api/v1/admin/<resource>/:id */
  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound("Record not found");

    const owned = assets(doc);
    await doc.deleteOne();
    for (const asset of owned) await releaseAsset(asset);

    res.status(200).json(ok({ id: req.params.id }, "Deleted"));
  });

  return { list, create, update, remove };
}

/* ------------------------------------------------------------------ *
 * Resources
 * ------------------------------------------------------------------ */

export const news = buildCrud({
  Model: News,
  ownerType: "News",
  sort: { createdAt: -1 },
  prepareCreate: (body, req) => ({
    ...body,
    // The English title is the slug source: Bangla slugs are legal but unreadable
    // when pasted into a chat, and the schema only allows a-z for admin-typed ones.
    slug: body.slug || slugifyUnique(body.titleEn),
    publishedAt: body.published ? (body.publishedAt ?? new Date()) : null,
    authorId: req.user?._id ?? null,
  }),
  prepareUpdate: (body, doc) => {
    // Publishing for the first time stamps the date; unpublishing keeps it.
    if (body.published === true && !doc.publishedAt && !body.publishedAt) {
      return { ...body, publishedAt: new Date() };
    }
    return body;
  },
  assets: (doc) =>
    doc.coverPublicId
      ? [
          {
            publicId: doc.coverPublicId,
            url: doc.coverUrl,
            folder: "sppl/news",
          },
        ]
      : [],
});

export const gallery = buildCrud({
  Model: Gallery,
  ownerType: "Gallery",
  sort: { order: 1, createdAt: -1 },
  prepareCreate: (body, req) => ({
    ...body,
    thumbnailUrl: body.thumbnailUrl || thumbnailFrom(body.url),
    uploadedBy: req.user?._id ?? null,
  }),
  assets: (doc) => [
    {
      publicId: doc.publicId,
      url: doc.url,
      resourceType: doc.type === "VIDEO" ? "video" : "image",
      folder: "sppl/gallery",
    },
  ],
});

export const sponsors = buildCrud({
  Model: Sponsor,
  ownerType: "Sponsor",
  sort: { tier: 1, order: 1, name: 1 },
  assets: (doc) =>
    doc.publicId
      ? [{ publicId: doc.publicId, url: doc.logoUrl, folder: "sppl/sponsors" }]
      : [],
});

export const awards = buildCrud({
  Model: Award,
  ownerType: "Award",
  sort: { createdAt: -1 },
  populate: [
    ["winnerPlayerId", "fullName jerseyName jerseyNo"],
    ["winnerTeamId", "name shortName"],
  ],
});

export const announcements = buildCrud({
  Model: Announcement,
  ownerType: "Announcement",
  sort: { createdAt: -1 },
  prepareCreate: (body, req) => ({ ...body, authorId: req.user?._id ?? null }),
});

export const videos = buildCrud({
  Model: Video,
  ownerType: "Video",
  sort: { order: 1, createdAt: -1 },
  prepareCreate: (body) => {
    const parsed = parseVideoUrl(body.url);
    return {
      ...body,
      provider: parsed.provider,
      embedId: parsed.embedId,
      // An admin-typed thumbnail wins; otherwise YouTube's own still is used.
      thumbnailUrl: body.thumbnailUrl || parsed.thumbnailUrl,
      publishedAt: body.published ? (body.publishedAt ?? new Date()) : null,
    };
  },
  prepareUpdate: (body, doc) => {
    const next = { ...body };

    // A changed link means a different video: re-derive everything that came from it.
    if (body.url && body.url !== doc.url) {
      const parsed = parseVideoUrl(body.url);
      next.provider = parsed.provider;
      next.embedId = parsed.embedId;
      if (!body.thumbnailUrl) next.thumbnailUrl = parsed.thumbnailUrl;
    } else {
      delete next.provider;
    }

    if (body.published === true && !doc.publishedAt && !body.publishedAt) {
      next.publishedAt = new Date();
    }
    return next;
  },
});

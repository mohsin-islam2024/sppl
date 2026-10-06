import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import {
  signUpload,
  destroyAsset,
  buildUrl,
  UPLOAD_FOLDERS,
} from "../config/cloudinary.js";
import { Media } from "../models/Media.js";
import ApiError from "../utils/ApiError.js";

/**
 * Signed-upload endpoints.
 *
 * The flow has three steps and this controller owns the first and third:
 *
 *   1. The browser asks for a signature  ← this controller
 *   2. The browser uploads the file straight to Cloudinary
 *   3. The browser reports the resulting public id back  ← this controller
 *
 * Step 3 is what registers the asset in the Media collection. Without it the site
 * would own Cloudinary files it has no record of, and deleting a gallery item would
 * leave its photo orphaned in Cloudinary forever.
 */

const MAX_FOLDERS = Object.keys(UPLOAD_FOLDERS);

/**
 * POST /api/v1/upload/sign
 *
 * Body: { folder, resourceType? }
 *
 * Returns everything the browser needs to POST the file directly to Cloudinary. The
 * signature is time-limited and folder-locked, so a leaked signature cannot be
 * reused later or pointed somewhere else.
 */
export const getSignature = asyncHandler(async (req, res) => {
  const { folder, resourceType = "image" } = req.body;

  if (!MAX_FOLDERS.includes(folder)) {
    throw ApiError.badRequest(
      `Unknown folder "${folder}". Allowed: ${MAX_FOLDERS.join(", ")}`,
    );
  }

  const signed = signUpload({ folder: UPLOAD_FOLDERS[folder] });

  // Credentials missing is a deployment problem, not a client one — 503 says
  // "this feature is unavailable" rather than "your request was wrong".
  if (!signed) {
    throw new ApiError(503, "Media uploads are not configured on this server");
  }

  res.status(200).json(
    ok({
      ...signed,
      resourceType,
      // Eager transformation so the thumbnail already exists when the gallery needs
      // it, instead of being generated on the first visitor's request.
      eager: "c_fill,w_400,h_400,q_auto,f_auto",
    }),
  );
});

/**
 * POST /api/v1/upload/register
 *
 * Body: { publicId, url, secureUrl, resourceType, format, bytes, width, height, duration, ownerType, ownerId, folder }
 *
 * Records an asset that the browser has already uploaded. Called immediately after
 * the Cloudinary upload succeeds, so the Media table always reflects reality.
 */
export const registerAsset = asyncHandler(async (req, res) => {
  const {
    publicId,
    url,
    secureUrl,
    resourceType = "image",
    format,
    bytes,
    width,
    height,
    duration,
    ownerType,
    ownerId,
    folder,
  } = req.body;

  if (!publicId) throw ApiError.badRequest("publicId is required");

  // Upsert rather than insert: an admin who re-uploads into the same slot would
  // otherwise hit a duplicate-key error on the unique index.
  const asset = await Media.findOneAndUpdate(
    { publicId },
    {
      $set: {
        publicId,
        url: url ?? secureUrl ?? "",
        secureUrl: secureUrl ?? url ?? "",
        resourceType,
        format: format ?? "",
        bytes: bytes ?? 0,
        width: width ?? null,
        height: height ?? null,
        duration: duration ?? null,
        folder: folder ?? "",
        ownerType: ownerType ?? "Gallery",
        ownerId: ownerId ?? null,
        uploadedBy: req.user?._id ?? null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );

  res.status(201).json(
    ok(
      {
        id: asset._id,
        publicId: asset.publicId,
        url: asset.secureUrl || asset.url,
        thumbnailUrl: buildUrl(asset.publicId, { width: 400, height: 400 }),
      },
      "Asset registered",
    ),
  );
});

/**
 * DELETE /api/v1/upload/:publicId
 *
 * Removes the asset from Cloudinary and from the Media table. The public id is
 * URL-encoded by the client (`sppl%2Fgallery%2Fabc123`), because Cloudinary ids
 * contain slashes.
 *
 * This is an admin-only route — it is mounted behind `requireRole(ADMIN)`.
 */
export const deleteAsset = asyncHandler(async (req, res) => {
  const publicId = decodeURIComponent(req.params.publicId);

  if (!publicId) throw ApiError.badRequest("A public id is required");

  const record = await Media.findOne({ publicId }).lean();
  const result = await destroyAsset(publicId, record?.resourceType ?? "image");

  await Media.deleteOne({ publicId });

  res.status(200).json(
    ok(
      {
        publicId,
        cloudinaryDeleted: result.deleted,
        // A false here means the asset is gone from our records but still exists in
        // Cloudinary. Reported rather than hidden, so an admin can clean it up by
        // hand if it ever happens.
        note: result.deleted
          ? undefined
          : "The Cloudinary asset could not be removed",
      },
      "Asset deleted",
    ),
  );
});

/**
 * GET /api/v1/upload/folders
 *
 * The folder list the admin form uses to populate its upload target selector. Read
 * from the config rather than duplicated in the client, so adding a folder is a
 * one-line change.
 */
export const listFolders = asyncHandler(async (_req, res) => {
  res.status(200).json(ok(MAX_FOLDERS));
});

export default { getSignature, registerAsset, deleteAsset, listFolders };

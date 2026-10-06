import { v2 as cloudinary } from "cloudinary";
import env from "./env.js";
import logger from "../utils/logger.js";

/**
 * Cloudinary configuration.
 *
 * Only configured when all three credentials are present. The rest of the server
 * boots happily without them — media upload is a feature, not a startup dependency,
 * and a broken Cloudinary key should not stop the scorer from recording a match.
 *
 * `hasCloudinary` is what the upload route checks before accepting a request, so a
 * misconfigured deployment gets a clear 503 rather than a stack trace.
 */
let configured = false;

export function initCloudinary() {
  if (configured) return cloudinary;

  if (!env.hasCloudinary) {
    logger.warn("[cloudinary] credentials missing — uploads are disabled");
    return null;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
  logger.info("[cloudinary] configured");
  return cloudinary;
}

/**
 * Where each kind of asset lives in Cloudinary.
 *
 * Uploads are prefixed with the environment so a staging deployment cannot overwrite
 * production media. The folder name is validated against this list in the route, so
 * an attacker cannot steer an upload outside the site's own tree.
 */
export const UPLOAD_FOLDERS = Object.freeze({
  logos: "sppl/logos",
  players: "sppl/players",
  gallery: "sppl/gallery",
  sponsors: "sppl/sponsors",
  seasons: "sppl/seasons",
});

/**
 * Build a signature for a direct browser upload.
 *
 * The browser uploads straight to Cloudinary — the image never passes through
 * Render, which matters because the free instance has limited memory and a 20 MB
 * photograph would be wasteful to proxy. The server's only job is to sign the
 * request so Cloudinary knows the upload was authorised.
 *
 * The signature covers the parameters as a sorted, `&`-joined string followed by the
 * API secret. Changing any signed parameter after the fact invalidates it, which is
 * what stops a signed "logos" upload being redirected into someone else's folder.
 *
 * @param {object} params
 * @param {string} params.folder     a key of UPLOAD_FOLDERS
 * @param {string} [params.publicId]
 * @returns {{ signature: string, timestamp: number, apiKey: string, cloudName: string, folder: string, eager?: string }}
 */
export function signUpload({ folder, publicId }) {
  const instance = initCloudinary();
  if (!instance) return null;

  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign = {
    folder,
    timestamp,
    ...(publicId ? { public_id: publicId } : {}),
  };

  const signature = instance.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET,
  );

  return {
    signature,
    timestamp,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    folder,
    // The upload URL the browser should POST to. `auto` accepts images and video
    // without the client having to declare which it is sending.
    uploadUrl: `[api.cloudinary.com](https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload)`,
  };
}

/**
 * Delete an asset by its public id.
 *
 * Called when a gallery photo or sponsor logo is removed, so the asset does not sit
 * in Cloudinary forever costing storage. Failure is logged rather than thrown: the
 * database record is already gone, and a failed cleanup should not present itself to
 * an admin as a failed delete.
 *
 * @param {string} publicId
 * @param {'image'|'video'} [resourceType]
 */
export async function destroyAsset(publicId, resourceType = "image") {
  const instance = initCloudinary();
  if (!instance || !publicId) return { deleted: false };

  try {
    const result = await instance.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    logger.info(`[cloudinary] deleted ${publicId} (${result.result})`);
    return { deleted: result.result === "ok", result: result.result };
  } catch (error) {
    logger.warn(`[cloudinary] could not delete ${publicId}: ${error.message}`);
    return { deleted: false, error: error.message };
  }
}

/**
 * Build a transformed URL — resized, cropped, format-optimised.
 *
 * Used for thumbnails where the original is several megabytes and the grid shows
 * images 200px wide. Cloudinary does the resizing at the edge, so the browser never
 * downloads the full file.
 *
 * @param {string} publicId
 * @param {{ width?: number, height?: number, crop?: string, quality?: string|number }} [options]
 */
export function buildUrl(
  publicId,
  { width, height, crop = "fill", quality = "auto" } = {},
) {
  const instance = initCloudinary();
  if (!instance || !publicId) return "";

  return instance.url(publicId, {
    transformation: [
      {
        width,
        height,
        crop,
        quality,
        fetch_format: "auto",
      },
    ],
    secure: true,
  });
}

export { cloudinary };
export default initCloudinary;

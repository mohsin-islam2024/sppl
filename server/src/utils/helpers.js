import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

/**
 * Generate a URL-safe slug from Bangla or English text.
 *
 * Bangla is left intact (it is perfectly valid in a URL once encoded), while every
 * run of whitespace, punctuation or other separators becomes a single dash.
 */
export function slugify(input = "") {
  return String(input)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug that is safe to store when two documents would otherwise collide.
 */
export function slugifyUnique(input = "") {
  const base = slugify(input) || "item";
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

/** Absolute path of the server directory, for logging and static files. */
const here = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(here, "../..");

/**
 * Turn a Mongoose document or lean object into a plain, response-ready object.
 */
export function toPlain(value) {
  if (!value) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value.toJSON === "function") return value.toJSON();
  return value;
}

/**
 * Standard list response envelope. Keeping this in one place means every list
 * endpoint in the API looks the same to the frontend.
 */
export function paginated({ items, total, page, limit }) {
  return {
    success: true,
    data: items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

/** Success envelope for a single resource or an action result. */
export function ok(data, message = undefined) {
  return {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
}

/**
 * Read a value from a query object that may arrive as a string, an array or a
 * comma-separated list (Express query parsing is not consistent across clients).
 */
export function toArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(toArray);
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

import { z } from "zod";
import { ROLES } from "../constants/roles.js";
import {
  MATCH_STAGE,
  MATCH_STATUS,
  EXTRA_TYPE,
  WICKET_TYPE,
  TOSS_DECISION,
} from "../constants/matchStatus.js";
import {
  BATTING_STYLE,
  BOWLING_STYLE,
  PLAYER_ROLE,
  SEASON_STATUS,
  SPONSOR_TIER,
  ANNOUNCEMENT_PRIORITY,
  MEDIA_TYPE,
} from "../constants/tournament.js";

/* ------------------------------------------------------------------ *
 * Shared primitives
 * ------------------------------------------------------------------ */

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const slug = z
  .string()
  .min(2)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Lowercase letters, numbers and dashes only",
  );

const requiredText = (max = 300) => z.string().trim().min(1).max(max);
const optionalText = (max = 5000) => z.string().trim().max(max).optional();

const bilingual = {
  bn: requiredText(200),
  en: requiredText(200),
};

/** Sizes that are not adult shirt sizes (kids get their own sizing chart). */
export const jerseySize = z.union([
  z.enum(["S", "M", "L", "XL", "XXL", "XXXL"]),
  z.string().regex(/^\d{1,2}y$/, 'Kids size must look like "8y"'),
]);

/**
 * An image reference that may be a full Cloudinary URL or a path inside the app's
 * own public folder (`/logos/agni-riders.png`).
 *
 * `z.string().url()` rejects the second form, and the second form is exactly what
 * the organizer uses for the crests that ship with the site — so a plain `.url()`
 * made it impossible to save a team with the provided logos.
 */
const imageRef = (message = "Must be a full URL or a path starting with /") =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || value.startsWith("/") || /^https?:\/\//i.test(value),
      message,
    );

/**
 * A numeric field that arrives from an HTML form.
 *
 * Form inputs always send strings, and an untouched number input sends an empty
 * string. `z.coerce.number()` converts the former and turns the latter into NaN,
 * so `.catch()` supplies the fallback the API should store in that case.
 */
const formNumber = ({ min, max, fallback, message } = {}) => {
  let schema = z.coerce.number();
  if (typeof min === "number") schema = schema.min(min, message);
  if (typeof max === "number") schema = schema.max(max, message);
  schema = schema.int();
  return typeof fallback === "number" ? schema.catch(fallback) : schema;
};

/* ------------------------------------------------------------------ *
 * Auth / User
 * ------------------------------------------------------------------ */

export const syncUserSchema = z.object({
  name: requiredText(120).optional(),
  photoUrl: z.string().url().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(Object.values(ROLES).filter((r) => r !== ROLES.GUEST)),
});

export const updateProfileSchema = z.object({
  name: requiredText(120).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9\-\s]{6,20}$/, "Invalid phone number")
    .optional(),
  playerId: objectId.optional(),
  teamId: objectId.optional(),
});

/* ------------------------------------------------------------------ *
 * Season
 * ------------------------------------------------------------------ */

export const createSeasonSchema = z.object({
  seasonNo: formNumber({
    min: 1,
    max: 999,
    fallback: 1,
    message: "Must be at least 1",
  }),
  year: formNumber({ min: 2000, max: 2100, fallback: 2027 }),
  nameBn: requiredText(200),
  nameEn: requiredText(200),
  shortName: requiredText(30).default("SPPL"),
  slug: slug.optional(),
  status: z.enum(Object.values(SEASON_STATUS)).default(SEASON_STATUS.UPCOMING),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  venue: optionalText(200),
  logoUrl: imageRef().optional(),
  bannerUrl: imageRef().optional(),
  pointsSystem: z
    .object({
      win: formNumber({ min: 0, fallback: 2 }),
      loss: formNumber({ min: 0, fallback: 0 }),
      tieOrNoResult: formNumber({ min: 0, fallback: 1 }),
      superOverTieSplit: formNumber({ min: 0, fallback: 1 }),
    })
    .optional(),
  matchRules: z
    .object({
      oversPerInnings: formNumber({ min: 1, max: 50, fallback: 10 }),
      playersPerSide: formNumber({ min: 2, max: 11, fallback: 9 }),
      ballsPerOver: formNumber({ min: 1, max: 10, fallback: 6 }),
      wideRuns: formNumber({ min: 0, max: 5, fallback: 1 }),
      noBallRuns: formNumber({ min: 0, max: 5, fallback: 1 }),
      byeRuns: z.boolean().catch(true),
      legByeRuns: z.boolean().catch(true),
      superOverOnTie: z.boolean().catch(true),
      sharePointsIfSuperOverTied: z.boolean().catch(true),
    })
    .optional(),
});

export const updateSeasonSchema = createSeasonSchema.partial();

/* ------------------------------------------------------------------ *
 * Team
 * ------------------------------------------------------------------ */

export const createTeamSchema = z.object({
  seasonId: objectId,
  name: requiredText(80),
  shortName: requiredText(8),
  slug: slug,
  logoUrl: imageRef().optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Hex colour like #e63946")
    .optional(),
  captainPlayerId: objectId.optional(),
  viceCaptainPlayerId: objectId.optional(),
  order: formNumber({ min: 0, max: 99, fallback: 0 }).optional(),
  active: z.boolean().catch(true),
});

export const updateTeamSchema = createTeamSchema
  .partial()
  .omit({ seasonId: true });

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */

export const createPlayerSchema = z.object({
  seasonId: objectId,
  teamId: objectId,
  fullName: requiredText(120),
  jerseyName: requiredText(20),
  jerseyNo: formNumber({ min: 0, max: 999, fallback: 0 }),
  size: jerseySize,
  isKidsSize: z.boolean().optional(),
  role: z.enum(Object.values(PLAYER_ROLE)).default(PLAYER_ROLE.BATTER),
  battingStyle: z.enum(Object.values(BATTING_STYLE)).optional(),
  bowlingStyle: z.enum(Object.values(BOWLING_STYLE)).optional(),
  dateOfBirth: z.coerce.date().optional(),
  ageYears: formNumber({ min: 0, max: 99 }).optional(),
  photoUrl: imageRef().optional(),
  isCaptain: z.boolean().catch(false),
  isViceCaptain: z.boolean().catch(false),
  jerseyConfirmed: z.boolean().catch(false),
  order: formNumber({ min: 0, max: 99, fallback: 0 }).optional(),
  active: z.boolean().catch(true),
});

export const updatePlayerSchema = createPlayerSchema
  .partial()
  .omit({ seasonId: true, teamId: true });

/* ------------------------------------------------------------------ *
 * Match
 * ------------------------------------------------------------------ */

export const createMatchSchema = z.object({
  seasonId: objectId,
  matchNo: formNumber({ min: 1, fallback: 1 }),
  stage: z.enum(Object.values(MATCH_STAGE)).default(MATCH_STAGE.LEAGUE),
  teamAId: objectId,
  teamBId: objectId,
  venue: optionalText(200),
  startAt: z.coerce.date(),
  streamUrl: z.string().url().optional().or(z.literal("")),
  umpireIds: z.array(objectId).max(4).optional(),
  scorerId: objectId.optional(),
  status: z.enum(Object.values(MATCH_STATUS)).default(MATCH_STATUS.UPCOMING),
});

export const updateMatchSchema = createMatchSchema
  .partial()
  .omit({ seasonId: true });

export const tossSchema = z.object({
  winnerTeamId: objectId,
  decision: z.enum(Object.values(TOSS_DECISION)),
});

export const completeMatchSchema = z.object({
  resultType: z.enum(["WIN", "TIE", "NO_RESULT", "SUPER_OVER_WIN"]),
  winnerTeamId: objectId.optional(),
  margin: optionalText(120),
  motmPlayerId: objectId.optional(),
});

/* ------------------------------------------------------------------ *
 * Ball (ball-by-ball scoring input)
 * ------------------------------------------------------------------ */

export const recordBallSchema = z
  .object({
    matchId: objectId,
    innings: z.union([z.literal(0), z.literal(1)]),
    batterId: objectId,
    nonStrikerId: objectId,
    bowlerId: objectId,
    /** Runs scored off the bat, 0-6. */
    runsBat: formNumber({ min: 0, max: 6, fallback: 0 }),
    /** Number of byes / leg byes actually run (set with extraType). */
    runsBye: formNumber({ min: 0, max: 6, fallback: 0 }),
    extraType: z.enum(Object.values(EXTRA_TYPE)).nullable().default(null),
    isWicket: z.boolean().default(false),
    wicketType: z.enum(Object.values(WICKET_TYPE)).nullable().default(null),
    dismissedPlayerId: objectId.nullable().default(null),
    fielderId: objectId.nullable().default(null),
    /** Optional free-text commentary; otherwise generated from the delivery. */
    commentaryBn: optionalText(300),
    commentaryEn: optionalText(300),
  })
  .refine((b) => !b.isWicket || b.wicketType !== null, {
    message: "wicketType is required when isWicket is true",
    path: ["wicketType"],
  })
  .refine((b) => !b.isWicket || b.dismissedPlayerId !== null, {
    message: "dismissedPlayerId is required when isWicket is true",
    path: ["dismissedPlayerId"],
  })
  .refine((b) => b.batterId !== b.nonStrikerId, {
    message: "Batter and non-striker must differ",
    path: ["nonStrikerId"],
  })
  .refine(
    (b) =>
      ![EXTRA_TYPE.BYE, EXTRA_TYPE.LEG_BYE].includes(b.extraType) ||
      b.runsBye > 0,
    {
      message: "Byes require run(s) to be recorded",
      path: ["runsBye"],
    },
  )
  .refine((b) => !(b.extraType && b.runsBat > 0), {
    message: "A wide cannot also carry runs off the bat",
    path: ["runsBat"],
  });

export const undoBallSchema = z.object({
  matchId: objectId,
});

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

export const createNewsSchema = z.object({
  seasonId: objectId,
  slug,
  titleBn: bilingual.bn,
  titleEn: bilingual.en,
  excerptBn: optionalText(500),
  excerptEn: optionalText(500),
  bodyBn: requiredText(20000),
  bodyEn: requiredText(20000),
  coverUrl: imageRef().optional(),
  tags: z.array(requiredText(40)).max(10).default([]),
  publishedAt: z.coerce.date().optional(),
  published: z.boolean().default(false),
});

export const updateNewsSchema = createNewsSchema
  .partial()
  .omit({ seasonId: true });

export const createGallerySchema = z.object({
  seasonId: objectId,
  matchId: objectId.optional(),
  type: z.enum(Object.values(MEDIA_TYPE)).default(MEDIA_TYPE.PHOTO),
  url: z.string().url(),
  publicId: requiredText(200),
  captionBn: optionalText(300),
  captionEn: optionalText(300),
  capturedAt: z.coerce.date().optional(),
  order: formNumber({ min: 0, fallback: 0 }).optional(),
});

export const createVideoSchema = z.object({
  seasonId: objectId,
  titleBn: requiredText(200),
  titleEn: requiredText(200),
  url: z.string().url(),
  provider: z
    .enum(["YOUTUBE", "FACEBOOK", "CLOUDINARY", "OTHER"])
    .default("YOUTUBE"),
  matchId: objectId.optional(),
  publishedAt: z.coerce.date().optional(),
});

export const createSponsorSchema = z.object({
  seasonId: objectId,
  name: requiredText(120),
  logoUrl: imageRef(),
  publicId: requiredText(200).optional(),
  tier: z.enum(Object.values(SPONSOR_TIER)).default(SPONSOR_TIER.PARTNER),
  website: z.string().url().optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\+?[0-9\-\s]{6,20}$/)
    .optional(),
  order: formNumber({ min: 0, fallback: 0 }).optional(),
  active: z.boolean().catch(true),
});

export const createAwardSchema = z.object({
  seasonId: objectId,
  type: z.enum([
    "CHAMPION",
    "RUNNER_UP",
    "MAN_OF_THE_MATCH",
    "MAN_OF_THE_TOURNAMENT",
    "BEST_BATTER",
    "BEST_BOWLER",
    "BEST_FIELDER",
    "PARTICIPATION_MEDAL",
  ]),
  matchId: objectId.optional(),
  winnerPlayerId: objectId.optional(),
  winnerTeamId: objectId.optional(),
  noteBn: optionalText(300),
  noteEn: optionalText(300),
});

export const createAnnouncementSchema = z.object({
  seasonId: objectId,
  titleBn: requiredText(200),
  titleEn: requiredText(200),
  bodyBn: requiredText(5000),
  bodyEn: requiredText(5000),
  priority: z
    .enum(Object.values(ANNOUNCEMENT_PRIORITY))
    .default(ANNOUNCEMENT_PRIORITY.NORMAL),
  active: z.boolean().catch(true),
  expiresAt: z.coerce.date().optional(),
});

/* ------------------------------------------------------------------ *
 * Uploads (Cloudinary signed upload)
 * ------------------------------------------------------------------ */

export const signUploadSchema = z.object({
  folder: z.enum([
    "logos",
    "players",
    "gallery",
    "sponsors",
    "news",
    "seasons",
  ]),
  resourceType: z.enum(["image", "video"]).default("image"),
});

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

export const paginationSchema = z.object({
  page: formNumber({ min: 1, fallback: 1 }),
  limit: formNumber({ min: 1, max: 100, fallback: 20 }),
});

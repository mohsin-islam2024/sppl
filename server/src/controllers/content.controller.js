import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, paginated } from "../utils/helpers.js";
import { News } from "../models/News.js";
import { Gallery } from "../models/Gallery.js";
import { Video } from "../models/Video.js";
import { Sponsor } from "../models/Sponsor.js";
import { Award } from "../models/Award.js";
import { Announcement } from "../models/Announcement.js";
import { PlayerStat } from "../models/PlayerStat.js";
import { Player } from "../models/Player.js";
import { resolveSeason } from "../services/seasonService.js";
import ApiError from "../utils/ApiError.js";

/**
 * Public content reads: news, gallery, videos, sponsors, awards, announcements and
 * the season's leaderboards.
 *
 * All of them are season-scoped but none of them 404 on a missing season — they
 * return an empty list instead. A new season with no photographs yet is a normal
 * state, and a 404 would make every gallery widget log an error for weeks.
 */

/* ------------------------------------------------------------------ *
 * News
 * ------------------------------------------------------------------ */

/** GET /api/v1/news */
export const listNews = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = { published: true };
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;

  const [items, total] = await Promise.all([
    News.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // The list does not need the article body; sending it would multiply the
      // payload by roughly twenty for text nobody reads until they open the article.
      .select("title slug excerpt coverImageUrl publishedAt")
      .lean(),
    News.countDocuments(filter),
  ]);

  res.status(200).json(paginated({ items, total, page, limit }));
});

/** GET /api/v1/news/:slug */
export const getNews = asyncHandler(async (req, res) => {
  const item = await News.findOne({
    slug: req.params.slug,
    published: true,
  }).lean();
  if (!item) throw ApiError.notFound("News item not found");

  res.status(200).json(ok(item));
});

/* ------------------------------------------------------------------ *
 * Gallery
 * ------------------------------------------------------------------ */

/** GET /api/v1/gallery */
export const listGallery = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = { published: true };
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;

  const [items, total] = await Promise.all([
    Gallery.find(filter)
      .sort({ takenAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Gallery.countDocuments(filter),
  ]);

  res.status(200).json(paginated({ items, total, page, limit }));
});

/** GET /api/v1/videos */
export const listVideos = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = { published: true };
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;

  const [items, total] = await Promise.all([
    Video.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Video.countDocuments(filter),
  ]);

  res.status(200).json(paginated({ items, total, page, limit }));
});

/* ------------------------------------------------------------------ *
 * Sponsors
 * ------------------------------------------------------------------ */

/** GET /api/v1/sponsors */
export const listSponsors = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);

  const filter = { active: true };
  if (season) filter.seasonId = season._id;

  const items = await Sponsor.find(filter)
    .sort({ tier: 1, order: 1, name: 1 })
    .lean();

  res.status(200).json(ok(items));
});

/* ------------------------------------------------------------------ *
 * Awards
 * ------------------------------------------------------------------ */

/** GET /api/v1/awards */
export const listAwards = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = {};
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;

  const [items, total] = await Promise.all([
    Award.find(filter)
      .sort({ awardedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("playerId", "fullName jerseyName jerseyNo photoUrl")
      .populate("teamId", "name shortName slug logoUrl themeColor")
      .lean(),
    Award.countDocuments(filter),
  ]);

  const shaped = items.map((award) => ({
    id: award._id,
    title: award.title,
    description: award.description,
    category: award.category,
    awardedAt: award.awardedAt,
    imageUrl: award.imageUrl ?? "",
    player: award.playerId
      ? {
          id: award.playerId._id,
          fullName: award.playerId.fullName,
          jerseyName: award.playerId.jerseyName,
          jerseyNo: award.playerId.jerseyNo,
          photoUrl: award.playerId.photoUrl ?? "",
        }
      : null,
    team: award.teamId
      ? {
          id: award.teamId._id,
          name: award.teamId.name,
          shortName: award.teamId.shortName,
          slug: award.teamId.slug,
          logoUrl: award.teamId.logoUrl ?? "",
          themeColor: award.teamId.themeColor ?? "",
        }
      : null,
  }));

  res.status(200).json(paginated({ items: shaped, total, page, limit }));
});

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

/** GET /api/v1/announcements */
export const listAnnouncements = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);

  const filter = {
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  if (season) filter.seasonId = season._id;

  const items = await Announcement.find(filter)
    .sort({ priority: -1, createdAt: -1 })
    .limit(20)
    .lean();

  res.status(200).json(ok(items));
});

/* ------------------------------------------------------------------ *
 * Season leaderboards
 * ------------------------------------------------------------------ */

/**
 * GET /api/v1/stats
 *
 * The season's leaderboards in one call: most runs, most wickets, best strike rate,
 * best economy and the fielding table. The stats page needs all of them at once, and
 * five requests would cost more than the payload on the connection this is read over.
 */
export const getSeasonStats = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.notFound("No season found");

  const base = { seasonId: season._id };
  const withTeam = (query) =>
    query.populate("teamId", "name shortName slug logoUrl themeColor").lean();

  const [runs, wickets, strikeRate, economy, fielding, awards] =
    await Promise.all([
      withTeam(
        PlayerStat.find({ ...base, runs: { $gt: 0 } })
          .sort({ runs: -1 })
          .limit(10),
      ),
      withTeam(
        PlayerStat.find({ ...base, wickets: { $gt: 0 } })
          .sort({ wickets: -1 })
          .limit(10),
      ),
      withTeam(
        PlayerStat.find({ ...base, ballsFaced: { $gte: 10 } })
          .sort({ runs: -1 })
          .limit(50),
      ),
      withTeam(
        PlayerStat.find({ ...base, ballsBowled: { $gte: 12 } })
          .sort({ wickets: -1 })
          .limit(50),
      ),
      withTeam(
        PlayerStat.find(base).sort({ catches: -1, runOuts: -1 }).limit(10),
      ),
      withTeam(
        PlayerStat.find({ ...base, playerOfMatchAwards: { $gt: 0 } })
          .sort({ playerOfMatchAwards: -1 })
          .limit(10),
      ),
    ]);

  // PlayerStat stores the id, not the name. The player's own document is where the
  // name, photo and jersey number live. Joined once here so the leaderboard can show
  // who a row is, rather than making the page fetch many names one at a time.
  const allRows = [
    ...runs,
    ...wickets,
    ...strikeRate,
    ...economy,
    ...fielding,
    ...awards,
  ];
  const playerIds = [
    ...new Set(allRows.map((row) => String(row.playerId)).filter(Boolean)),
  ];

  const players = await Player.find({ _id: { $in: playerIds } })
    .select("fullName jerseyName jerseyNo photoUrl")
    .lean();

  const playerById = new Map(
    players.map((player) => [String(player._id), player]),
  );

  // Strike rate and economy cannot be sorted in MongoDB without an aggregation over
  // computed fields, so the top candidates are fetched and ranked here. The limits
  // above bound that to 50 rows each, which is nothing.
  const byStrikeRate = strikeRate
    .map((row) => ({
      ...row,
      strikeRate: row.ballsFaced > 0 ? (row.runs / row.ballsFaced) * 100 : 0,
    }))
    .sort((a, b) => b.strikeRate - a.strikeRate)
    .slice(0, 10);

  const byEconomy = economy
    .map((row) => ({
      ...row,
      economy:
        row.ballsBowled > 0 ? row.runsConceded / (row.ballsBowled / 6) : 0,
    }))
    .sort((a, b) => a.economy - b.economy)
    .slice(0, 10);

  res.status(200).json(
    ok({
      seasonId: season._id,
      seasonSlug: season.slug,
      mostRuns: runs.map((row) => toLeaderboardRow(row, "runs", playerById)),
      mostWickets: wickets.map((row) =>
        toLeaderboardRow(row, "wickets", playerById),
      ),
      bestStrikeRate: byStrikeRate.map((row) =>
        toLeaderboardRow(row, "strikeRate", playerById),
      ),
      bestEconomy: byEconomy.map((row) =>
        toLeaderboardRow(row, "economy", playerById),
      ),
      bestFielding: fielding.map((row) =>
        toLeaderboardRow(row, "fielding", playerById),
      ),
      mostAwards: awards.map((row) =>
        toLeaderboardRow(row, "awards", playerById),
      ),
    }),
  );
});

/** Trim a stats document down to what a leaderboard table displays. */
function toLeaderboardRow(stat, kind, playerById = new Map()) {
  const team =
    stat.teamId && typeof stat.teamId === "object" ? stat.teamId : null;

  const player = playerById.get(String(stat.playerId)) ?? null;

  const base = {
    playerId: stat.playerId,
    playerName: player?.jerseyName || player?.fullName || "",
    fullName: player?.fullName || "",
    jerseyNo: player?.jerseyNo ?? null,
    photoUrl: player?.photoUrl ?? "",
    matches: stat.matches ?? 0,
    team: team
      ? {
          id: team._id,
          name: team.name,
          shortName: team.shortName,
          slug: team.slug,
          logoUrl: team.logoUrl ?? "",
          themeColor: team.themeColor ?? "",
        }
      : null,
  };

  switch (kind) {
    case "runs":
      return {
        ...base,
        runs: stat.runs ?? 0,
        ballsFaced: stat.ballsFaced ?? 0,
        highScore: stat.highScore ?? 0,
        average:
          stat.dismissals > 0 ? round(stat.runs / stat.dismissals, 2) : null,
        strikeRate:
          stat.ballsFaced > 0
            ? round((stat.runs / stat.ballsFaced) * 100, 2)
            : null,
      };

    case "wickets":
      return {
        ...base,
        wickets: stat.wickets ?? 0,
        ballsBowled: stat.ballsBowled ?? 0,
        overs: oversFromBalls(stat.ballsBowled ?? 0),
        runsConceded: stat.runsConceded ?? 0,
        economy:
          stat.ballsBowled > 0
            ? round(stat.runsConceded / (stat.ballsBowled / 6), 2)
            : null,
        bestBowling:
          stat.bestBowlingRuns !== null && stat.bestBowlingRuns !== undefined
            ? `${stat.bestBowlingWickets ?? 0}/${stat.bestBowlingRuns}`
            : null,
      };

    case "strikeRate":
      return {
        ...base,
        runs: stat.runs ?? 0,
        ballsFaced: stat.ballsFaced ?? 0,
        strikeRate: round(stat.strikeRate, 2),
      };

    case "economy":
      return {
        ...base,
        wickets: stat.wickets ?? 0,
        ballsBowled: stat.ballsBowled ?? 0,
        overs: oversFromBalls(stat.ballsBowled ?? 0),
        runsConceded: stat.runsConceded ?? 0,
        economy: round(stat.economy, 2),
      };

    case "fielding":
      return {
        ...base,
        catches: stat.catches ?? 0,
        runOuts: stat.runOuts ?? 0,
        stumpings: stat.stumpings ?? 0,
        total:
          (stat.catches ?? 0) + (stat.runOuts ?? 0) + (stat.stumpings ?? 0),
      };

    case "awards":
      return { ...base, playerOfMatchAwards: stat.playerOfMatchAwards ?? 0 };

    default:
      return base;
  }
}

/**
 * Cricket over notation from legal balls.
 *
 * 8 balls is 1.2 overs, not 1.3. A decimal conversion would be wrong for cricket.
 */
function oversFromBalls(balls = 0) {
  const safe = Math.max(0, Math.floor(balls || 0));
  return `${Math.floor(safe / 6)}.${safe % 6}`;
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

export default {
  listNews,
  getNews,
  listGallery,
  listVideos,
  listSponsors,
  listAwards,
  listAnnouncements,
  getSeasonStats,
};

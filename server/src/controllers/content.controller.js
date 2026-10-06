import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, paginated } from "../utils/helpers.js";
import { News } from "../models/News.js";
import { Gallery } from "../models/Gallery.js";
import { Video } from "../models/Video.js";
import { Sponsor } from "../models/Sponsor.js";
import { Award } from "../models/Award.js";
import { Announcement } from "../models/Announcement.js";
import { PlayerStat } from "../models/PlayerStat.js";
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
      .select(
        "slug titleBn titleEn excerptBn excerptEn coverUrl tags publishedAt views seasonId",
      )
      .lean(),
    News.countDocuments(filter),
  ]);

  res.status(200).json(paginated({ items, total, page, limit }));
});

/** GET /api/v1/news/:slug */
export const getNews = asyncHandler(async (req, res) => {
  const article = await News.findOneAndUpdate(
    { slug: String(req.params.slug).toLowerCase(), published: true },
    // View count is a courtesy counter; a failed increment must not fail the read.
    { $inc: { views: 1 } },
    { new: true },
  ).lean();

  if (!article) throw ApiError.notFound("Article not found");
  res.status(200).json(ok(article));
});

/* ------------------------------------------------------------------ *
 * Gallery
 * ------------------------------------------------------------------ */

/** GET /api/v1/gallery */
export const listGallery = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = { active: true };
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;
  if (req.query.matchId) filter.matchId = req.query.matchId;
  if (req.query.type) filter.type = req.query.type;

  const [items, total] = await Promise.all([
    Gallery.find(filter)
      .sort({ order: 1, capturedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Gallery.countDocuments(filter),
  ]);

  res.status(200).json(paginated({ items, total, page, limit }));
});

/* ------------------------------------------------------------------ *
 * Videos
 * ------------------------------------------------------------------ */

/** GET /api/v1/videos */
export const listVideos = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const filter = { published: true };
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;

  const [items, total] = await Promise.all([
    Video.find(filter)
      .sort({ order: 1, publishedAt: -1 })
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

/**
 * GET /api/v1/sponsors
 *
 * Grouped by tier on the server: the tiers have a fixed display order (title first,
 * partners last) and encoding that order in one place stops each new consumer from
 * inventing its own.
 */
export const listSponsors = asyncHandler(async (req, res) => {
  const filter = { active: true };
  const season = await resolveSeason(req.query.season);
  if (season) filter.seasonId = season._id;

  const sponsors = await Sponsor.find(filter)
    .sort({ tier: 1, order: 1, name: 1 })
    .lean();

  const TIER_ORDER = ["TITLE", "PLATINUM", "GOLD", "PARTNER"];

  const byTier = new Map();
  for (const sponsor of sponsors) {
    if (!byTier.has(sponsor.tier)) byTier.set(sponsor.tier, []);
    byTier.get(sponsor.tier).push(sponsor);
  }

  res.status(200).json(
    ok({
      groups: TIER_ORDER.filter((tier) => byTier.has(tier)).map((tier) => ({
        tier,
        sponsors: byTier.get(tier),
      })),
      all: sponsors,
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Awards
 * ------------------------------------------------------------------ */

/** GET /api/v1/awards */
export const listAwards = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.notFound("No season found");

  const filter = { seasonId: season._id };
  if (req.query.matchId) filter.matchId = req.query.matchId;

  const awards = await Award.find(filter)
    .sort({ type: 1, createdAt: -1 })
    .populate("winnerPlayerId", "fullName jerseyName jerseyNo photoUrl")
    .populate("winnerTeamId", "name shortName slug logoUrl themeColor")
    .lean();

  const AWARD_ORDER = [
    "CHAMPION",
    "RUNNER_UP",
    "MAN_OF_THE_TOURNAMENT",
    "BEST_BATTER",
    "BEST_BOWLER",
    "BEST_FIELDER",
    "MAN_OF_THE_MATCH",
    "PARTICIPATION_MEDAL",
  ];

  const sorted = [...awards].sort(
    (a, b) => AWARD_ORDER.indexOf(a.type) - AWARD_ORDER.indexOf(b.type),
  );

  res.status(200).json(ok(sorted));
});

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

/**
 * GET /api/v1/announcements
 *
 * Only live notices: active, not expired, and belonging to a season that has not
 * finished. An announcement from last year's tournament is history, not news, and
 * showing it in the ticker would be actively misleading.
 */
export const listAnnouncements = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) {
    res.status(200).json(ok([]));
    return;
  }

  // Completed seasons keep their notices for the record but not for the ticker,
  // unless the caller explicitly asks for the archive.
  if (season.status === "COMPLETED" && req.query.includeArchive !== "true") {
    res.status(200).json(ok([]));
    return;
  }

  const now = new Date();
  const filter = {
    seasonId: season._id,
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };

  const PRIORITY_ORDER = { URGENT: 0, IMPORTANT: 1, NORMAL: 2 };

  const items = await Announcement.find(filter)
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const sorted = [...items].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  );

  res.status(200).json(ok(sorted));
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
      mostRuns: runs.map((row) => toLeaderboardRow(row, "runs")),
      mostWickets: wickets.map((row) => toLeaderboardRow(row, "wickets")),
      bestStrikeRate: byStrikeRate.map((row) =>
        toLeaderboardRow(row, "strikeRate"),
      ),
      bestEconomy: byEconomy.map((row) => toLeaderboardRow(row, "economy")),
      bestFielding: fielding.map((row) => toLeaderboardRow(row, "fielding")),
      mostAwards: awards.map((row) => toLeaderboardRow(row, "awards")),
    }),
  );
});

/** Trim a stats document down to what a leaderboard table displays. */
function toLeaderboardRow(stat, kind) {
  const team =
    stat.teamId && typeof stat.teamId === "object" ? stat.teamId : null;

  const base = {
    playerId: stat.playerId,
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

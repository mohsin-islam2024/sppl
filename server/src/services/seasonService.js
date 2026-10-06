import { Season } from "../models/Season.js";
import { Team } from "../models/Team.js";
import { Match } from "../models/Match.js";
import { Player } from "../models/Player.js";
import { PointsTable } from "../models/PointsTable.js";
import { SEASON_STATUS } from "@sppl/shared/constants/tournament.js";
import { MATCH_STATUS } from "@sppl/shared/constants/matchStatus.js";
import ApiError from "../utils/ApiError.js";

/**
 * Season resolution and summary assembly.
 *
 * Every other public read needs to know "which season?" — fixtures, standings,
 * squads, news all hang off it. Resolving that in one place keeps the rule about
 * the default season consistent: a visitor who has never picked one should land on
 * the season that matters now, which is the upcoming or ongoing one, never the
 * archive.
 */

/**
 * Resolve a season from an explicit identifier, or fall back to the current one.
 *
 * Accepts a Mongo id or the public slug, so a URL can read
 * `/fixtures?season=sppl-2-2027` instead of exposing an ObjectId.
 */
export async function resolveSeason(identifier, { required = false } = {}) {
  if (identifier) {
    const isObjectId = /^[a-f\d]{24}$/i.test(String(identifier));
    const query = isObjectId
      ? {
          $or: [
            { _id: identifier },
            { slug: String(identifier).toLowerCase() },
          ],
        }
      : { slug: String(identifier).toLowerCase() };

    const season = await Season.findOne(query).lean();
    if (season) return season;
    if (required) throw ApiError.notFound(`Season not found: ${identifier}`);
    return null;
  }

  if (required) throw ApiError.badRequest("A season is required");

  return getCurrentSeason();
}

/**
 * The season a first-time visitor should see.
 *
 * Order of preference:
 *   1. an ONGOING season (a tournament is being played right now)
 *   2. the highest-numbered UPCOMING season (something is coming)
 *   3. the most recent COMPLETED season (the archive)
 *
 * Season 2 is UPCOMING with no dates, and Season 1 is COMPLETED, so a visitor
 * currently lands on Season 2 — the thing the site is actually about.
 */
export async function getCurrentSeason() {
  const ongoing = await Season.findOne({ status: SEASON_STATUS.ONGOING })
    .sort({ seasonNo: -1 })
    .lean();
  if (ongoing) return ongoing;

  const upcoming = await Season.findOne({ status: SEASON_STATUS.UPCOMING })
    .sort({ seasonNo: -1 })
    .lean();
  if (upcoming) return upcoming;

  return Season.findOne({ status: SEASON_STATUS.COMPLETED })
    .sort({ seasonNo: -1 })
    .lean();
}

/**
 * Everything the home page needs for one season, in a single round trip.
 *
 * Assembled server-side because the home page wants all of it at once and four
 * separate requests would each pay a round trip on a village connection. The
 * counts are cheap aggregations rather than full document reads.
 */
export async function buildSeasonSummary(season) {
  if (!season) {
    return {
      season: null,
      stats: emptyStats(),
      nextMatch: null,
      latestResult: null,
      standings: [],
    };
  }

  const seasonId = season._id;

  const [
    teamCount,
    playerCount,
    matchCount,
    liveMatch,
    upcomingMatch,
    latestResult,
  ] = await Promise.all([
    Team.countDocuments({ seasonId, active: true }),
    Player.countDocuments({ seasonId, active: true }),
    Match.countDocuments({ seasonId }),
    Match.findOne({ seasonId, status: MATCH_STATUS.LIVE })
      .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
      .lean(),
    Match.findOne({
      seasonId,
      status: { $in: [MATCH_STATUS.UPCOMING, MATCH_STATUS.TOSS] },
    })
      .sort({ startAt: 1 })
      .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
      .lean(),
    Match.findOne({ seasonId, status: MATCH_STATUS.COMPLETED })
      .sort({ "result.completedAt": -1, startAt: -1 })
      .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
      .lean(),
  ]);

  const standings = await PointsTable.find({ seasonId })
    .populate("teamId", "name shortName slug logoUrl themeColor")
    .lean();

  return {
    season: toSeasonCard(season),
    stats: {
      teams: teamCount,
      players: playerCount,
      matches: matchCount,
      // Only meaningful once dates exist; null tells the client to hide the countdown.
      daysUntilStart: daysUntil(season.startDate),
      hasSchedule: Boolean(season.startDate && season.endDate),
    },
    liveMatch: liveMatch ? toMatchCard(liveMatch) : null,
    nextMatch: upcomingMatch ? toMatchCard(upcomingMatch) : null,
    latestResult: latestResult ? toMatchCard(latestResult) : null,
    standings: sortStandings(standings).slice(0, 4).map(toStandingRow),
  };
}

/* ------------------------------------------------------------------ *
 * Shape helpers
 *
 * These keep the API response small and stable. A season document carries rules
 * and conduct text that the home page has no use for, and a match carries a full
 * innings tree; sending those on a list endpoint is both slow and a maintenance
 * trap when the model changes.
 * ------------------------------------------------------------------ */

/** Trim a season to the fields a card or switcher needs. */
export function toSeasonCard(season) {
  if (!season) return null;
  return {
    id: season._id,
    seasonNo: season.seasonNo,
    year: season.year,
    nameBn: season.nameBn,
    nameEn: season.nameEn,
    shortName: season.shortName,
    slug: season.slug,
    status: season.status,
    startDate: season.startDate ?? null,
    endDate: season.endDate ?? null,
    venue: season.venue ?? "",
    location: season.location ?? "",
    logoUrl: season.logoUrl ?? "",
    bannerUrl: season.bannerUrl ?? "",
    championTeamId: season.championTeamId ?? null,
    runnerUpTeamId: season.runnerUpTeamId ?? null,
  };
}

/** Trim a match to the fields a fixture or result card needs. */
export function toMatchCard(match) {
  if (!match) return null;

  return {
    id: match._id,
    matchNo: match.matchNo,
    stage: match.stage,
    status: match.status,
    startAt: match.startAt,
    venue: match.venue ?? "",
    teamA: toTeamChip(match.teamAId),
    teamB: toTeamChip(match.teamBId),
    // Summary figures only. The full innings tree lives behind /matches/:id/scorecard.
    innings: (match.innings ?? []).map((innings) => ({
      battingTeamId: innings.battingTeamId,
      runs: innings.runs,
      wickets: innings.wickets,
      balls: innings.balls,
      overs: oversFromBalls(innings.balls),
      isComplete: innings.isComplete,
    })),
    currentInnings: match.currentInnings,
    target: match.innings?.[1]?.target ?? null,
    result: match.result
      ? {
          resultType: match.result.resultType,
          winnerTeamId: match.result.winnerTeamId,
          margin: match.result.margin ?? "",
          textBn: match.result.textBn ?? "",
          textEn: match.result.textEn ?? "",
        }
      : null,
    streamUrl: match.streamUrl ?? "",
  };
}

/** The small team object embedded in a match card. */
export function toTeamChip(team) {
  if (!team) return null;
  // A populated document has a name; an unpopulated id is only useful as an id.
  if (typeof team === "object" && team.name) {
    return {
      id: team._id,
      name: team.name,
      shortName: team.shortName,
      slug: team.slug,
      logoUrl: team.logoUrl ?? "",
      themeColor: team.themeColor ?? "",
    };
  }
  return {
    id: team,
    name: "",
    shortName: "",
    slug: "",
    logoUrl: "",
    themeColor: "",
  };
}

/** One row of the points table, ready to render. */
export function toStandingRow(row) {
  const team = row.teamId && typeof row.teamId === "object" ? row.teamId : null;
  return {
    teamId: team?._id ?? row.teamId,
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
    played: row.played ?? 0,
    won: row.won ?? 0,
    lost: row.lost ?? 0,
    tied: row.tied ?? 0,
    noResult: row.noResult ?? 0,
    points: row.points ?? 0,
    nrr: Number.isFinite(row.nrr) ? Number(row.nrr.toFixed(3)) : 0,
    runsFor: row.runsFor ?? 0,
    runsAgainst: row.runsAgainst ?? 0,
    recentForm: row.recentForm ?? [],
  };
}

/**
 * Standings sort order: points, then net run rate, then wins.
 *
 * This is the standard tiebreak and it matters here — with a four-team league a
 * points tie decides who plays the final, so the order cannot be left to Mongo's
 * natural order.
 */
export function sortStandings(rows = []) {
  return [...rows].sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0))
      return (b.points ?? 0) - (a.points ?? 0);
    if ((b.nrr ?? 0) !== (a.nrr ?? 0)) return (b.nrr ?? 0) - (a.nrr ?? 0);
    if ((b.won ?? 0) !== (a.won ?? 0)) return (b.won ?? 0) - (a.won ?? 0);
    const nameA = a.teamId?.name ?? "";
    const nameB = b.teamId?.name ?? "";
    return String(nameA).localeCompare(String(nameB));
  });
}

/** Legal balls -> the familiar over figure (22 -> 3.4). */
export function oversFromBalls(balls = 0) {
  const safe = Math.max(0, Math.floor(balls || 0));
  return Math.floor(safe / 6) + (safe % 6) / 10;
}

/**
 * Whole days until a date, or null when there is no date.
 *
 * Null is the important case: Season 2 has no start date yet, and the home page
 * must hide its countdown rather than render `NaN` or a negative number.
 */
export function daysUntil(date) {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function emptyStats() {
  return {
    teams: 0,
    players: 0,
    matches: 0,
    daysUntilStart: null,
    hasSchedule: false,
  };
}

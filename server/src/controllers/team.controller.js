import { asyncHandler } from "../utils/asyncHandler.js";
import { ok, paginated } from "../utils/helpers.js";
import { Team } from "../models/Team.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";
import { PointsTable } from "../models/PointsTable.js";
import {
  resolveSeason,
  toTeamChip,
  toStandingRow,
  toMatchCard,
} from "../services/seasonService.js";
import ApiError from "../utils/ApiError.js";

/**
 * GET /api/v1/teams
 *
 * Query params:
 *   season    season slug or id; defaults to the current season
 *   all       `true` to span every season (used by the archive views)
 *
 * A team belongs to one season, so the same club appears once per season it
 * entered. That is intentional: squads change, and a historical team page must
 * still show the squad that played that year.
 */
export const listTeams = asyncHandler(async (req, res) => {
  const filter = { active: true };

  if (req.query.all !== "true") {
    const season = await resolveSeason(req.query.season);
    if (!season) throw ApiError.notFound("No season found");
    filter.seasonId = season._id;
  }

  const teams = await Team.find(filter)
    .sort({ order: 1, name: 1 })
    .populate("seasonId", "seasonNo year shortName slug status")
    .lean();

  res.status(200).json(
    ok(
      teams.map((team) => ({
        ...toTeamChip(team),
        season: team.seasonId
          ? {
              id: team.seasonId._id,
              seasonNo: team.seasonId.seasonNo,
              year: team.seasonId.year,
              shortName: team.seasonId.shortName,
              slug: team.seasonId.slug,
              status: team.seasonId.status,
            }
          : null,
        captainPlayerId: team.captainPlayerId ?? null,
        squadSize: team.squadSize ?? 0,
      })),
    ),
  );
});

/**
 * GET /api/v1/teams/:slug
 *
 * The team page payload: profile, full squad and the team's own standings row.
 *
 * Looked up by slug within the current season by default, because that is the URL
 * a visitor shares (`/teams/agni-riders`). Pass `?season=` to reach another
 * season's edition of the same club.
 */
export const getTeam = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);

  const query = { slug: String(req.params.slug).toLowerCase(), active: true };
  if (season) query.seasonId = season._id;

  const team = await Team.findOne(query)
    .populate(
      "seasonId",
      "seasonNo year shortName slug status startDate endDate",
    )
    .lean();

  if (!team) throw ApiError.notFound(`Team not found: ${req.params.slug}`);

  const [players, standing, matches] = await Promise.all([
    Player.find({ seasonId: team.seasonId._id, teamId: team._id, active: true })
      .sort({ order: 1, jerseyNo: 1 })
      .lean(),
    PointsTable.findOne({ seasonId: team.seasonId._id, teamId: team._id })
      .populate("teamId", "name shortName slug logoUrl themeColor")
      .lean(),
    Match.find({
      seasonId: team.seasonId._id,
      $or: [{ teamAId: team._id }, { teamBId: team._id }],
    })
      .sort({ startAt: 1 })
      .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
      .lean(),
  ]);

  res.status(200).json(
    ok({
      team: {
        ...toTeamChip(team),
        captainPlayerId: team.captainPlayerId ?? null,
        viceCaptainPlayerId: team.viceCaptainPlayerId ?? null,
        squadSize: players.length,
        season: team.seasonId
          ? {
              id: team.seasonId._id,
              seasonNo: team.seasonId.seasonNo,
              year: team.seasonId.year,
              shortName: team.seasonId.shortName,
              slug: team.seasonId.slug,
              status: team.seasonId.status,
              startDate: team.seasonId.startDate ?? null,
              endDate: team.seasonId.endDate ?? null,
            }
          : null,
      },
      squad: players.map(toPlayerCard),
      standing: standing ? toStandingRow(standing) : null,
      matches: matches.map(toMatchCard),
    }),
  );
});

/**
 * GET /api/v1/teams/:slug/players
 * Squad only — used when the team page renders its roster in a second request.
 */
export const listTeamPlayers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const team = await Team.findOne({
    slug: String(req.params.slug).toLowerCase(),
    active: true,
  })
    .select("_id seasonId name")
    .lean();
  if (!team) throw ApiError.notFound(`Team not found: ${req.params.slug}`);

  const filter = { teamId: team._id, active: true };

  const [items, total] = await Promise.all([
    Player.find(filter)
      .sort({ order: 1, jerseyNo: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Player.countDocuments(filter),
  ]);

  res
    .status(200)
    .json(paginated({ items: items.map(toPlayerCard), total, page, limit }));
});

/**
 * The player shape used in squad lists.
 *
 * Jersey number, printed name and size are all here because the organizer's sheet
 * is the source of truth for the kit, and the team page doubles as a place to check
 * a shirt order.
 */
export function toPlayerCard(player) {
  if (!player) return null;
  return {
    id: player._id,
    fullName: player.fullName,
    jerseyName: player.jerseyName,
    jerseyNo: player.jerseyNo,
    role: player.role,
    battingStyle: player.battingStyle ?? null,
    bowlingStyle: player.bowlingStyle ?? null,
    photoUrl: player.photoUrl ?? "",
    isCaptain: Boolean(player.isCaptain),
    isViceCaptain: Boolean(player.isViceCaptain),
    size: player.size,
    isKidsSize: Boolean(player.isKidsSize),
    jerseyConfirmed: Boolean(player.jerseyConfirmed),
    teamId: player.teamId,
    seasonId: player.seasonId,
  };
}

export default { listTeams, getTeam, listTeamPlayers, toPlayerCard };

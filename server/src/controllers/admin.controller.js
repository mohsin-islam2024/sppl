import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/helpers.js";
import * as adminService from "../services/adminService.js";
import {
  resolveSeason,
  toSeasonCard,
  toTeamChip,
} from "../services/seasonService.js";
import { Season } from "../models/Season.js";
import { Team } from "../models/Team.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";
import ApiError from "../utils/ApiError.js";

/**
 * Admin controllers.
 *
 * Thin by design: each handler unwraps the request, calls one service function and
 * returns the standard envelope. Authorisation has already happened in the route
 * middleware, so nothing here re-checks a role.
 */

/* ------------------------------------------------------------------ *
 * Admin lists
 *
 * Separate from the public lists because the admin panel needs to see inactive
 * records, unpublished content and the raw document — the public endpoints
 * deliberately filter all of that out.
 * ------------------------------------------------------------------ */

/** GET /api/v1/admin/seasons */
export const listSeasons = asyncHandler(async (_req, res) => {
  const seasons = await Season.find({}).sort({ seasonNo: -1 }).lean();
  res.status(200).json(ok(seasons));
});

/** GET /api/v1/admin/teams?season= */
export const listTeams = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.badRequest("A season is required");

  const teams = await Team.find({ seasonId: season._id })
    .sort({ order: 1, name: 1 })
    .lean();
  res.status(200).json(ok(teams));
});

/** GET /api/v1/admin/players?season=&team= */
export const listPlayers = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.season) {
    const season = await resolveSeason(req.query.season);
    if (season) filter.seasonId = season._id;
  }
  if (req.query.team) filter.teamId = req.query.team;

  const players = await Player.find(filter)
    .sort({ teamId: 1, order: 1, jerseyNo: 1 })
    .populate("teamId", "name shortName slug")
    .lean();

  res.status(200).json(ok(players));
});

/** GET /api/v1/admin/matches?season= */
export const listMatches = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.badRequest("A season is required");

  const matches = await Match.find({ seasonId: season._id })
    .sort({ matchNo: 1 })
    .populate("teamAId teamBId", "name shortName slug logoUrl themeColor")
    .lean();

  res.status(200).json(ok(matches));
});

/**
 * GET /api/v1/admin/selectors?season=
 *
 * The minimal team and player lists the admin forms need for their dropdowns.
 * One call instead of two, because every form needs both.
 */
export const listSelectors = asyncHandler(async (req, res) => {
  const season = await resolveSeason(req.query.season);
  if (!season) throw ApiError.badRequest("A season is required");

  const selectors = await adminService.listForSelectors(season._id);

  res.status(200).json(
    ok({
      season: toSeasonCard(season),
      teams: selectors.teams.map((team) => toTeamChip(team)),
      players: selectors.players,
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Season writes
 * ------------------------------------------------------------------ */

export const createSeason = asyncHandler(async (req, res) => {
  const season = await adminService.createSeason(req.body);
  res.status(201).json(ok(season, "Season created"));
});

export const updateSeason = asyncHandler(async (req, res) => {
  const season = await adminService.updateSeason(req.params.id, req.body);
  res.status(200).json(ok(season, "Season updated"));
});

export const deleteSeason = asyncHandler(async (req, res) => {
  const result = await adminService.deleteSeason(req.params.id);
  res.status(200).json(ok(result, "Season and all its data deleted"));
});

/* ------------------------------------------------------------------ *
 * Team writes
 * ------------------------------------------------------------------ */

export const createTeam = asyncHandler(async (req, res) => {
  const team = await adminService.createTeam(req.body);
  res.status(201).json(ok(team, "Team created"));
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await adminService.updateTeam(req.params.id, req.body);
  res.status(200).json(ok(team, "Team updated"));
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const result = await adminService.deleteTeam(req.params.id);
  res.status(200).json(ok(result, "Team deleted"));
});

/* ------------------------------------------------------------------ *
 * Player writes
 * ------------------------------------------------------------------ */

export const createPlayer = asyncHandler(async (req, res) => {
  const player = await adminService.createPlayer(req.body);
  res.status(201).json(ok(player, "Player added"));
});

export const updatePlayer = asyncHandler(async (req, res) => {
  const player = await adminService.updatePlayer(req.params.id, req.body);
  res.status(200).json(ok(player, "Player updated"));
});

export const deletePlayer = asyncHandler(async (req, res) => {
  const result = await adminService.deletePlayer(req.params.id);
  res.status(200).json(ok(result, "Player deleted"));
});

/* ------------------------------------------------------------------ *
 * Match writes
 * ------------------------------------------------------------------ */

export const createMatch = asyncHandler(async (req, res) => {
  const match = await adminService.createMatch(req.body);
  res.status(201).json(ok(match, "Match created"));
});

export const updateMatch = asyncHandler(async (req, res) => {
  const match = await adminService.updateMatch(req.params.id, req.body);
  res.status(200).json(ok(match, "Match updated"));
});

export const deleteMatch = asyncHandler(async (req, res) => {
  const result = await adminService.deleteMatch(req.params.id);
  res.status(200).json(ok(result, "Match deleted"));
});

export default {
  listSeasons,
  listTeams,
  listPlayers,
  listMatches,
  listSelectors,
  createSeason,
  updateSeason,
  deleteSeason,
  createTeam,
  updateTeam,
  deleteTeam,
  createPlayer,
  updatePlayer,
  deletePlayer,
  createMatch,
  updateMatch,
  deleteMatch,
};

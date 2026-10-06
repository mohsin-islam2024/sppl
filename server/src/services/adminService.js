import mongoose from "mongoose";
import { Season } from "../models/Season.js";
import { Team } from "../models/Team.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";
import { PointsTable } from "../models/PointsTable.js";
import ApiError from "../utils/ApiError.js";
import { slugify } from "../utils/helpers.js";

/**
 * Admin write operations.
 *
 * Every function here is called only from a route that has already passed
 * `requireRole(ADMIN)`. The service does the data work; it does not re-check the
 * caller's role, because that check belongs to the route and duplicating it in two
 * places is how the two drift apart.
 *
 * The rules that ARE enforced here are about referential integrity — the things a
 * role check cannot catch:
 *   - a team cannot point at a season that does not exist
 *   - a player cannot point at a team from a different season
 *   - a match cannot have both sides be the same team
 *   - a points-table row must exist for every team in a season
 */

/* ------------------------------------------------------------------ *
 * Season
 * ------------------------------------------------------------------ */

export async function createSeason(payload) {
  const slug =
    payload.slug ||
    slugify(
      `${payload.shortName ?? "sppl"}-${payload.seasonNo}-${payload.year}`,
    );

  const exists = await Season.findOne({ slug }).lean();
  if (exists)
    throw ApiError.conflict(`A season with slug "${slug}" already exists`);

  const duplicateNumber = await Season.findOne({
    seasonNo: payload.seasonNo,
    year: payload.year,
  }).lean();
  if (duplicateNumber) {
    throw ApiError.conflict(
      `Season ${payload.seasonNo} of ${payload.year} already exists`,
    );
  }

  const season = await Season.create({ ...payload, slug });
  return season.toJSON();
}

export async function updateSeason(seasonId, payload) {
  const season = await Season.findById(seasonId);
  if (!season) throw ApiError.notFound("Season not found");

  // A slug is a public URL; changing it silently would break every shared link.
  // It may only change if the caller explicitly sends a new one.
  const allowed = [
    "nameBn",
    "nameEn",
    "shortName",
    "status",
    "startDate",
    "endDate",
    "venue",
    "location",
    "logoUrl",
    "bannerUrl",
    "pointsSystem",
    "matchRules",
    "championTeamId",
    "runnerUpTeamId",
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) season[key] = payload[key];
  }

  await season.save();
  return season.toJSON();
}

/**
 * Delete a season and everything inside it.
 *
 * This is a cascade on purpose: a season with orphaned teams and matches would show
 * up in every list query and be impossible to clean up from the UI. It is the only
 * place in the API that removes more than one document, and the client requires an
 * explicit confirmation before calling it.
 */
export async function deleteSeason(seasonId) {
  const season = await Season.findById(seasonId).lean();
  if (!season) throw ApiError.notFound("Season not found");

  const matches = await Match.find({ seasonId }).select("_id").lean();
  const matchIds = matches.map((match) => match._id);

  const [teamResult, playerResult, matchResult, pointsResult] =
    await Promise.all([
      Team.deleteMany({ seasonId }),
      Player.deleteMany({ seasonId }),
      Match.deleteMany({ seasonId }),
      PointsTable.deleteMany({ seasonId }),
    ]);

  // Balls reference a match, so they go with it.
  let ballCount = 0;
  if (matchIds.length) {
    const { Ball } = await import("../models/Ball.js");
    const ballResult = await Ball.deleteMany({ matchId: { $in: matchIds } });
    ballCount = ballResult.deletedCount ?? 0;
  }

  await Season.findByIdAndDelete(seasonId);

  return {
    season: season.nameEn,
    teams: teamResult.deletedCount ?? 0,
    players: playerResult.deletedCount ?? 0,
    matches: matchResult.deletedCount ?? 0,
    balls: ballCount,
    pointsRows: pointsResult.deletedCount ?? 0,
  };
}

/* ------------------------------------------------------------------ *
 * Team
 * ------------------------------------------------------------------ */

export async function createTeam(payload) {
  const season = await Season.findById(payload.seasonId).select("_id").lean();
  if (!season) throw ApiError.badRequest("The season does not exist");

  const slug = payload.slug || slugify(payload.name);

  const clash = await Team.findOne({ seasonId: payload.seasonId, slug }).lean();
  if (clash)
    throw ApiError.conflict(
      `A team with slug "${slug}" already exists in this season`,
    );

  const team = await Team.create({ ...payload, slug });

  // Every team needs a standings row from the moment it exists, or the points table
  // would be missing a row until the first match is completed.
  await PointsTable.findOneAndUpdate(
    { seasonId: team.seasonId, teamId: team._id },
    { $setOnInsert: { seasonId: team.seasonId, teamId: team._id } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  await refreshSeasonTeamCount(team.seasonId);

  return team.toJSON();
}

export async function updateTeam(teamId, payload) {
  const team = await Team.findById(teamId);
  if (!team) throw ApiError.notFound("Team not found");

  const allowed = [
    "name",
    "shortName",
    "logoUrl",
    "logoPublicId",
    "themeColor",
    "captainPlayerId",
    "viceCaptainPlayerId",
    "order",
    "active",
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) team[key] = payload[key];
  }

  await team.save();
  return team.toJSON();
}

/**
 * Delete a team.
 *
 * Refuses when the team has played a match, because removing it would leave the
 * match pointing at a team that no longer exists and every fixture list would render
 * an empty name. The admin can deactivate the team instead, which hides it from new
 * fixtures while keeping history intact.
 */
export async function deleteTeam(teamId) {
  const team = await Team.findById(teamId).lean();
  if (!team) throw ApiError.notFound("Team not found");

  const playedCount = await Match.countDocuments({
    seasonId: team.seasonId,
    $or: [{ teamAId: team._id }, { teamBId: team._id }],
  });

  if (playedCount > 0) {
    throw ApiError.conflict(
      `This team appears in ${playedCount} match(es). Deactivate it instead, or delete those matches first.`,
    );
  }

  await Promise.all([
    Player.deleteMany({ teamId: team._id }),
    PointsTable.deleteMany({ teamId: team._id }),
    Team.findByIdAndDelete(team._id),
  ]);

  await refreshSeasonTeamCount(team.seasonId);

  return { deleted: team.name };
}

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */

export async function createPlayer(payload) {
  const team = await Team.findById(payload.teamId)
    .select("_id seasonId")
    .lean();
  if (!team) throw ApiError.badRequest("The team does not exist");

  // A player belongs to the same season as their team. Mismatched ids would put a
  // player in a season they never played in and break every squad query.
  if (String(team.seasonId) !== String(payload.seasonId)) {
    throw ApiError.badRequest("The team belongs to a different season");
  }

  const clash = await Player.findOne({
    seasonId: payload.seasonId,
    teamId: payload.teamId,
    jerseyNo: payload.jerseyNo,
  }).lean();

  if (clash) {
    throw ApiError.conflict(
      `Jersey number ${payload.jerseyNo} is already used by ${clash.jerseyName} in this team`,
    );
  }

  const player = await Player.create({
    ...payload,
    isKidsSize: /^\d{1,2}y$/.test(payload.size ?? ""),
  });

  await refreshTeamSquadSize(team._id);

  return player.toJSON();
}

export async function updatePlayer(playerId, payload) {
  const player = await Player.findById(playerId);
  if (!player) throw ApiError.notFound("Player not found");

  // Jersey numbers must stay unique per team while editing too — otherwise an edit
  // could create the duplicate that create-time validation prevents.
  if (payload.jerseyNo !== undefined && payload.jerseyNo !== player.jerseyNo) {
    const clash = await Player.findOne({
      seasonId: player.seasonId,
      teamId: player.teamId,
      jerseyNo: payload.jerseyNo,
      _id: { $ne: player._id },
    }).lean();
    if (clash) {
      throw ApiError.conflict(
        `Jersey number ${payload.jerseyNo} is already used by ${clash.jerseyName}`,
      );
    }
  }

  const allowed = [
    "fullName",
    "jerseyName",
    "jerseyNo",
    "size",
    "role",
    "battingStyle",
    "bowlingStyle",
    "dateOfBirth",
    "ageYears",
    "photoUrl",
    "photoPublicId",
    "isCaptain",
    "isViceCaptain",
    "jerseyConfirmed",
    "order",
    "active",
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) player[key] = payload[key];
  }

  if (payload.size !== undefined)
    player.isKidsSize = /^\d{1,2}y$/.test(payload.size);

  await player.save();
  return player.toJSON();
}

export async function deletePlayer(playerId) {
  const player = await Player.findById(playerId).lean();
  if (!player) throw ApiError.notFound("Player not found");

  // A player who has batted must keep their record, or career statistics reference
  // a person who no longer exists.
  const { Ball } = await import("../models/Ball.js");
  const ballCount = await Ball.countDocuments({
    $or: [{ batterId: player._id }, { bowlerId: player._id }],
  });

  if (ballCount > 0) {
    throw ApiError.conflict(
      `${player.jerseyName} has ${ballCount} recorded delivery(ies). Deactivate them instead to keep the record.`,
    );
  }

  await Promise.all([
    Player.findByIdAndDelete(player._id),
    Team.updateMany(
      {
        $or: [
          { captainPlayerId: player._id },
          { viceCaptainPlayerId: player._id },
        ],
      },
      {
        $set: {},
        ...{},
      },
    ),
  ]);

  // Clear captain / vice-captain references left dangling.
  await Team.updateMany(
    { captainPlayerId: player._id },
    { $set: { captainPlayerId: null } },
  );
  await Team.updateMany(
    { viceCaptainPlayerId: player._id },
    { $set: { viceCaptainPlayerId: null } },
  );

  await refreshTeamSquadSize(player.teamId);

  return { deleted: player.jerseyName };
}

/* ------------------------------------------------------------------ *
 * Match
 * ------------------------------------------------------------------ */

export async function createMatch(payload) {
  const [teamA, teamB] = await Promise.all([
    Team.findById(payload.teamAId).select("_id seasonId").lean(),
    Team.findById(payload.teamBId).select("_id seasonId").lean(),
  ]);

  if (!teamA || !teamB)
    throw ApiError.badRequest("One or both teams do not exist");

  if (String(teamA._id) === String(teamB._id)) {
    throw ApiError.badRequest("A match cannot be between the same team twice");
  }

  if (
    String(teamA.seasonId) !== String(payload.seasonId) ||
    String(teamB.seasonId) !== String(payload.seasonId)
  ) {
    throw ApiError.badRequest(
      "Both teams must belong to the same season as the match",
    );
  }

  const clash = await Match.findOne({
    seasonId: payload.seasonId,
    matchNo: payload.matchNo,
  }).lean();
  if (clash)
    throw ApiError.conflict(`Match number ${payload.matchNo} already exists`);

  const match = await Match.create(payload);
  return match.toJSON();
}

export async function updateMatch(matchId, payload) {
  const match = await Match.findById(matchId);
  if (!match) throw ApiError.notFound("Match not found");

  // Once a ball has been bowled, the fixture's teams and number are frozen — moving
  // them would detach the recorded deliveries from the match they belong to.
  const hasStarted = await hasRecordedBalls(match._id);
  const frozen = ["teamAId", "teamBId", "matchNo", "seasonId"];

  if (hasStarted) {
    for (const key of frozen) {
      if (
        payload[key] !== undefined &&
        String(payload[key]) !== String(match[key])
      ) {
        throw ApiError.conflict(
          "This match has already started, so its teams and number cannot be changed",
        );
      }
    }
  }

  const allowed = [
    "matchNo",
    "stage",
    "teamAId",
    "teamBId",
    "venue",
    "startAt",
    "status",
    "streamUrl",
    "umpireIds",
    "scorerId",
    "playingSquads",
    "toss",
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) match[key] = payload[key];
  }

  await match.save();
  return match.toJSON();
}

/**
 * Delete a match.
 *
 * Refuses once deliveries exist, because deleting it would silently discard the
 * scoring record. The admin can mark it abandoned instead.
 */
export async function deleteMatch(matchId) {
  const match = await Match.findById(matchId).lean();
  if (!match) throw ApiError.notFound("Match not found");

  const hasStarted = await hasRecordedBalls(match._id);
  if (hasStarted) {
    throw ApiError.conflict(
      "This match has recorded deliveries. Mark it abandoned instead of deleting it.",
    );
  }

  await Match.findByIdAndDelete(match._id);
  return { deleted: `Match ${match.matchNo}` };
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

/** Has any delivery been recorded for this match? */
async function hasRecordedBalls(matchId) {
  const { Ball } = await import("../models/Ball.js");
  return (await Ball.countDocuments({ matchId })) > 0;
}

/** Keep a season's cached team count in step with reality. */
async function refreshSeasonTeamCount(seasonId) {
  const count = await Team.countDocuments({ seasonId, active: true });
  await Season.findByIdAndUpdate(seasonId, { teamCount: count });
}

/** Keep a team's cached squad size in step with reality. */
async function refreshTeamSquadSize(teamId) {
  const count = await Player.countDocuments({ teamId, active: true });
  await Team.findByIdAndUpdate(teamId, { squadSize: count });
}

/**
 * A lightweight, unfiltered list for the admin selectors.
 *
 * The admin forms need every team and player of a season in a dropdown, including
 * inactive ones — which is why this does not reuse the public list endpoints.
 */
export async function listForSelectors(seasonId) {
  const [teams, players] = await Promise.all([
    Team.find({ seasonId })
      .sort({ order: 1, name: 1 })
      .select("name shortName slug")
      .lean(),
    Player.find({ seasonId })
      .sort({ teamId: 1, jerseyNo: 1 })
      .select("fullName jerseyName jerseyNo teamId")
      .lean(),
  ]);

  return { teams, players };
}

export default {
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
  listForSelectors,
};

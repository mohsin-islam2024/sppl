#!/usr/bin/env node
/**
 * Reset one season's data back to a clean slate.
 *
 * Why this exists: while setting up Season 2 the organizers will enter wrong teams,
 * wrong dates and duplicate fixtures. Deleting the season removes the season itself,
 * which is too much — this clears what is inside it and leaves the season row
 * standing, so the slug and the rules survive.
 *
 * Usage:
 *   # Dry run — shows what WOULD be deleted, changes nothing
 *   npm run reset-season --workspace=server -- sppl-2-2027
 *
 *   # Actually delete
 *   npm run reset-season --workspace=server -- sppl-2-2027 --yes
 *
 * Options:
 *   --keep-teams    keep teams and players, remove only matches (and their balls)
 *
 * Requires MONGODB_URI in server/.env.
 */

import "dotenv/config";
import mongoose from "mongoose";
import readline from "node:readline";

import { Season } from "../models/Season.js";
import { Team } from "../models/Team.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";
import { Ball } from "../models/Ball.js";
import { PointsTable } from "../models/PointsTable.js";
import { PlayerStat } from "../models/PlayerStat.js";
import { Award } from "../models/Award.js";

const log = (...args) => console.log("[reset-season]", ...args);

/** Ask before destroying something, unless --yes was passed. */
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (type "yes" to continue): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const identifier = args.find((arg) => !arg.startsWith("--"));
  const autoYes = args.includes("--yes");
  const keepTeams = args.includes("--keep-teams");

  if (!identifier) {
    console.error("\n[reset-season] A season slug or id is required.\n");
    console.log(
      "Usage:  npm run reset-season --workspace=server -- <season-slug> [--yes] [--keep-teams]",
    );
    console.log(
      "Example: npm run reset-season --workspace=server -- sppl-2-2027",
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "[reset-season] MONGODB_URI is not set. Copy server/.env.example to server/.env.",
    );
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  log(`connected to ${mongoose.connection.name}`);

  const isObjectId = /^[a-f\d]{24}$/i.test(identifier);
  const season = await Season.findOne(
    isObjectId
      ? { _id: identifier }
      : { slug: String(identifier).toLowerCase() },
  ).lean();

  if (!season) {
    console.error(`[reset-season] No season found for "${identifier}"`);
    await mongoose.connection.close();
    process.exit(1);
  }

  log("----------------------------------------");
  log(`Season : ${season.nameEn} ${season.seasonNo} (${season.year})`);
  log(`Slug   : ${season.slug}`);
  log(`Status : ${season.status}`);
  log("----------------------------------------");

  // Count everything first so the operator sees exactly what is at stake.
  const matches = await Match.find({ seasonId: season._id })
    .select("_id")
    .lean();
  const matchIds = matches.map((match) => match._id);

  const counts = {
    matches: matches.length,
    balls: matchIds.length
      ? await Ball.countDocuments({ matchId: { $in: matchIds } })
      : 0,
    teams: await Team.countDocuments({ seasonId: season._id }),
    players: await Player.countDocuments({ seasonId: season._id }),
    pointsRows: await PointsTable.countDocuments({ seasonId: season._id }),
    playerStats: await PlayerStat.countDocuments({ seasonId: season._id }),
    awards: await Award.countDocuments({ seasonId: season._id }),
  };

  log("Will be deleted:");
  log(`  matches      : ${counts.matches}`);
  log(`  deliveries   : ${counts.balls}`);
  if (!keepTeams) {
    log(`  teams        : ${counts.teams}`);
    log(`  players      : ${counts.players}`);
  } else {
    log("  teams        : kept (--keep-teams)");
    log("  players      : kept (--keep-teams)");
  }
  log(`  points rows  : ${counts.pointsRows}`);
  log(`  player stats : ${counts.playerStats}`);
  log(`  awards       : ${counts.awards}`);
  log("");
  log(
    `The season row itself is KEPT, so "${season.slug}" and its rules survive.`,
  );

  // A dry run is the default: the safe path is not the one that needs a flag.
  if (!autoYes) {
    log("");
    const proceed = await confirm("Delete the records listed above?");
    if (!proceed) {
      log("Cancelled. Nothing was deleted.");
      await mongoose.connection.close();
      return;
    }
  }

  // Order matters: balls reference matches, so they go first. Deleting matches first
  // would leave deliveries pointing at nothing.
  const deleted = {};

  if (matchIds.length) {
    deleted.balls =
      (await Ball.deleteMany({ matchId: { $in: matchIds } })).deletedCount ?? 0;
  }
  deleted.matches =
    (await Match.deleteMany({ seasonId: season._id })).deletedCount ?? 0;
  deleted.pointsRows =
    (await PointsTable.deleteMany({ seasonId: season._id })).deletedCount ?? 0;
  deleted.playerStats =
    (await PlayerStat.deleteMany({ seasonId: season._id })).deletedCount ?? 0;
  deleted.awards =
    (await Award.deleteMany({ seasonId: season._id })).deletedCount ?? 0;

  if (!keepTeams) {
    deleted.players =
      (await Player.deleteMany({ seasonId: season._id })).deletedCount ?? 0;
    deleted.teams =
      (await Team.deleteMany({ seasonId: season._id })).deletedCount ?? 0;
  }

  // Reset the cached counters so the season does not claim teams it no longer has.
  await Season.findByIdAndUpdate(season._id, {
    teamCount: keepTeams ? counts.teams : 0,
    championTeamId: null,
    runnerUpTeamId: null,
  });

  log("");
  log("Deleted:");
  for (const [key, value] of Object.entries(deleted)) {
    log(`  ${key.padEnd(13)}: ${value}`);
  }
  log("");
  log(
    `Reset complete. "${season.slug}" still exists — re-add its teams and fixtures.`,
  );

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error("\n[reset-season] failed:", error.message);
  try {
    await mongoose.connection.close();
  } catch {
    // Nothing to close.
  }
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Rebuild player statistics for every season.
 *
 * The stats service runs when a match finishes, but a database populated before that
 * service existed has matches with no player rows — which is why a player who has
 * batted shows "no statistics yet" on their profile.
 *
 * Usage:
 *   npm run recompute-stats --workspace=server
 *
 * Safe to run at any time: it rebuilds from match data rather than incrementing, so
 * running it twice changes nothing.
 *
 * Requires MONGODB_URI in server/.env.
 */

import "dotenv/config";
import mongoose from "mongoose";

import { Season } from "../models/Season.js";
import {
  recomputeAllStats,
  recomputeSeasonStats,
} from "../services/statsService.js";

const log = (...args) => console.log("[stats]", ...args);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "[stats] MONGODB_URI is not set. Copy server/.env.example to server/.env.",
    );
    process.exit(1);
  }

  // An optional season slug as the first argument limits the rebuild to one season.
  const seasonSlug = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  log(`connected to ${mongoose.connection.name}`);

  try {
    if (seasonSlug) {
      const season = await Season.findOne({
        slug: String(seasonSlug).toLowerCase(),
      }).lean();
      if (!season) {
        console.error(`[stats] No season found for "${seasonSlug}"`);
        process.exitCode = 1;
        return;
      }

      const result = await recomputeSeasonStats(season._id);
      log("----------------------------------------");
      log(`${season.nameEn} ${season.seasonNo} (${season.year})`);
      log(`  matches read : ${result.matches}`);
      log(`  player rows  : ${result.players}`);
      log("----------------------------------------");
    } else {
      const results = await recomputeAllStats();

      log("----------------------------------------");
      for (const result of results) {
        log(
          `season ${result.seasonId}: ${result.matches} matches, ${result.players} player rows`,
        );
      }
      log("----------------------------------------");
    }

    log("Done. Statistics are rebuilt from match data — safe to run again.");
  } catch (error) {
    console.error("[stats] failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();

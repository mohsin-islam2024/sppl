#!/usr/bin/env node
/**
 * Assign a scorer (and optionally umpires) to a match.
 *
 * Why a script rather than a UI: the scorer selector belongs in the Match manager,
 * but until that field exists an admin needs a way to attach someone — and without an
 * assignment a scorer outside ADMIN would be blocked by `requireAssigned`.
 *
 * Usage:
 *   npm run assign-scorer --workspace=server -- <matchNo> <email> [seasonSlug]
 *
 * Example:
 *   npm run assign-scorer --workspace=server -- 1 scorer@example.com sppl-2-2027
 *
 * Requires MONGODB_URI in server/.env.
 */

import "dotenv/config";
import mongoose from "mongoose";

import { Season } from "../models/Season.js";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";

const log = (...args) => console.log("[assign-scorer]", ...args);

async function main() {
  const [matchNoArg, email, seasonSlug] = process.argv.slice(2);

  if (!matchNoArg || !email) {
    console.error(
      "\n[assign-scorer] A match number and a scorer email are required.\n",
    );
    console.log(
      "Usage:  npm run assign-scorer --workspace=server -- <matchNo> <email> [seasonSlug]",
    );
    console.log(
      "Example: npm run assign-scorer --workspace=server -- 1 scorer@example.com sppl-2-2027",
    );
    process.exit(1);
  }

  const matchNo = Number(matchNoArg);
  if (!Number.isInteger(matchNo) || matchNo < 1) {
    console.error(
      `[assign-scorer] "${matchNoArg}" is not a valid match number`,
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[assign-scorer] MONGODB_URI is not set in server/.env");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  // Without a season slug, work on the newest season that has this match number.
  let season;
  if (seasonSlug) {
    season = await Season.findOne({
      slug: String(seasonSlug).toLowerCase(),
    }).lean();
    if (!season) {
      console.error(`[assign-scorer] No season found for "${seasonSlug}"`);
      await mongoose.connection.close();
      process.exit(1);
    }
  } else {
    season = await Season.findOne({}).sort({ seasonNo: -1 }).lean();
  }

  if (!season) {
    console.error("[assign-scorer] No season exists yet");
    await mongoose.connection.close();
    process.exit(1);
  }

  log(`season: ${season.nameEn} ${season.seasonNo} (${season.year})`);

  const match = await Match.findOne({ seasonId: season._id, matchNo });
  if (!match) {
    console.error(`[assign-scorer] No match ${matchNo} in "${season.slug}"`);
    await mongoose.connection.close();
    process.exit(1);
  }

  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  }).lean();
  if (!user) {
    console.error(
      `[assign-scorer] No SPPL account for "${email}". They must sign in to the site first.`,
    );
    await mongoose.connection.close();
    process.exit(1);
  }

  match.scorerId = user._id;
  await match.save();

  log("----------------------------------------");
  log(`match   : ${matchNo} (${season.slug})`);
  log(`scorer  : ${user.name || user.email} [${user.role}]`);
  log("----------------------------------------");
  log("Done. The scorer can now open /admin/live-scoring for this match.");

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error("\n[assign-scorer] failed:", error.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* nothing to close */
  }
  process.exit(1);
});

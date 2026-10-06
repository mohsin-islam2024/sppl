#!/usr/bin/env node
/**
 * SPPL database seed.
 *
 * Populates MongoDB from the official organizer sheets:
 *
 *   Season 1 (2026) — COMPLETED. Full historical record: 4 teams, the jersey list,
 *                     6 league fixtures and the tournament rules.
 *   Season 2 (2027) — UPCOMING. Created as an empty shell with NO dates, because the
 *                     organizers have not confirmed a date yet, and with no teams,
 *                     because squads are re-confirmed each season.
 *
 * Safe to re-run: every write is an upsert keyed on a stable field, so running it
 * twice does not create duplicate teams or players.
 *
 * Usage:
 *   npm run seed --workspace=server
 *
 * Requires MONGODB_URI in server/.env. No Firebase credentials are needed.
 */

import "dotenv/config";
import mongoose from "mongoose";

import { Season } from "../models/Season.js";
import { Team } from "../models/Team.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";
import { PointsTable } from "../models/PointsTable.js";
import {
  DEFAULT_MATCH_RULES,
  DEFAULT_POINTS_SYSTEM,
} from "@sppl/shared/constants/tournament.js";
import {
  MATCH_STAGE,
  MATCH_STATUS,
} from "@sppl/shared/constants/matchStatus.js";
import { PLAYER_ROLE } from "@sppl/shared/constants/tournament.js";

/* ------------------------------------------------------------------ *
 * Source data — straight from the organizer's sheets.
 * ------------------------------------------------------------------ */

/**
 * Season 1 is FINISHED. It was played on 9–10 January 2026, so its dates are a
 * historical record, not a schedule: nothing on the site should count down to it.
 * Results and points for it are filled in later from the scorer's sheets.
 */
const SEASON_1 = {
  seasonNo: 1,
  year: 2026,
  shortName: "SPPL",
  slug: "sppl-1-2026",
  nameBn: "সোটাহার পশ্চিম পাড়া প্রিমিয়ার লিগ",
  nameEn: "Sotahar Poshchim Para Premier League",
  status: "COMPLETED",
  startDate: new Date("2026-01-09T09:00:00+06:00"),
  endDate: new Date("2026-01-10T18:00:00+06:00"),
  venue: "Sotahar Poshchim Para Ground",
  location: "Sotahar Poshchim Para",
  logoUrl: "/logos/sppl-logo.png",
  matchRules: {
    ...DEFAULT_MATCH_RULES,
    oversPerInnings: 10,
    playersPerSide: 9,
    wideRuns: 1,
    noBallRuns: 1,
    byeRuns: true,
    legByeRuns: true,
    superOverOnTie: true,
    sharePointsIfSuperOverTied: true,
    conductRulesBn: [
      "মাঠের মধ্যে কোনো অশালীন কথা বলা যাবে না।",
      "আম্পায়ারের সাথে উচ্চস্বরে কথা বলা যাবে না।",
      "বাউন্ডারির সাইডে আয়োজক প্রতিনিধির সিদ্ধান্ত চূড়ান্ত।",
      "হাত ঘুরে বা লং দৌড়ে বল করা যাবে না।",
    ],
    conductRulesEn: [
      "No abusive language inside the field of play.",
      "Do not speak loudly with the umpire.",
      "The organizer representative at the boundary gives the final decision on four and out.",
      "Bowling with a slinging arm or off a long run-up is not allowed.",
    ],
  },
  pointsSystem: { ...DEFAULT_POINTS_SYSTEM },
};

/**
 * Season 2 is the upcoming edition and the one the live site is for.
 *
 * `startDate` and `endDate` are deliberately absent: the organizers have not fixed
 * a date yet. Seeding a guessed date would put a wrong countdown on the home page
 * and a wrong date in the fixture list, so the fields stay null until an admin sets
 * them. Everything on the site must therefore tolerate a season with no dates —
 * the countdown hides itself and the "next match" block stays empty.
 *
 * Teams and fixtures for Season 2 are NOT seeded. Squads change between seasons and
 * the four Season 1 teams are not automatically re-entering, so they are created
 * from the admin panel once entries are confirmed.
 */
const SEASON_2 = {
  seasonNo: 2,
  year: 2027,
  shortName: "SPPL",
  slug: "sppl-2-2027",
  nameBn: "সোটাহার পশ্চিম পাড়া প্রিমিয়ার লিগ",
  nameEn: "Sotahar Poshchim Para Premier League",
  status: "UPCOMING",
  startDate: null,
  endDate: null,
  venue: "Sotahar Poshchim Para Ground",
  location: "Sotahar Poshchim Para",
  logoUrl: "/logos/sppl-logo.png",
  matchRules: SEASON_1.matchRules,
  pointsSystem: { ...DEFAULT_POINTS_SYSTEM },
};

/**
 * Teams, with the jersey list as provided.
 *
 * `jerseyConfirmed` mirrors the ✅ marks on the organizer's sheet — useful for the
 * kit order, and honest about which entries are still provisional.
 *
 * Kids sizes are recorded as `"<n>y"` and flagged `isKidsSize`, because a "4 year"
 * shirt is not an adult S/M/L and must be ordered from a different size chart.
 */
const TEAMS = [
  {
    name: "Agni Riders",
    shortName: "AGN",
    slug: "agni-riders",
    themeColor: "#e63946",
    logoUrl: "/logos/agni-riders.png",
    order: 1,
    players: [
      { jerseyName: "DALIM", jerseyNo: 99, size: "XL", confirmed: true },
      { jerseyName: "RAIHAN", jerseyNo: 1, size: "L", confirmed: true },
      { jerseyName: "FORHAD", jerseyNo: 86, size: "M", confirmed: true },
      { jerseyName: "MOHSIN", jerseyNo: 33, size: "M", confirmed: false },
      { jerseyName: "AL AMIN", jerseyNo: 319, size: "XL", confirmed: true },
      { jerseyName: "FORID", jerseyNo: 45, size: "L", confirmed: true },
      { jerseyName: "ANISUR", jerseyNo: 44, size: "L", confirmed: false },
      { jerseyName: "IKBAL", jerseyNo: 21, size: "L", confirmed: true },
      { jerseyName: "KHOKON", jerseyNo: 28, size: "XXL", confirmed: true },
      { jerseyName: "RAFI", jerseyNo: 111, size: "8y", confirmed: true },
      { jerseyName: "FAHIM", jerseyNo: 25, size: "M", confirmed: false },
      { jerseyName: "IBRAHIM", jerseyNo: 95, size: "10y", confirmed: true },
      { jerseyName: "SAKIBUL", jerseyNo: 999, size: "8y", confirmed: true },
      { jerseyName: "ARIYAN", jerseyNo: 1, size: "1y", confirmed: true },
      { jerseyName: "RAISA", jerseyNo: 3, size: "4y", confirmed: true },
      { jerseyName: "RASHEDUL", jerseyNo: 999, size: "XL", confirmed: true },
      { jerseyName: "IMRAN", jerseyNo: 66, size: "M", confirmed: true },
    ],
  },
  {
    name: "Royal Falcons",
    shortName: "RYF",
    slug: "royal-falcons",
    themeColor: "#f5b400",
    logoUrl: "/logos/royal-falcons.png",
    order: 2,
    players: [
      { jerseyName: "SAMSUL", jerseyNo: 20, size: "XL", confirmed: false },
      { jerseyName: "HANIF", jerseyNo: 77, size: "M", confirmed: false },
      // Listed on the squad sheet as "Nayem"; the confirmed spelling is Nayem.
      {
        jerseyName: "NAYEM",
        fullName: "Nayem",
        jerseyNo: 66,
        size: "M",
        confirmed: false,
      },
      { jerseyName: "SOHEL", jerseyNo: 15, size: "L", confirmed: false },
      { jerseyName: "MARUF", jerseyNo: 75, size: "XL", confirmed: false },
      { jerseyName: "WARES", jerseyNo: 39, size: "L", confirmed: false },
      { jerseyName: "NURSHAD", jerseyNo: 38, size: "XXL", confirmed: false },
      { jerseyName: "HARUN", jerseyNo: 0, size: "L", confirmed: false },
      {
        jerseyName: "SHAHADUL",
        fullName: "Sahadul",
        jerseyNo: 28,
        size: "XL",
        confirmed: false,
      },
      {
        jerseyName: "AYAN",
        jerseyNo: 19,
        size: "M",
        confirmed: false,
        note: "size missing on sheet",
      },
      { jerseyName: "KHALID", jerseyNo: 14, size: "S", confirmed: false },
      { jerseyName: "ALIF", jerseyNo: 57, size: "S", confirmed: false },
    ],
  },
  {
    name: "King Shooters",
    shortName: "KGS",
    slug: "king-shooters",
    themeColor: "#1e6fd9",
    logoUrl: "/logos/king-shooters.png",
    order: 3,
    players: [
      { jerseyName: "UZZAL", jerseyNo: 24, size: "XL", confirmed: false },
      {
        jerseyName: "ADV FOYSAL",
        fullName: "Adv Foysal",
        jerseyNo: 26,
        size: "XXL",
        confirmed: false,
      },
      {
        jerseyName: "MD SADDAM",
        fullName: "Md Saddam",
        jerseyNo: 22,
        size: "L",
        confirmed: false,
      },
      { jerseyName: "RAJU", jerseyNo: 25, size: "XL", confirmed: false },
      { jerseyName: "BABU", jerseyNo: 94, size: "M", confirmed: false },
      { jerseyName: "HAYZID", jerseyNo: 99, size: "M", confirmed: false },
      { jerseyName: "SHAHINUR", jerseyNo: 55, size: "M", confirmed: true },
      { jerseyName: "SULTAN", jerseyNo: 47, size: "XL", confirmed: false },
      { jerseyName: "RABIUL", jerseyNo: 11, size: "M", confirmed: false },
      { jerseyName: "MINHAAZ", jerseyNo: 69, size: "12y", confirmed: false },
      { jerseyName: "ABTAHI", jerseyNo: 10, size: "7y", confirmed: false },
      { jerseyName: "MUSHFIQ", jerseyNo: 95, size: "9y", confirmed: false },
      { jerseyName: "ABDULLAH", jerseyNo: 66, size: "11y", confirmed: false },
      { jerseyName: "MUBASSIRA", jerseyNo: 2, size: "2y", confirmed: false },
      { jerseyName: "JAMIL", jerseyNo: 79, size: "XL", confirmed: true },
      { jerseyName: "SARA", jerseyNo: 4, size: "4y", confirmed: true },
      { jerseyName: "ASMA", jerseyNo: 57, size: "4y", confirmed: true },
      { jerseyName: "AIYUB", jerseyNo: 17, size: "L", confirmed: true },
    ],
  },
  {
    name: "Legend Titans",
    shortName: "LGT",
    slug: "legend-titans",
    themeColor: "#22c55e",
    logoUrl: "/logos/legend-titans.jpg",
    order: 4,
    players: [
      {
        jerseyName: "JAHID",
        fullName: "Jahid",
        jerseyNo: 29,
        size: "XL",
        confirmed: false,
      },
      { jerseyName: "MEHEDI", jerseyNo: 99, size: "M", confirmed: false },
      { jerseyName: "AMAN", jerseyNo: 0, size: "M", confirmed: false },
      { jerseyName: "AHSAN", jerseyNo: 10, size: "L", confirmed: false },
      { jerseyName: "SOBUJ", jerseyNo: 100, size: "L", confirmed: false },
      { jerseyName: "SIRAJUL", jerseyNo: 38, size: "M", confirmed: false },
      {
        jerseyName: "FA ARIF",
        fullName: "FA Arif",
        jerseyNo: 75,
        size: "M",
        confirmed: false,
      },
      { jerseyName: "MIJAN", jerseyNo: 62, size: "L", confirmed: false },
      { jerseyName: "IMRAN", jerseyNo: 0, size: "M", confirmed: false },
      {
        jerseyName: "K.I SRABON",
        fullName: "K.I Srabon",
        jerseyNo: 9,
        size: "L",
        confirmed: false,
      },
      { jerseyName: "SHAMIM", jerseyNo: 77, size: "L", confirmed: false },
      { jerseyName: "AYMAN", jerseyNo: 18, size: "5y", confirmed: false },
      { jerseyName: "ABDULLAH", jerseyNo: 11, size: "11y", confirmed: false },
      { jerseyName: "AIYUB", jerseyNo: 13, size: "10y", confirmed: false },
      { jerseyName: "WASFIA", jerseyNo: 8, size: "10y", confirmed: false },
    ],
  },
];

/**
 * Fixtures for SEASON 1 — played on 9 and 10 January 2026.
 *
 * The sheet gave dates only, so kick-off times are evenly spaced placeholders.
 * With Season 1 complete these are a historical record; an admin can correct a
 * time from the Match manager if the real one matters for the archive.
 */
const FIXTURES = [
  {
    matchNo: 1,
    date: "2026-01-09",
    time: "09:00",
    teamA: "agni-riders",
    teamB: "royal-falcons",
  },
  {
    matchNo: 2,
    date: "2026-01-09",
    time: "11:00",
    teamA: "king-shooters",
    teamB: "legend-titans",
  },
  {
    matchNo: 3,
    date: "2026-01-09",
    time: "13:30",
    teamA: "agni-riders",
    teamB: "king-shooters",
  },
  {
    matchNo: 4,
    date: "2026-01-09",
    time: "15:30",
    teamA: "royal-falcons",
    teamB: "legend-titans",
  },
  {
    matchNo: 5,
    date: "2026-01-10",
    time: "09:00",
    teamA: "agni-riders",
    teamB: "legend-titans",
  },
  {
    matchNo: 6,
    date: "2026-01-10",
    time: "11:00",
    teamA: "royal-falcons",
    teamB: "king-shooters",
  },
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** A jersey size is a kids size when it carries a "y" suffix. */
const isKids = (size) => /^\d{1,2}y$/.test(size);

/** Derive a player's role from squad position is unreliable, so default to BATTER. */
const DEFAULT_ROLE = PLAYER_ROLE.BATTER;

const log = (...args) => console.log("[seed]", ...args);

/* ------------------------------------------------------------------ *
 * Seed steps
 * ------------------------------------------------------------------ */

/**
 * Insert or refresh a season document.
 *
 * A null `startDate` is written as-is rather than skipped, so re-running the seed
 * clears a wrong date that was set by hand. Season 2 has no date yet and must stay
 * that way until the organizers announce one.
 */
async function upsertSeason(spec) {
  const season = await Season.findOneAndUpdate(
    { seasonNo: spec.seasonNo, year: spec.year },
    { $set: { ...spec, shortName: spec.shortName, slug: spec.slug } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  log(
    `season ready: ${season.shortName} ${season.seasonNo} (${season.year}) — ${season.status}` +
      (season.startDate ? "" : " — no dates set yet"),
  );
  return season;
}

async function upsertTeamsAndPlayers(season) {
  const teamIdBySlug = new Map();
  let playerCount = 0;

  for (const entry of TEAMS) {
    const team = await Team.findOneAndUpdate(
      { seasonId: season._id, slug: entry.slug },
      {
        $set: {
          name: entry.name,
          shortName: entry.shortName,
          slug: entry.slug,
          logoUrl: entry.logoUrl,
          themeColor: entry.themeColor,
          order: entry.order,
          squadSize: entry.players.length,
          active: true,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    teamIdBySlug.set(entry.slug, team._id);

    for (const [index, player] of entry.players.entries()) {
      await Player.findOneAndUpdate(
        // Jersey number plus team is the stable key within one season.
        { seasonId: season._id, teamId: team._id, jerseyNo: player.jerseyNo },
        {
          $set: {
            fullName: player.fullName ?? player.jerseyName,
            jerseyName: player.jerseyName,
            jerseyNo: player.jerseyNo,
            size: player.size,
            isKidsSize: isKids(player.size),
            role: DEFAULT_ROLE,
            jerseyConfirmed: Boolean(player.confirmed),
            order: index + 1,
            active: true,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
      playerCount += 1;
    }

    log(`team ready: ${entry.name} (${entry.players.length} players)`);
  }

  // Keep the season's team count in sync with what was actually seeded.
  season.teamCount = teamIdBySlug.size;
  await season.save();

  return { teamIdBySlug, playerCount };
}

async function upsertFixtures(season, teamIdBySlug) {
  let created = 0;

  for (const fixture of FIXTURES) {
    const teamAId = teamIdBySlug.get(fixture.teamA);
    const teamBId = teamIdBySlug.get(fixture.teamB);

    if (!teamAId || !teamBId) {
      log(`skipping match ${fixture.matchNo}: team slug not found`);
      continue;
    }

    // Times are local to Dhaka (UTC+6); storing as an ISO string with the offset
    // keeps the intended wall-clock time regardless of the server's timezone.
    const startAt = new Date(`${fixture.date}T${fixture.time}:00+06:00`);

    await Match.findOneAndUpdate(
      { seasonId: season._id, matchNo: fixture.matchNo },
      {
        $set: {
          seasonId: season._id,
          matchNo: fixture.matchNo,
          stage: MATCH_STAGE.LEAGUE,
          teamAId,
          teamBId,
          venue: season.venue,
          startAt,
        },
        // Status is only set when the document is first created, so re-running the
        // seed never resets a match that is already live or finished.
        $setOnInsert: { status: MATCH_STATUS.UPCOMING },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    created += 1;
  }

  log(`fixtures ready: ${created} league matches`);
  return created;
}

async function seedPointsTable(season, teamIdBySlug) {
  for (const teamId of teamIdBySlug.values()) {
    await PointsTable.findOneAndUpdate(
      { seasonId: season._id, teamId },
      { $setOnInsert: { seasonId: season._id, teamId } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  log(`points table rows ready: ${teamIdBySlug.size}`);
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "[seed] MONGODB_URI is not set. Copy server/.env.example to server/.env first.",
    );
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  log(`connected to ${mongoose.connection.name}`);

  try {
    // --- Season 1: finished, full historical data -------------------------
    const season1 = await upsertSeason(SEASON_1);
    const { teamIdBySlug, playerCount } = await upsertTeamsAndPlayers(season1);
    const matchCount = await upsertFixtures(season1, teamIdBySlug);
    await seedPointsTable(season1, teamIdBySlug);

    // --- Season 2: upcoming, dates not announced --------------------------
    // Created with no dates and no teams. Entries and fixtures are added from the
    // admin panel once the organizers confirm them, so nothing here guesses.
    const season2 = await upsertSeason(SEASON_2);

    log("----------------------------------------");
    log(
      `Season 1 : ${season1.nameEn} ${season1.seasonNo} (${season1.year}) — COMPLETED`,
    );
    log(
      `           ${teamIdBySlug.size} teams, ${playerCount} players, ${matchCount} matches`,
    );
    log(
      `Season 2 : ${season2.nameEn} ${season2.seasonNo} (${season2.year}) — UPCOMING`,
    );
    log(
      "           no dates, no teams yet (waiting on organizer confirmation)",
    );
    log("----------------------------------------");
    log(
      "Seed complete. Safe to run again — records are updated, never duplicated.",
    );
    log(
      "Next: set the Season 2 dates and fixtures from the admin panel once announced.",
    );
  } catch (error) {
    console.error("[seed] failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();

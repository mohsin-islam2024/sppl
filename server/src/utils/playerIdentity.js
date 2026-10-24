/**
 * The same person across seasons.
 *
 * Every season has its own set of Player records (a squad is re-confirmed each year),
 * and nothing in the data ties last year's "Aman" to this year's. The only thing they
 * share is the name, so the name is used to find a player's other seasons. That is
 * enough for a village league where names are distinctive, and it fails safe: two
 * different people with the same name would be shown as one player, never silently
 * dropped.
 *
 * Pure functions, so the matching rules can be tested without a database.
 */

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A case-insensitive, whole-name matcher. Surrounding spaces are ignored and a run of
 * spaces inside the name matches any run, so "Md  Saddam" and "md saddam" are one name.
 */
export function nameMatcher(fullName) {
  const words = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp);

  return new RegExp(`^\\s*${words.join("\\s+")}\\s*$`, "i");
}

/**
 * Choose which of a person's season records to show.
 *
 * @param {Array<{ _id, seasonId: { _id } }>} records  every record of this person (populated season)
 * @param {{ ownId: string, requestedSeasonId?: string|null }} options
 * @returns {{ target: object|null, noRecord: boolean }}
 *   `noRecord` is true when a season was asked for and the person has no record in it.
 *   Showing another season's figures in that case would look like the season switch
 *   "did nothing", so the caller says plainly that there is no record instead.
 */
export function pickSeasonRecord(records, { ownId, requestedSeasonId = null }) {
  const own = records.find((record) => String(record._id) === String(ownId)) ?? null;

  if (!requestedSeasonId) return { target: own, noRecord: false };

  const inSeason = records.filter(
    (record) => String(record.seasonId?._id ?? record.seasonId) === String(requestedSeasonId),
  );
  if (inSeason.length === 0) return { target: own, noRecord: true };

  // Two records in one season (a duplicate entry): keep the one the link pointed at.
  const exact = inSeason.find((record) => String(record._id) === String(ownId));
  return { target: exact ?? inSeason[0], noRecord: false };
}

export default { nameMatcher, pickSeasonRecord };

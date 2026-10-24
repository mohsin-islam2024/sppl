/**
 * Who is at the crease, kept as markers on the batting lines.
 *
 * A batter is "at the crease" when he has batted and is not out. Of the two there, the
 * one on strike carries `isStriker`; the other is the non-striker by elimination.
 *
 * This is the single place that moves those markers when the scorer names a striker
 * and/or a non-striker, so the rule can be tested without a database.
 *
 * THE RULE THAT MATTERS: naming only a non-striker must leave the striker alone.
 * The previous version cleared every marker whenever a batting change of any kind
 * came in. A scorer who picks the striker and then the non-striker (which is what
 * the second innings, and any run out at the non-striker's end, calls for) wiped the
 * striker's marker. That left two batters at the crease and nobody on strike, the
 * console showed the striker slot empty, and because he had already batted he was
 * missing from the "who bats" list too.
 *
 * @param {Array<{ playerId, isOut?, isStriker?, hasBatted? }>} lines  innings.batting
 * @param {{ strikerId?: string, nonStrikerId?: string }} selection
 */
export function applyCreaseSelection(lines, { strikerId, nonStrikerId } = {}) {
  if (!strikerId && !nonStrikerId) return;

  for (const line of lines ?? []) {
    if (line.isOut) {
      line.isStriker = false;
      continue;
    }

    const id = String(line.playerId);

    if (strikerId && id === String(strikerId)) {
      line.isStriker = true;
      line.hasBatted = true;
    } else if (nonStrikerId && id === String(nonStrikerId)) {
      line.isStriker = false;
      line.hasBatted = true;
    } else if (strikerId) {
      // A new striker was named, so nobody else keeps the marker. When only a
      // non-striker was named this branch is skipped and the striker is untouched.
      line.isStriker = false;
    }
  }
}

export default { applyCreaseSelection };

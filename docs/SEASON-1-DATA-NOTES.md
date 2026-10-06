# Season 1 — seeded as a finished record

Season 1 was played on **9–10 January 2026** and is over. The seed writes it with
`status: COMPLETED`, so nothing on the site counts down to it — it is history.

Data seeded for Season 1:

| Item | Count |
|---|---:|
| Teams | 4 |
| Players | 47 |
| League matches | 6 |
| Points table rows | 4 |

Results, the champion and the awards are **not** seeded. Those come from the
scorer's sheets and are entered through the admin panel — guessing them would put
false records in the history.

## Season 2 — upcoming, no date yet

A Season 2 shell is created with:

- `status: UPCOMING`
- `startDate: null`, `endDate: null` — **the organizers have not fixed a date**
- **no teams, no fixtures**

This is deliberate. Squads are re-confirmed every season, and inventing a date would
put a wrong countdown on the home page and a wrong date in the fixture list.

### What must therefore work with no dates

The frontend has to tolerate a season whose dates are null:

- The countdown block hides itself instead of rendering `NaN` or a negative timer.
- "Next match" stays empty rather than picking an arbitrary match.
- The season switcher still lists Season 2 and can be navigated to.

When the organizers announce the date, an admin sets it from the Season manager and
the countdown starts on its own — no code change needed.

## Confirmed player names

The organizer confirmed these spellings, and they are what the seed now writes:

| Jersey name | Full name |
|---|---|
| MOHSIN | Mohsin |
| NAYEM | Nayem |
| JAHID | Jahid |

Earlier drafts used `Joni`, `Jahidul` and `Mohshin`; those are superseded.

## Teams and squad sizes

The rule sheet says **9 players per side**, but the jersey sheets list more names:
Agni Riders 17, Royal Falcons 12, King Shooters 18, Legend Titans 15.

The data is seeded as a **squad**, not a playing nine. Each match's IX is selected
separately (`match.playingSquads`), which is what the rules actually require.

## Jersey number conflicts

Within one team, a duplicate jersey number makes two players indistinguishable on
the field and in the scorecard. These are still unresolved:

| Team | Number | Players |
|---|---|---|
| Agni Riders | 999 | SAKIBUL, RASHEDUL |
| Agni Riders | 1 | RAIHAN, ARIYAN |
| Legend Titans | 0 | AMAN, IMRAN |

Seeded with `jerseyNo` NOT unique per team on purpose, so the data loads now and the
duplicates can be fixed in the admin panel rather than blocking the seed.

## Sizes

- **Ayan (Royal Falcons)** has no size on the sheet. Seeded as `M` — please confirm.
- Kids sizes are stored with a `y` suffix (`4y`, `8y`, `11y`, `12y`) and flagged
  `isKidsSize: true`. These must be ordered from a kids size chart, not an adult one.

| Team | Kids shirts on the sheet |
|---|---:|
| Agni Riders | 5 (RAFI, IBRAHIM, SAKIBUL, ARIYAN, RAISA) |
| King Shooters | 7 (MINHAAZ, ABTAHI, MUSHFIQ, ABDULLAH, MUBASSIRA, SARA, ASMA) |
| Legend Titans | 4 (AYMAN, ABDULLAH, AIYUB, WASFIA) |
| Royal Falcons | 0 |

Verify these counts against the sheet before placing a kit order.

## Season 1 fixture times

The sheet gave dates only, so kick-off times are evenly spaced placeholders. With the
season complete these are a historical record, and an admin can correct a time from
the Match manager if the real one matters for the archive.

| Match | Day | Time (placeholder) |
|---:|---|---|
| 1 | 9 Jan 2026 | 09:00 |
| 2 | 9 Jan 2026 | 11:00 |
| 3 | 9 Jan 2026 | 13:30 |
| 4 | 9 Jan 2026 | 15:30 |
| 5 | 10 Jan 2026 | 09:00 |
| 6 | 10 Jan 2026 | 11:00 |

## Final

The sheet says the final is played between the top two teams on the points table, and
no date is given. It is intentionally NOT seeded — for Season 1 the league is already
over, so create it once the result is entered; for Season 2 it is created after the
league stage.

## Rules captured in the season document

- 10 overs per innings
- 9 players per side
- Wide and no-ball: 1 run each
- Byes count
- On a free hit a batter can only be dismissed run out
- A tied match goes to a super over; if the super over is also tied, points are shared
- An organizer representative at the boundary decides four and out, with final say
- No slinging arm and no long run-up when bowling
- Points: win 2, loss 0, tie / no result 1

## Branding assets

Logos live in `client/public/logos/`:

| File | Team |
|---|---|
| `sppl-logo.png` | Tournament crest |
| `agni-riders.png` | Agni Riders |
| `royal-falcons.png` | Royal Falcons |
| `king-shooters.png` | King Shooters |
| `legend-titans.jpg` | Legend Titans |

The Legend Titans and Agni Riders crests were supplied on a **black background**.
They look correct on the dark theme and will show a black box on a light background.
Removing the background is a manual step in an image editor — it is not done
automatically here, because cutting out a complex fire/wing shape needs a human eye
on the edges.

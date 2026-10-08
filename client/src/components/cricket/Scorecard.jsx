import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Full scorecard for one match.
 *
 * Two innings, each with a batting table and a bowling table — the shape a printed
 * scorecard takes, and the one a reader already knows how to read.
 *
 * The innings block carries only a team id, so the side's name comes from the
 * `teamA` / `teamB` the match payload already resolved rather than being looked up
 * again here.
 *
 * Nothing is computed in this component: `buildScorecard` on the server has already
 * resolved the rates and the overs figure, so a figure it sent as null stays a dash
 * rather than becoming a zero in the browser.
 */
export default function Scorecard({ scorecard, teamA = null, teamB = null, lang = 'bn' }) {
  const { t } = useTranslation();
  const innings = scorecard?.innings ?? [];

  // The innings a reader wants first is the one that just finished — usually the
  // second. Defaulting to 0 would make them tap every time.
  const [activeIndex, setActiveIndex] = useState(() =>
    scorecard?.currentInnings ?? Math.max(0, innings.length - 1),
  );

  /** The name of the side batting in an innings, from the two teams on the match. */
  const teamNameFor = (teamId) => {
    const id = String(teamId ?? '');
    if (!id) return '';
    if (String(teamA?.id ?? '') === id) return teamA?.name ?? '';
    if (String(teamB?.id ?? '') === id) return teamB?.name ?? '';
    return '';
  };

  if (!innings.length) {
    return (
      <div className="card p-6 text-center text-sm text-content-muted">
        {t('scorecard.notStarted')}
      </div>
    );
  }

  const active = innings[Math.min(activeIndex, innings.length - 1)];
  const battingTeamName =
    teamNameFor(active.battingTeamId) || t('scorecard.inningsNo', { n: activeIndex + 1 });

  return (
    <div className="space-y-4">
      {/* Innings tabs */}
      {innings.length > 1 && (
        <div role="tablist" className="flex flex-wrap gap-2 border-b border-surface-border">
          {innings.map((entry, index) => (
            <button
              key={entry.index ?? index}
              role="tab"
              type="button"
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                index === activeIndex
                  ? 'border-brand text-brand-light'
                  : 'border-transparent text-content-muted hover:text-content-primary'
              }`}
            >
              {teamNameFor(entry.battingTeamId) || t('scorecard.inningsNo', { n: index + 1 })}
              <span className="tabular ml-2 text-xs text-content-muted">
                {toBengaliDigits(entry.runs ?? 0)}/{toBengaliDigits(entry.wickets ?? 0)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Score line */}
      <div className="card flex flex-wrap items-baseline justify-between gap-2 p-4">
        <div>
          <p className="font-display text-lg font-bold text-content-primary">{battingTeamName}</p>
          <p className="text-sm text-content-muted">
            {t('scorecard.overs')}: {toBengaliDigits(active.overs ?? 0)}
          </p>
        </div>
        <p className="tabular font-display text-2xl font-bold text-gold">
          {toBengaliDigits(active.runs ?? 0)}/{toBengaliDigits(active.wickets ?? 0)}
        </p>
      </div>

      {/* Batting */}
      <section className="card overflow-hidden">
        <h3 className="border-b border-surface-border px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-content-secondary">
          {t('scorecard.batting')}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-surface-border text-2xs uppercase tracking-wider text-content-muted">
                <th className="px-4 py-2 text-left font-semibold">{t('scorecard.batter')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.runsShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.ballsShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.foursShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.sixesShort')}</th>
                <th className="px-4 py-2 text-right font-semibold">{t('scorecard.srShort')}</th>
              </tr>
            </thead>
            <tbody>
              {(active.batting ?? []).map((line) => (
                <tr
                  key={String(line.player?.id)}
                  className="border-b border-surface-border last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <PlayerName player={line.player} />
                    <span className="mt-0.5 block text-xs text-content-muted">
                      {dismissalText(line, t)}
                    </span>
                  </td>
                  <td className="tabular px-2 py-2.5 text-right font-semibold text-content-primary">
                    {toBengaliDigits(line.runs ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.balls ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.fours ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.sixes ?? 0)}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-content-secondary">
                    {line.strikeRate === null || line.strikeRate === undefined
                      ? '—'
                      : toBengaliDigits(line.strikeRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Extras + total */}
        <div className="space-y-1 border-t border-surface-border px-4 py-3 text-sm">
          <p className="flex flex-wrap justify-between gap-2 text-content-secondary">
            <span>{t('scorecard.extras')}</span>
            <span className="tabular">
              {toBengaliDigits(active.extras?.total ?? 0)}
              <span className="ml-2 text-xs text-content-muted">
                ({t('scorecard.widesShort')} {toBengaliDigits(active.extras?.wides ?? 0)},{' '}
                {t('scorecard.noBallsShort')} {toBengaliDigits(active.extras?.noBalls ?? 0)},{' '}
                {t('scorecard.byes')} {toBengaliDigits(active.extras?.byes ?? 0)},{' '}
                {t('scorecard.legByes')} {toBengaliDigits(active.extras?.legByes ?? 0)})
              </span>
            </span>
          </p>
          <p className="flex justify-between font-semibold text-content-primary">
            <span>{t('scorecard.total')}</span>
            <span className="tabular">
              {toBengaliDigits(active.runs ?? 0)}/{toBengaliDigits(active.wickets ?? 0)}{' '}
              <span className="text-xs font-normal text-content-muted">
                ({toBengaliDigits(active.overs ?? 0)} {t('scorecard.oversShort')})
              </span>
            </span>
          </p>
        </div>

        {/* Did not bat */}
        {(active.didNotBat ?? []).length > 0 && (
          <div className="border-t border-surface-border px-4 py-3 text-sm">
            <p className="text-2xs font-semibold uppercase tracking-wider text-content-muted">
              {t('scorecard.didNotBat')}
            </p>
            <p className="mt-1 text-content-secondary">
              {(active.didNotBat ?? [])
                .map((player) => player?.name ?? player?.fullName)
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        )}
      </section>

      {/* Bowling */}
      <section className="card overflow-hidden">
        <h3 className="border-b border-surface-border px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-content-secondary">
          {t('scorecard.bowling')}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-surface-border text-2xs uppercase tracking-wider text-content-muted">
                <th className="px-4 py-2 text-left font-semibold">{t('scorecard.bowler')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.oversShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.maidensShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.runsShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.wicketsShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.widesShort')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('scorecard.noBallsShort')}</th>
                <th className="px-4 py-2 text-right font-semibold">{t('scorecard.economyShort')}</th>
              </tr>
            </thead>
            <tbody>
              {(active.bowling ?? []).map((line) => (
                <tr
                  key={String(line.player?.id)}
                  className="border-b border-surface-border last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <PlayerName player={line.player} />
                    {line.isBowling && (
                      <span className="ml-1.5 text-gold" aria-label="current bowler">
                        •
                      </span>
                    )}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.overs ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.maidens ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.runs ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right font-semibold text-content-primary">
                    {toBengaliDigits(line.wickets ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.wides ?? 0)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-content-secondary">
                    {toBengaliDigits(line.noBalls ?? 0)}
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-content-secondary">
                    {line.economy === null || line.economy === undefined
                      ? '—'
                      : toBengaliDigits(line.economy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Player name, linked to the profile when the server resolved one. */
function PlayerName({ player }) {
  const name = player?.name || player?.jerseyName || player?.fullName || '—';
  if (player?.id) {
    return (
      <Link
        to={`/players/${player.id}`}
        className="font-medium text-content-primary hover:text-brand-light"
      >
        {name}
      </Link>
    );
  }
  return <span className="font-medium text-content-primary">{name}</span>;
}

/**
 * How a batter got out, in the reading order a scorecard uses: "c Fielder b Bowler".
 * Not out and did-not-bat are distinct states and say so.
 */
function dismissalText(line, t) {
  if (!line.isOut) return t('scorecard.notOut');
  if (!line.dismissalType) return t('scorecard.out');

  const bowler = line.dismissedBy?.name ?? '';
  const fielder = line.fielder?.name ?? '';

  switch (line.dismissalType) {
    case 'BOWLED':
      return `b ${bowler}`;
    case 'CAUGHT':
      return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
    case 'LBW':
      return `lbw b ${bowler}`;
    case 'RUN_OUT':
      return fielder ? `run out (${fielder})` : 'run out';
    case 'STUMPED':
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case 'HIT_WICKET':
      return `hit wicket b ${bowler}`;
    default:
      return t('scorecard.out');
  }
}

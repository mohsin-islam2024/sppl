import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import { PrimaryButton } from '../../components/admin/AdminTable.jsx';
import { ErrorState, Skeleton } from '../../components/common/Skeleton.jsx';
import { useMatch } from '../../hooks/useMatches.js';
import { useRecordSuperOver } from '../../hooks/useAdminOps.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Record the super over of a tied match.
 *
 * A super over is one over each, entered here as the two scores. The page shows what
 * the result will be before anything is saved, because the outcome decides a
 * league point or the championship and should never be a surprise after the click.
 *
 * It mirrors the rule the server enforces: more runs wins; level in a league match
 * shares the points; level in a knockout needs the organisers to name the winner.
 * The server re-checks all of it, so this preview is a convenience, not the authority.
 */

const inputClass =
  'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

export default function SuperOver() {
  const { matchId } = useParams();
  const { t } = useTranslation();

  const { data: match, isLoading, isError, error, refetch } = useMatch(matchId);
  const record = useRecordSuperOver(matchId);

  const [firstTeamId, setFirstTeamId] = useState('');
  const [runs, setRuns] = useState({ first: '', second: '' });
  const [wickets, setWickets] = useState({ first: '', second: '' });
  const [tiebreak, setTiebreak] = useState('');
  const [banner, setBanner] = useState(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError || !match) {
    return <ErrorState message={error?.message ?? t('scoring.matchNotFound')} onRetry={refetch} />;
  }

  const teams = [match.teamA, match.teamB].filter(Boolean);
  const title = `${match.teamA?.shortName ?? ''} vs ${match.teamB?.shortName ?? ''}`;
  const [inningsOne, inningsTwo] = match.innings ?? [];
  const isTied =
    match.status === 'COMPLETED' && inningsOne && inningsTwo && inningsOne.runs === inningsTwo.runs;
  const isKnockout = match.stage !== 'LEAGUE';

  // Who batted first defaults to the first team until the scorer says otherwise.
  const firstId = String(firstTeamId || teams[0]?.id || '');
  const secondTeam = teams.find((team) => String(team.id) !== firstId);
  const firstTeam = teams.find((team) => String(team.id) === firstId);

  const number = (value) => (value === '' ? NaN : Number(value));
  const complete =
    [runs.first, runs.second, wickets.first, wickets.second].every((value) => value !== '') &&
    [runs.first, runs.second, wickets.first, wickets.second].every((value) => Number.isInteger(number(value)) && number(value) >= 0);

  let preview = null;
  if (complete && firstTeam && secondTeam) {
    if (number(runs.first) > number(runs.second)) preview = { winner: firstTeam };
    else if (number(runs.second) > number(runs.first)) preview = { winner: secondTeam };
    else if (isKnockout) preview = { needsChoice: true };
    else preview = { shared: true };
  }

  const canSubmit =
    isTied && preview && !(preview.needsChoice && !tiebreak) && !record.isPending;

  const onSubmit = async (event) => {
    event.preventDefault();
    setBanner(null);
    try {
      await record.mutateAsync({
        first: { teamId: firstTeam.id, runs: number(runs.first), wickets: number(wickets.first) },
        second: { teamId: secondTeam.id, runs: number(runs.second), wickets: number(wickets.second) },
        ...(preview?.needsChoice && tiebreak ? { tiebreakWinnerTeamId: tiebreak } : {}),
      });
      setBanner({ tone: 'success', text: t('admin.superOverSaved') });
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? t('admin.saveFailed') });
    }
  };

  return (
    <>
      <SEO title={t('match.superOver')} noIndex />
      <AdminPageHeader
        title={`${t('match.superOver')}: ${title}`}
        description={t('admin.superOverHelp')}
      />

      {banner && (
        <div
          role="status"
          className={`mb-5 rounded-lg border px-3.5 py-3 text-sm ${
            banner.tone === 'error'
              ? 'border-live/30 bg-live/10 text-live-light'
              : 'border-win/30 bg-win/10 text-win'
          }`}
        >
          {banner.text}
        </div>
      )}

      {!isTied ? (
        <div className="card p-6 text-sm text-content-secondary">{t('admin.superOverNotTied')}</div>
      ) : (
        <form onSubmit={onSubmit} className="card max-w-2xl space-y-5 p-5">
          <div className="rounded-lg bg-surface-sunken px-3.5 py-3 text-sm text-content-secondary">
            <p className="font-semibold text-content-primary">{t('admin.regularInnings')}</p>
            <p className="tabular mt-1">
              {match.teamA?.shortName} {toBengaliDigits(inningsOne.runs)}/{toBengaliDigits(inningsOne.wickets)} · {match.teamB?.shortName}{' '}
              {toBengaliDigits(inningsTwo.runs)}/{toBengaliDigits(inningsTwo.wickets)}
            </p>
            {match.result?.textEn && <p className="mt-1 text-xs text-content-muted">{match.result.textEn}</p>}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-content-secondary">
              {t('admin.battedFirst')}
            </span>
            <select value={firstId} onChange={(event) => setFirstTeamId(event.target.value)} className={inputClass}>
              {teams.map((team) => (
                <option key={team.id} value={String(team.id)}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          {[
            { key: 'first', team: firstTeam, label: t('admin.battedFirst') },
            { key: 'second', team: secondTeam, label: t('admin.battedSecond') },
          ].map((side) => (
            <fieldset key={side.key} className="rounded-lg border border-surface-border p-3.5">
              <legend className="px-1.5 text-sm font-semibold text-content-primary">
                {side.label}: {side.team?.name}
              </legend>
              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-content-muted">{t('match.runs')}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="200"
                    value={runs[side.key]}
                    onChange={(event) => setRuns((current) => ({ ...current, [side.key]: event.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-content-muted">{t('match.wickets')}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="10"
                    value={wickets[side.key]}
                    onChange={(event) => setWickets((current) => ({ ...current, [side.key]: event.target.value }))}
                    className={inputClass}
                  />
                </label>
              </div>
            </fieldset>
          ))}

          {preview?.needsChoice && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-content-secondary">
                {t('admin.tiebreakWinner')}
              </span>
              <select value={tiebreak} onChange={(event) => setTiebreak(event.target.value)} className={inputClass}>
                <option value="">{t('admin.noneSelected')}</option>
                {teams.map((team) => (
                  <option key={team.id} value={String(team.id)}>
                    {team.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-2xs text-content-muted">{t('admin.superOverNeedsWinner')}</span>
            </label>
          )}

          {preview && !preview.needsChoice && (
            <p className="rounded-lg bg-brand/10 px-3.5 py-3 text-sm font-semibold text-brand-light">
              {preview.winner
                ? t('admin.superOverWinner', { team: preview.winner.name })
                : t('admin.superOverSharedPoints')}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <PrimaryButton type="submit" disabled={!canSubmit}>
              {record.isPending ? t('common.loading') : t('admin.recordSuperOver')}
            </PrimaryButton>
            <Link
              to="/admin/matches"
              className="rounded-pill border border-surface-border px-4 py-2.5 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken"
            >
              {t('admin.backToMatches')}
            </Link>
          </div>
        </form>
      )}
    </>
  );
}

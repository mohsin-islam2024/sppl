import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import MatchStatusBadge from '../../components/cricket/MatchStatusBadge.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useScorableMatches } from '../../hooks/useScoring.js';
import { formatDate, toBengaliDigits } from '../../utils/format.js';

/**
 * Live scoring — match picker.
 *
 * Lists the matches a scorer can open tonight. The console itself lives at
 * `/admin/live-scoring/:matchId`, so choosing a match is a navigation rather than a
 * state change: a scorer can bookmark their match and reload without losing it.
 *
 * Upcoming matches are listed alongside live ones, because the first thing a scorer
 * does at the ground is open the match and start it.
 */
export default function LiveScoring() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { season, identifier, isLoading: seasonLoading } = useActiveSeason();
  const { data: matches = [], isLoading, isError, error, refetch } = useScorableMatches(season?.id);

  const live = matches.filter((match) => match.status === 'LIVE' || match.status === 'INNINGS_BREAK');
  const upcoming = matches.filter((match) => match.status === 'UPCOMING' || match.status === 'TOSS');

  const activeMatchId = searchParams.get('match');

  return (
    <>
      <SEO title={t('admin.liveScoring')} noIndex />

      <AdminPageHeader
        title={t('admin.liveScoring')}
        description={t('admin.liveScoringHelp')}
      />

      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : isLoading || seasonLoading ? (
        <div className="card p-8 text-center text-sm text-content-muted">{t('common.loading')}</div>
      ) : !matches.length ? (
        <EmptyState
          variant={season?.status === 'COMPLETED' ? 'noResults' : 'notStarted'}
          title={t('admin.noScorableMatchesTitle')}
          description={t('admin.noScorableMatchesBody')}
          action={
            <Link
              to="/admin/matches"
              className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              {t('admin.matches')}
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {live.length > 0 && (
            <section aria-labelledby="live-heading">
              <h2
                id="live-heading"
                className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-live"
              >
                {t('home.liveNow')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {live.map((match) => (
                  <MatchPicker
                    key={match._id}
                    match={match}
                    isActive={activeMatchId === match._id}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <h2
                id="upcoming-heading"
                className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-content-muted"
              >
                {t('fixtures.tabUpcoming')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((match) => (
                  <MatchPicker
                    key={match._id}
                    match={match}
                    isActive={activeMatchId === match._id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** One match in the picker. */
function MatchPicker({ match, isActive }) {
  const { t } = useTranslation();

  const teamA = match.teamAId;
  const teamB = match.teamBId;

  return (
    <Link
      to={`/admin/live-scoring/${match._id}`}
      className={`card flex flex-col p-4 transition hover:border-brand/40 ${
        isActive ? 'border-brand/60' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold text-content-muted">
          {t('match.matchNo', { number: toBengaliDigits(match.matchNo) })}
        </span>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="truncate text-sm font-medium text-content-primary">
          {teamA?.name ?? '—'}
        </p>
        <p className="truncate text-sm font-medium text-content-primary">
          {teamB?.name ?? '—'}
        </p>
      </div>

      <p className="mt-3 text-xs text-content-muted">
        {formatDate(match.startAt, 'bn', { withYear: false, withTime: true })}
      </p>

      <span className="mt-3 text-xs font-semibold text-brand-light">
        {t('admin.openConsole')} →
      </span>
    </Link>
  );
}

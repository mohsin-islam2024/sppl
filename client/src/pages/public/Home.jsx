import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import MatchCard from '../../components/cricket/MatchCard.jsx';
import PointsTable from '../../components/cricket/PointsTable.jsx';
import TeamCard from '../../components/cricket/TeamCard.jsx';
import {
  MatchCardSkeleton,
  TableSkeleton,
  GridSkeleton,
  ErrorState,
} from '../../components/common/Skeleton.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonSummary, useSeasonTeams, useSeasonRealtime } from '../../hooks/useSeason.js';
import { usePointsTable } from '../../hooks/usePointsTable.js';
import { formatCountdown, toBengaliDigits } from '../../utils/format.js';

/**
 * Home page.
 *
 * The layout follows what the two seasons actually are:
 *
 *   Season 1 (COMPLETED, Jan 2026) — a finished tournament, so the page leads with
 *     what happened: the latest result, the final standings.
 *   Season 2 (UPCOMING, no date)  — nothing played and no date announced, so there is
 *     no countdown and no fixture to show. The page leads with the entrants and says
 *     plainly that the schedule is not fixed yet.
 *
 * Both render from the same components; only the ordering and the empty states differ.
 * The countdown hides itself when the season has no dates, which is Season 2's state.
 */
export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const {
    season,
    identifier,
    isLoading: seasonLoading,
    error: seasonError,
    hasSchedule,
    isArchived,
  } = useActiveSeason();

  // Join the season room so standings and results refresh on match day without a reload.
  useSeasonRealtime(season?.id);

  const summaryQuery = useSeasonSummary(identifier);
  const pointsQuery = usePointsTable({ season: identifier, seasonId: season?.id });
  const teamsQuery = useSeasonTeams(identifier);

  const summary = summaryQuery.data;
  const standings = pointsQuery.data?.table ?? [];

  const isLoading = seasonLoading || summaryQuery.isLoading;

  if (seasonError || summaryQuery.isError) {
    return (
      <>
        <SEO title={t('common.appName')} path="/" />
        <div className="container-page py-16">
          <ErrorState
            message={summaryQuery.error?.message}
            onRetry={() => summaryQuery.refetch()}
          />
        </div>
      </>
    );
  }

  const countdown = hasSchedule ? formatCountdown(season?.startDate, lang) : null;

  return (
    <>
      <SEO
        title={
          season
            ? `${season.shortName} ${season.seasonNo} · ${season.year}`
            : t('common.appName')
        }
        description={t('home.heroSubtitle')}
        path="/"
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-surface-border bg-surface-sunken">
        <div className="container-page py-12 sm:py-16">
          <p className="text-2xs font-bold uppercase tracking-[0.2em] text-gold">
            {season
              ? `${season.shortName} · ${t('common.seasonShort', { number: toBengaliDigits(season.seasonNo) })} · ${toBengaliDigits(season.year)}`
              : t('home.heroEyebrow')}
          </p>

          <h1 className="mt-3 max-w-3xl text-balance font-display text-3xl font-extrabold leading-tight text-content-primary sm:text-5xl">
            {t('home.heroTitle')}
          </h1>

          <p className="mt-4 max-w-2xl text-base text-content-secondary sm:text-lg">
            {t('home.heroSubtitle')}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={`/fixtures${identifier ? `?season=${identifier}` : ''}`}
              className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              {t('home.viewFixtures')}
            </Link>
            <Link
              to={`/points-table${identifier ? `?season=${identifier}` : ''}`}
              className="rounded-pill border border-surface-border bg-surface-raised px-5 py-2.5 text-sm font-semibold text-content-primary transition hover:bg-surface-base"
            >
              {t('home.viewPointsTable')}
            </Link>
          </div>

          {countdown && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-pill bg-gold/15 px-4 py-2 text-sm font-bold text-gold-dark">
              <span aria-hidden="true">🏏</span>
              {countdown}
            </p>
          )}

          {!isLoading && summary?.stats && (
            <dl className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <StatCard label={t('home.statTeams')} value={summary.stats.teams} />
              <StatCard label={t('home.statPlayers')} value={summary.stats.players} />
              <StatCard label={t('home.statMatches')} value={summary.stats.matches} />
            </dl>
          )}
        </div>
      </section>

      <div className="container-page space-y-12 py-12">
        {/* Live match first — nothing else matters while a match is being played. */}
        {summary?.liveMatch && (
          <section aria-labelledby="live-heading">
            <h2 id="live-heading" className="mb-4 font-display text-xl font-bold text-content-primary">
              {t('home.liveNow')}
            </h2>
            <MatchCard match={summary.liveMatch} showStage />
          </section>
        )}

        {/* Finished season: what happened leads the page. */}
        {isArchived && (
          <>
            {summary?.latestResult && (
              <section aria-labelledby="latest-heading">
                <h2
                  id="latest-heading"
                  className="mb-4 font-display text-xl font-bold text-content-primary"
                >
                  {t('home.latestResult')}
                </h2>
                <MatchCard match={summary.latestResult} showStage />
              </section>
            )}

            <section aria-labelledby="standings-heading">
              <div className="mb-4 flex items-center justify-between">
                <h2
                  id="standings-heading"
                  className="font-display text-xl font-bold text-content-primary"
                >
                  {t('home.finalStandings')}
                </h2>
                <Link
                  to={`/points-table?season=${identifier}`}
                  className="text-sm font-semibold text-brand-light hover:underline"
                >
                  {t('common.viewAll')}
                </Link>
              </div>
              {pointsQuery.isLoading ? (
                <TableSkeleton rows={4} columns={7} />
              ) : standings.length ? (
                <PointsTable table={standings} highlightTop={2} />
              ) : (
                <EmptyState variant="noResults" />
              )}
            </section>
          </>
        )}

        {/* Upcoming season: what is next, and an honest note when no date exists. */}
        {!isArchived && (
          <section aria-labelledby="next-heading">
            <h2 id="next-heading" className="mb-4 font-display text-xl font-bold text-content-primary">
              {t('home.nextMatch')}
            </h2>

            {summaryQuery.isLoading ? (
              <MatchCardSkeleton />
            ) : summary?.nextMatch ? (
              <MatchCard match={summary.nextMatch} showStage />
            ) : (
              <EmptyState variant="noDates" />
            )}
          </section>
        )}

        {/* Teams */}
        <section aria-labelledby="teams-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="teams-heading" className="font-display text-xl font-bold text-content-primary">
              {t('nav.teams')}
            </h2>
            <Link
              to={`/teams${identifier ? `?season=${identifier}` : ''}`}
              className="text-sm font-semibold text-brand-light hover:underline"
            >
              {t('common.viewAll')}
            </Link>
          </div>

          {teamsQuery.isLoading ? (
            <GridSkeleton count={4} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" />
          ) : teamsQuery.data?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {teamsQuery.data.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          ) : (
            <EmptyState variant="noTeams" />
          )}
        </section>

        {/* Standings shortcut for the upcoming season. */}
        {!isArchived && (
          <section aria-labelledby="table-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="table-heading" className="font-display text-xl font-bold text-content-primary">
                {t('home.pointsTable')}
              </h2>
              <Link
                to={`/points-table${identifier ? `?season=${identifier}` : ''}`}
                className="text-sm font-semibold text-brand-light hover:underline"
              >
                {t('common.viewAll')}
              </Link>
            </div>

            {pointsQuery.isLoading ? (
              <TableSkeleton rows={4} columns={7} />
            ) : standings.length && pointsQuery.data?.progress?.hasPlayedAny ? (
              <PointsTable table={standings} highlightTop={2} />
            ) : (
              <EmptyState variant="notStarted" />
            )}
          </section>
        )}
      </div>
    </>
  );
}

/** A single statistic tile in the hero. */
function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <dt className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
        {label}
      </dt>
      <dd className="tabular mt-1 font-display text-2xl font-extrabold text-content-primary">
        {toBengaliDigits(value ?? 0)}
      </dd>
    </div>
  );
}

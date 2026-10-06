import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import MatchCard from '../../components/cricket/MatchCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { MatchCardSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonFixtures } from '../../hooks/useSeason.js';

/**
 * Results page.
 *
 * Exists as its own route rather than as a filter on the fixtures page, because
 * `/results` is the link people send after a match. It is the same underlying data,
 * filtered to completed matches, sorted newest first.
 */
export default function Results() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { season, identifier, isLoading: seasonLoading, isArchived, hasSchedule } = useActiveSeason();

  const { data: matches = [], isLoading, isError, error, refetch } = useSeasonFixtures(identifier, {
    status: 'COMPLETED,ABANDONED',
    limit: 100,
  });

  // Newest first: a results page is read backwards from the most recent match.
  const ordered = [...matches].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );

  const emptyVariant = () => {
    if (isArchived) return 'noResults';
    if (!hasSchedule && season?.status === 'UPCOMING') return 'noDates';
    return 'notStarted';
  };

  return (
    <>
      <SEO title={t('nav.results')} description={t('results.seoDescription')} path="/results" />

      <PageHeader
        title={t('nav.results')}
        subtitle={
          season
            ? t('results.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
        actions={
          <Link
            to={`/fixtures${identifier ? `?season=${identifier}` : ''}`}
            className="rounded-pill border border-surface-border bg-surface-raised px-4 py-2 text-sm font-semibold text-content-primary transition hover:bg-surface-sunken"
          >
            {t('nav.fixtures')}
          </Link>
        }
      />

      <div className="container-page py-8">
        {isLoading || seasonLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <MatchCardSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : ordered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((match) => (
              <MatchCard key={match.id} match={match} showStage />
            ))}
          </div>
        ) : (
          <EmptyState variant={emptyVariant()} />
        )}
      </div>
    </>
  );
}

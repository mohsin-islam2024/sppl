import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import MatchCard from '../../components/cricket/MatchCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { MatchCardSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonFixtures } from '../../hooks/useSeason.js';

/**
 * Fixtures page.
 *
 * The filter is a set of links rather than a dropdown, because each one is a
 * shareable URL — "here are the remaining matches" is a link people actually send
 * to each other in a messenger group.
 */
export default function Fixtures() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { season, identifier, isLoading: seasonLoading, isArchived, hasSchedule } = useActiveSeason();

  // The filter lives in the URL, so a filtered view survives a refresh and a share.
  const view = searchParams.get('view') ?? 'upcoming';

  const filtersByView = {
    upcoming: { status: 'UPCOMING,TOSS' },
    live: { status: 'LIVE,INNINGS_BREAK' },
    results: { status: 'COMPLETED,ABANDONED' },
    all: {},
  };

  const { data: matches = [], isLoading, isError, error, refetch } = useSeasonFixtures(
    identifier,
    filtersByView[view] ?? {},
  );

  const tabs = [
    { key: 'upcoming', label: t('fixtures.tabUpcoming') },
    { key: 'live', label: t('fixtures.tabLive') },
    { key: 'results', label: t('fixtures.tabResults') },
    { key: 'all', label: t('fixtures.tabAll') },
  ];

  /** Build a link that keeps the season but changes the view. */
  const tabLink = (key) => {
    const next = new URLSearchParams();
    if (identifier) next.set('season', identifier);
    next.set('view', key);
    return `?${next.toString()}`;
  };

  const emptyVariant = () => {
    if (view === 'live') return 'default';
    if (view === 'results') return isArchived ? 'noResults' : 'notStarted';
    if (!hasSchedule && season?.status === 'UPCOMING') return 'noDates';
    return 'default';
  };

  return (
    <>
      <SEO title={t('nav.fixtures')} description={t('fixtures.seoDescription')} path="/fixtures" />

      <PageHeader
        title={t('nav.fixtures')}
        subtitle={
          season
            ? t('fixtures.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
      />

      <div className="container-page py-8">
        <nav
          className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1"
          aria-label={t('fixtures.filterLabel')}
        >
          {tabs.map((tab) => {
            const isActive = view === tab.key;
            return (
              <a
                key={tab.key}
                href={tabLink(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'shrink-0 rounded-pill px-4 py-2 text-sm font-semibold transition',
                  isActive
                    ? 'bg-brand text-white'
                    : 'border border-surface-border bg-surface-raised text-content-secondary hover:bg-surface-sunken',
                ].join(' ')}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>

        {isLoading || seasonLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <MatchCardSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : matches.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
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

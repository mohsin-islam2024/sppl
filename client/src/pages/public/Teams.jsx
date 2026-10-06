import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import TeamCard from '../../components/cricket/TeamCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { GridSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonTeams } from '../../hooks/useSeason.js';

/**
 * Teams page.
 *
 * Shows the season's entrants. Season 1 has four; Season 2 has none yet, because
 * entries are confirmed each year rather than carried over — and the empty state says
 * so rather than leaving a blank grid that reads as a broken page.
 */
export default function Teams() {
  const { t } = useTranslation();

  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const { data: teams = [], isLoading, isError, error, refetch } = useSeasonTeams(identifier);

  return (
    <>
      <SEO title={t('nav.teams')} description={t('teams.seoDescription')} path="/teams" />

      <PageHeader
        title={t('nav.teams')}
        subtitle={
          season
            ? t('teams.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
      />

      <div className="container-page py-8">
        {isLoading || seasonLoading ? (
          <GridSkeleton count={4} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : teams.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        ) : (
          <EmptyState variant={isArchived ? 'noResults' : 'noTeams'} />
        )}
      </div>
    </>
  );
}

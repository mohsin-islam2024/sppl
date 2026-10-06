import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import PointsTable from '../../components/cricket/PointsTable.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { TableSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { usePointsTable } from '../../hooks/usePointsTable.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Points table page.
 *
 * The table is rendered exactly as the server returns it, including positions. The
 * client never re-sorts: with a four-team league the points tiebreak decides who
 * plays the final, and two implementations of that rule would eventually disagree.
 */
export default function PointsTablePage() {
  const { t } = useTranslation();

  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const { data, isLoading, isError, error, refetch } = usePointsTable({
    season: identifier,
    seasonId: season?.id,
  });

  const table = data?.table ?? [];
  const progress = data?.progress;

  return (
    <>
      <SEO
        title={t('nav.pointsTable')}
        description={t('pointsTable.seoDescription')}
        path="/points-table"
      />

      <PageHeader title={t('nav.pointsTable')} subtitle={t('pointsTable.subtitle')} />

      <div className="container-page py-8">
        {progress && progress.totalMatches > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-content-muted">
            <span>
              {t('pointsTable.progress', {
                played: toBengaliDigits(progress.completedMatches),
                total: toBengaliDigits(progress.totalMatches),
              })}
            </span>
            {progress.isComplete && (
              <span className="badge bg-win/15 text-win">{t('pointsTable.complete')}</span>
            )}
          </div>
        )}

        {isLoading || seasonLoading ? (
          <TableSkeleton rows={4} columns={7} />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : !table.length ? (
          <EmptyState variant={isArchived ? 'noResults' : 'noTeams'} />
        ) : !progress?.hasPlayedAny ? (
          <>
            {/* A table of zeros is technically correct and completely useless, so the
                real table is held back until at least one match has been played. */}
            <PointsTable table={table} highlightTop={2} />
            <div className="mt-4">
              <EmptyState variant={isArchived ? 'noResults' : 'notStarted'} />
            </div>
          </>
        ) : (
          <PointsTable table={table} highlightTop={2} />
        )}

        <div className="mt-6 card p-5">
          <h2 className="text-sm font-semibold text-content-primary">
            {t('pointsTable.howItWorks')}
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-content-secondary">
            <li>{t('pointsTable.ruleWin')}</li>
            <li>{t('pointsTable.ruleLoss')}</li>
            <li>{t('pointsTable.ruleTie')}</li>
            <li className="text-content-muted">{t('pointsTable.ruleTiebreak')}</li>
          </ul>
        </div>
      </div>
    </>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { TableSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonStats } from '../../hooks/useContent.js';
import { toBengaliDigits, formatRate } from '../../utils/format.js';

/**
 * Season statistics page.
 *
 * Six leaderboards, presented as cards in a single grid rather than as tabs. Tabs
 * would hide five sixths of the page behind a click, and this content is short
 * enough that a visitor scrolling is better served than a visitor choosing.
 */
export default function Stats() {
  const { t } = useTranslation();

  const { season, identifier, isLoading: seasonLoading } = useActiveSeason();
  const { data, isLoading, isError, error, refetch } = useSeasonStats({ season: identifier });

  const boards = [
    {
      key: 'mostRuns',
      title: t('stats.mostRuns'),
      valueKey: 'runs',
      columns: ['matches', 'ballsFaced', 'average', 'strikeRate'],
    },
    {
      key: 'mostWickets',
      title: t('stats.mostWickets'),
      valueKey: 'wickets',
      columns: ['matches', 'ballsBowled', 'economy', 'bestBowling'],
    },
    {
      key: 'bestStrikeRate',
      title: t('stats.bestStrikeRate'),
      valueKey: 'strikeRate',
      columns: ['runs', 'ballsFaced'],
      rateKeys: ['strikeRate'],
    },
    {
      key: 'bestEconomy',
      title: t('stats.bestEconomy'),
      valueKey: 'economy',
      columns: ['wickets', 'ballsBowled', 'runsConceded'],
      rateKeys: ['economy'],
    },
    {
      key: 'bestFielding',
      title: t('stats.bestFielding'),
      valueKey: 'total',
      columns: ['catches', 'runOuts', 'stumpings'],
    },
    {
      key: 'mostAwards',
      title: t('stats.mostAwards'),
      valueKey: 'playerOfMatchAwards',
      columns: ['matches'],
    },
  ];

  const hasAnyData = boards.some((board) => (data?.[board.key] ?? []).length > 0);

  return (
    <>
      <SEO title={t('nav.stats')} description={t('stats.seoDescription')} path="/stats" />

      <PageHeader
        title={t('nav.stats')}
        subtitle={
          season
            ? t('stats.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
      />

      <div className="container-page py-8">
        {isLoading || seasonLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1].map((index) => (
              <TableSkeleton key={index} rows={6} columns={5} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : !hasAnyData ? (
          <EmptyState variant={season?.status === 'COMPLETED' ? 'noResults' : 'notStarted'} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {boards.map((board) => {
              const rows = data?.[board.key] ?? [];
              if (!rows.length) return null;

              return (
                <LeaderboardTable
                  key={board.key}
                  title={board.title}
                  rows={rows}
                  valueKey={board.valueKey}
                  columns={board.columns}
                  rateKeys={board.rateKeys ?? []}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** One leaderboard. */
function LeaderboardTable({ title, rows, valueKey, columns, rateKeys }) {
  const { t } = useTranslation();

  const columnLabels = {
    matches: t('player.matches'),
    ballsFaced: t('player.balls'),
    ballsBowled: t('player.overs'),
    average: t('player.average'),
    strikeRate: t('player.strikeRate'),
    economy: t('player.economy'),
    runs: t('player.runs'),
    runsConceded: t('player.runsConceded'),
    wickets: t('player.wickets'),
    catches: t('player.catches'),
    runOuts: t('player.runOuts'),
    stumpings: t('player.stumpings'),
    bestBowling: t('player.bestBowling'),
    playerOfMatchAwards: t('player.playerOfMatch'),
  };

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-surface-border px-4 py-3 font-display text-sm font-bold text-content-primary">
        {title}
      </h2>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="w-8 text-center">
                #
              </th>
              <th scope="col">{t('table.player')}</th>
              {[valueKey, ...columns.slice(0, 2)].map((column) => (
                <th key={column} scope="col" className="text-center">
                  {columnLabels[column] ?? column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.playerId ?? index}>
                <td className="text-center text-xs font-semibold text-content-muted">
                  {toBengaliDigits(index + 1)}
                </td>

                <td>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-2xs font-bold text-white"
                      style={{ backgroundColor: row.team?.themeColor || '#1e6fd9' }}
                      aria-hidden="true"
                    >
                      {row.team?.shortName?.slice(0, 3) ?? '—'}
                    </span>
                    <Link
                      to={`/players/${row.playerId}`}
                      className="truncate text-sm font-medium text-content-primary hover:text-brand-light"
                    >
                      {t('stats.playerLink')}
                    </Link>
                  </div>
                </td>

                {[valueKey, ...columns.slice(0, 2)].map((column, columnIndex) => (
                  <td
                    key={column}
                    className={`tabular text-center ${
                      columnIndex === 0
                        ? 'font-bold text-content-primary'
                        : 'text-content-secondary'
                    }`}
                  >
                    {formatCell(row, column, rateKeys)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Render one figure, as a rate or as a whole number. */
function formatCell(row, key, rateKeys) {
  const value = row[key];
  if (value === null || value === undefined) return '—';
  if (rateKeys.includes(key)) return formatRate(value);
  if (typeof value === 'number') return toBengaliDigits(value);
  return value;
}

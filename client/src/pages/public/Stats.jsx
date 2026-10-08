import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { TableSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonStats } from '../../hooks/useContent.js';
import { toBengaliDigits, formatRate, initials } from '../../utils/format.js';

/**
 * Season statistics page.
 *
 * Five leaderboards, presented as cards in a single grid rather than as tabs. Tabs
 * would hide four fifths of the page behind a click, and this content is short
 * enough that a visitor scrolling is better served than a visitor choosing.
 *
 * Each row shows the player — name over team — with the team's crest beside it. The
 * ranking is the server's; this page shows the order it is given.
 */
export default function Stats() {
  const { t } = useTranslation();

  const { season, identifier, isLoading: seasonLoading } = useActiveSeason();
  const { data, isLoading, isError, error, refetch } = useSeasonStats({ season: identifier });

  const boards = [
    {
      key: 'mostRuns',
      title: t('stats.mostRuns'),
      valueLabel: t('player.runs'),
      valueKey: 'runs',
      columns: [
        { key: 'matches', label: t('player.matches') },
        { key: 'ballsFaced', label: t('player.balls') },
        { key: 'strikeRate', label: t('player.strikeRate'), rate: true },
      ],
    },
    {
      key: 'mostWickets',
      title: t('stats.mostWickets'),
      valueLabel: t('player.wickets'),
      valueKey: 'wickets',
      columns: [
        { key: 'matches', label: t('player.matches') },
        { key: 'overs', label: t('player.overs') },
        { key: 'economy', label: t('player.economy'), rate: true },
      ],
    },
    {
      key: 'bestStrikeRate',
      title: t('stats.bestStrikeRate'),
      valueLabel: t('player.strikeRate'),
      valueKey: 'strikeRate',
      rateValue: true,
      columns: [
        { key: 'runs', label: t('player.runs') },
        { key: 'ballsFaced', label: t('player.balls') },
      ],
    },
    {
      key: 'bestEconomy',
      title: t('stats.bestEconomy'),
      valueLabel: t('player.economy'),
      valueKey: 'economy',
      rateValue: true,
      columns: [
        { key: 'wickets', label: t('player.wickets') },
        { key: 'overs', label: t('player.overs') },
        { key: 'runsConceded', label: t('player.runsConceded') },
      ],
    },
    {
      key: 'bestFielding',
      title: t('stats.bestFielding'),
      valueLabel: t('stats.dismissals'),
      valueKey: 'total',
      columns: [
        { key: 'catches', label: t('player.catches') },
        { key: 'runOuts', label: t('player.runOuts') },
        { key: 'stumpings', label: t('player.stumpings') },
      ],
    },
    {
      key: 'mostAwards',
      title: t('stats.mostAwards'),
      valueLabel: t('player.playerOfMatch'),
      valueKey: 'playerOfMatchAwards',
      columns: [{ key: 'matches', label: t('player.matches') }],
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

              return <LeaderboardTable key={board.key} {...board} rows={rows} />;
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** One leaderboard. */
function LeaderboardTable({ title, valueLabel, valueKey, rateValue, rows, columns }) {
  const { t } = useTranslation();

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
              <th scope="col" className="text-center">
                {valueLabel}
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="text-center">
                  {column.label}
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
                  <PlayerCell row={row} />
                </td>

                <td className="tabular text-center font-bold text-content-primary">
                  {formatCell(row[valueKey], rateValue ?? false)}
                </td>

                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="tabular text-center text-content-secondary"
                  >
                    {formatCell(row[column.key], column.rate ?? false)}
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

/**
 * The player column: team crest, the player's name, and the team beneath it.
 *
 * The crest is the team's own logo where one has been uploaded, and a coloured badge
 * with the initials where it has not — a blank circle would read as a broken image.
 */
function PlayerCell({ row }) {
  const { t } = useTranslation();
  const name = row.playerName || row.fullName || t('stats.playerLink');
  const teamName = row.team?.name ?? '';
  const shortName = row.team?.shortName ?? '';

  return (
    <div className="flex items-center gap-2.5">
      <TeamCrest row={row} />

      <Link
        to={`/players/${row.playerId}`}
        className="min-w-0 hover:text-brand-light"
      >
        <span className="block truncate text-sm font-medium text-content-primary">
          {name}
          {row.jerseyNo !== null && row.jerseyNo !== undefined && (
            <span className="ml-1.5 text-2xs font-normal text-content-muted">
              #{toBengaliDigits(row.jerseyNo)}
            </span>
          )}
        </span>
        {teamName && (
          <span className="block truncate text-2xs text-content-muted">
            {shortName ? `${shortName} · ` : ''}
            {teamName}
          </span>
        )}
      </Link>
    </div>
  );
}

/** The team's logo, or a coloured badge when no logo has been uploaded. */
function TeamCrest({ row }) {
  const logoUrl = row.team?.logoUrl;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={row.team?.name ?? ''}
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white"
      style={{ backgroundColor: row.team?.themeColor || '#1e6fd9' }}
      aria-hidden="true"
    >
      {initials(row.team?.shortName ?? row.team?.name ?? '')}
    </span>
  );
}

/** Render one figure, as a rate or as a whole number. */
function formatCell(value, isRate) {
  if (value === null || value === undefined) return '—';
  if (isRate) return formatRate(value);
  if (typeof value === 'number') return toBengaliDigits(value);
  return value;
}

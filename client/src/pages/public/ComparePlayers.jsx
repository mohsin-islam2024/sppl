import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import playerService from '../../services/playerService.js';
import { initials, toBengaliDigits, formatRate } from '../../utils/format.js';

/**
 * Player comparison.
 *
 * Two to four players, side by side. The cap at four is not arbitrary: past four
 * columns a comparison table stops being readable on a phone, and this audience
 * reads the site on a phone.
 *
 * The comparison rows are built from a fixed list rather than from whatever fields
 * the API happens to return. That way a missing figure shows as a dash in the right
 * place instead of silently shifting every row, and adding a statistic means editing
 * one array.
 */
export default function ComparePlayers() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const ids = (searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const { data: players = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['players', 'compare', ids],
    queryFn: () => playerService.compare(ids),
    enabled: ids.length >= 2 && ids.length <= 4,
    staleTime: 5 * 60 * 1000,
  });

  const canCompare = ids.length >= 2 && ids.length <= 4;

  const removePlayer = (id) => {
    const next = ids.filter((entry) => entry !== id);
    setSearchParams(next.length ? { ids: next.join(',') } : {}, { replace: true });
  };

  return (
    <>
      <SEO title={t('player.compare')} path="/compare" noIndex />

      <PageHeader
        title={t('player.compare')}
        subtitle={t('compare.subtitle')}
        breadcrumb={[{ label: t('nav.players'), to: '/players' }, { label: t('player.compare') }]}
      />

      <div className="container-page py-8">
        {!canCompare ? (
          <EmptyState
            variant="default"
            title={t('compare.needPlayersTitle')}
            description={t('compare.needPlayersBody')}
            action={
              <Link
                to="/players"
                className="rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                {t('nav.players')}
              </Link>
            }
          />
        ) : isLoading ? (
          <div className="card p-6">
            <div className="grid grid-cols-3 gap-4">
              {ids.map((id) => (
                <div key={id} className="space-y-3">
                  <div className="h-16 w-16 animate-pulse rounded-full bg-surface-sunken" />
                  <div className="h-4 w-24 animate-pulse rounded bg-surface-sunken" />
                </div>
              ))}
            </div>
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : (
          <ComparisonTable players={players} onRemove={removePlayer} />
        )}
      </div>
    </>
  );
}

/**
 * The comparison table.
 *
 * Rendered as a real table with the statistic name in the first column, so a screen
 * reader announces "Most runs, Player A, 312" rather than reading a wall of numbers.
 */
function ComparisonTable({ players, onRemove }) {
  const { t } = useTranslation();

  /** The statistics compared, in display order, grouped by discipline. */
  const sections = [
    {
      title: t('player.batting'),
      rows: [
        { key: 'matches', label: t('player.matches') },
        { key: 'innings', label: t('player.innings') },
        { key: 'runs', label: t('player.runs'), highlight: true },
        { key: 'ballsFaced', label: t('player.ballsFaced') },
        { key: 'highScore', label: t('player.highScore'), score: true },
        { key: 'average', label: t('player.average'), rate: true },
        { key: 'strikeRate', label: t('player.strikeRate'), rate: true },
        { key: 'fours', label: t('player.fours') },
        { key: 'sixes', label: t('player.sixes') },
      ],
    },
    {
      title: t('player.bowling'),
      rows: [
        { key: 'oversBowled', label: t('player.overs') },
        { key: 'wickets', label: t('player.wickets'), highlight: true },
        { key: 'runsConceded', label: t('player.runsConceded') },
        { key: 'economy', label: t('player.economy'), rate: true },
        { key: 'bowlingAverage', label: t('player.bowlingAverage'), rate: true },
        { key: 'maidens', label: t('player.maidens') },
      ],
    },
    {
      title: t('player.fielding'),
      rows: [
        { key: 'catches', label: t('player.catches') },
        { key: 'playerOfMatchAwards', label: t('player.playerOfMatch') },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Identity row */}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">{t('compare.caption')}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t('compare.statistic')}</th>
              {players.map((entry) => (
                <th key={entry.player.id} scope="col">
                  {entry.player.fullName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="w-40 bg-surface-sunken" />
              {players.map((entry) => (
                <td key={entry.player.id} className="text-center align-top">
                  <div className="flex flex-col items-center gap-2 py-1">
                    {entry.player.photoUrl ? (
                      <img
                        src={entry.player.photoUrl}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: entry.team?.themeColor || '#1e6fd9' }}
                        aria-hidden="true"
                      >
                        {initials(entry.player.jerseyName || entry.player.fullName)}
                      </span>
                    )}

                    <div>
                      <Link
                        to={`/players/${entry.player.id}`}
                        className="text-sm font-bold text-content-primary hover:text-brand-light"
                      >
                        {entry.player.jerseyName || entry.player.fullName}
                      </Link>
                      <p className="text-2xs text-content-muted">
                        {entry.team ? `${entry.team.shortName} · ` : ''}#
                        {toBengaliDigits(entry.player.jerseyNo)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(entry.player.id)}
                      className="text-2xs font-medium text-content-muted hover:text-live"
                    >
                      {t('compare.remove')}
                    </button>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Statistics */}
      {sections.map((section) => (
        <div key={section.title} className="card overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">{section.title}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-40">
                  {section.title}
                </th>
                {players.map((entry) => (
                  <th key={entry.player.id} scope="col" className="text-center">
                    {entry.player.jerseyName || entry.player.fullName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="bg-surface-sunken text-left font-medium text-content-secondary"
                  >
                    {row.label}
                  </th>
                  {players.map((entry) => (
                    <td key={entry.player.id} className="text-center">
                      <CompareValue row={row} entry={entry} players={players} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/**
 * One cell, with the leading value marked.
 *
 * "More is better" for runs, wickets and matches; "less is better" for economy. An
 * average and a strike rate are deliberately NOT ranked — with a handful of innings
 * a high strike rate usually just means fewer balls faced, and flagging it as "best"
 * would assert something the numbers do not support.
 */
function CompareValue({ row, entry, players }) {
  const raw = entry.career?.[row.key];

  // A figure that does not exist yet shows as a dash, never a zero.
  if (raw === null || raw === undefined) {
    return <span className="text-content-muted">—</span>;
  }

  const display = row.score
    ? `${toBengaliDigits(raw)}${entry.career.highScoreNotOut ? '*' : ''}`
    : row.rate
      ? formatRate(raw)
      : toBengaliDigits(raw);

  const ranked =
    (row.key === 'runs' || row.key === 'wickets' || row.key === 'economy') && players.length > 1;

  if (!ranked) return <span className="text-content-primary">{display}</span>;

  const values = players
    .map((other) => other.career?.[row.key])
    .filter((value) => value !== null && value !== undefined && Number(value) > 0);

  if (values.length < 2) return <span className="text-content-primary">{display}</span>;

  const best = row.key === 'economy' ? Math.min(...values) : Math.max(...values);
  const isBest = Number(raw) === Number(best);

  return (
    <span className={isBest ? 'font-bold text-gold' : 'text-content-primary'}>{display}</span>
  );
}

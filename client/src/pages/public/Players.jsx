import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import PlayerCard from '../../components/cricket/PlayerCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonTeams } from '../../hooks/useSeason.js';
import playerService from '../../services/playerService.js';

/**
 * Players page.
 *
 * Search and the team filter both live in the URL, so a filtered list is a link that
 * can be shared. The search input debounces by updating the URL rather than by
 * holding a separate piece of state — one source of truth, and a back-button that
 * behaves the way people expect.
 */
export default function Players() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { season, identifier, isLoading: seasonLoading } = useActiveSeason();

  const search = searchParams.get('q') ?? '';
  const teamSlug = searchParams.get('team') ?? '';

  const { data: teams = [] } = useSeasonTeams(identifier);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['players', identifier, { search, teamSlug }],
    queryFn: () =>
      playerService.list({
        season: identifier,
        search: search || undefined,
        team: teamSlug || undefined,
        limit: 100,
      }),
    enabled: Boolean(identifier),
    staleTime: 5 * 60 * 1000,
  });

  const players = data?.items ?? [];

  /** Update one query parameter without dropping the others. */
  const setParam = (key, value) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <>
      <SEO title={t('nav.players')} description={t('players.seoDescription')} path="/players" />

      <PageHeader title={t('nav.players')} subtitle={t('players.subtitle')} />

      <div className="container-page py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="player-search" className="sr-only">
              {t('common.search')}
            </label>
            <input
              id="player-search"
              type="search"
              inputMode="search"
              defaultValue={search}
              onChange={(event) => {
                // A short debounce keeps the URL from changing on every keystroke
                // while still feeling instant.
                const value = event.target.value;
                window.clearTimeout(window.__spplSearchTimer);
                window.__spplSearchTimer = window.setTimeout(() => setParam('q', value), 300);
              }}
              placeholder={t('players.searchPlaceholder')}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3.5 py-2.5 pl-10 text-sm text-content-primary placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
          </div>

          <label className="sm:w-56">
            <span className="sr-only">{t('nav.teams')}</span>
            <select
              value={teamSlug}
              onChange={(event) => setParam('team', event.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm font-medium text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">{t('players.allTeams')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.slug}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(search || teamSlug) && (
          <div className="mb-4 flex items-center gap-3 text-sm text-content-muted">
            <span>{t('players.resultCount', { count: players.length })}</span>
            <button
              type="button"
              onClick={() =>
                setSearchParams(identifier ? { season: identifier } : {}, { replace: true })
              }
              className="font-semibold text-brand-light hover:underline"
            >
              {t('players.clearFilters')}
            </button>
          </div>
        )}

        {isLoading || seasonLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="card flex items-center gap-3 p-3.5">
                <div className="h-12 w-12 animate-pulse rounded-full bg-surface-sunken" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-surface-sunken" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-surface-sunken" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : players.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((entry) => (
              <PlayerCard key={entry.id} player={entry} team={entry.team} showTeam />
            ))}
          </div>
        ) : (
          <EmptyState variant={search || teamSlug ? 'noResults' : 'noTeams'} />
        )}

        <div className="mt-8 text-center">
          <Link to="/stats" className="text-sm font-semibold text-brand-light hover:underline">
            {t('players.viewLeaderboards')} →
          </Link>
        </div>
      </div>
    </>
  );
}

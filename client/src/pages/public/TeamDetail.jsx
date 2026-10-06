import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import PlayerCard from '../../components/cricket/PlayerCard.jsx';
import MatchCard from '../../components/cricket/MatchCard.jsx';
import PointsTable from '../../components/cricket/PointsTable.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import teamService from '../../services/teamService.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Team page.
 *
 * The squad is grouped rather than shown as one flat list. The rules say nine
 * players take the field, and the jersey sheet lists more names than that — so a
 * single list of seventeen would quietly contradict the rules. Captain and
 * vice-captain are marked where the sheet names them.
 */
export default function TeamDetail() {
  const { t } = useTranslation();
  const { slug } = useParams();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['team', slug],
    queryFn: () => teamService.get(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="card p-6">
          <div className="h-8 w-48 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-4 h-4 w-64 animate-pulse rounded bg-surface-sunken" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container-page py-16">
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  const { team, squad = [], standing, matches = [] } = data ?? {};

  const captain = squad.find((player) => player.isCaptain);
  const viceCaptain = squad.find((player) => player.isViceCaptain);
  const completed = matches.filter((match) => match.status === 'COMPLETED');
  const upcoming = matches.filter((match) => match.status !== 'COMPLETED');

  return (
    <>
      <SEO
        title={team?.name ?? t('nav.teams')}
        description={t('team.seoDescription', { team: team?.name ?? '' })}
        path={`/teams/${slug}`}
        structuredData={
          team
            ? {
                '@context': '[schema.org](https://schema.org)',
                '@type': 'SportsTeam',
                name: team.name,
                sport: 'Cricket',
                logo: team.logoUrl || undefined,
              }
            : null
        }
      />

      <PageHeader
        title={team?.name ?? slug}
        subtitle={
          team?.season
            ? `${team.season.shortName} ${team.season.seasonNo} · ${team.season.year}`
            : undefined
        }
        breadcrumb={[{ label: t('nav.teams'), to: '/teams' }, { label: team?.name ?? slug }]}
      />

      <div className="container-page space-y-10 py-8">
        <section className="card flex flex-wrap items-center gap-5 p-5">
          {team?.logoUrl && (
            <img
              src={team.logoUrl}
              alt={team.name}
              width={88}
              height={88}
              className="h-20 w-20 object-contain"
            />
          )}

          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                {t('team.squad')}
              </dt>
              <dd className="tabular font-display text-xl font-bold text-content-primary">
                {toBengaliDigits(squad.length)}
              </dd>
            </div>

            {captain && (
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                  {t('team.captain')}
                </dt>
                <dd className="text-base font-semibold text-content-primary">
                  {captain.jerseyName || captain.fullName}
                </dd>
              </div>
            )}

            {viceCaptain && (
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                  {t('team.viceCaptain')}
                </dt>
                <dd className="text-base font-semibold text-content-primary">
                  {viceCaptain.jerseyName || viceCaptain.fullName}
                </dd>
              </div>
            )}

            {standing && (
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                  {t('team.points')}
                </dt>
                <dd className="tabular font-display text-xl font-bold text-gold">
                  {toBengaliDigits(standing.points)}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section aria-labelledby="squad-heading">
          <h2 id="squad-heading" className="mb-4 font-display text-xl font-bold text-content-primary">
            {t('team.squad')}
          </h2>

          {squad.length ? (
            <>
              <p className="mb-4 text-sm text-content-muted">
                {t('team.squadNote', { count: toBengaliDigits(squad.length) })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {squad.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    team={{ themeColor: team?.themeColor }}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState variant="noTeams" />
          )}
        </section>

        {standing && (
          <section aria-labelledby="standing-heading">
            <h2
              id="standing-heading"
              className="mb-4 font-display text-xl font-bold text-content-primary"
            >
              {t('team.standingRow')}
            </h2>
            <PointsTable table={[{ ...standing, position: 1 }]} compact />
            <p className="mt-2 text-2xs text-content-muted">{t('team.standingNote')}</p>
          </section>
        )}

        {completed.length > 0 && (
          <section aria-labelledby="results-heading">
            <h2
              id="results-heading"
              className="mb-4 font-display text-xl font-bold text-content-primary"
            >
              {t('nav.results')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((match) => (
                <MatchCard key={match.id} match={match} showStage />
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-heading">
            <h2
              id="upcoming-heading"
              className="mb-4 font-display text-xl font-bold text-content-primary"
            >
              {t('nav.fixtures')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((match) => (
                <MatchCard key={match.id} match={match} showStage />
              ))}
            </div>
          </section>
        )}

        <div className="text-center">
          <Link to="/teams" className="text-sm font-semibold text-brand-light hover:underline">
            ← {t('nav.teams')}
          </Link>
        </div>
      </div>
    </>
  );
}

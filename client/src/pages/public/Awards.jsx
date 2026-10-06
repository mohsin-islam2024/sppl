import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { TableSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useAwards } from '../../hooks/useContent.js';

/**
 * Awards page.
 *
 * The order is fixed by the tournament's own hierarchy — champion first, then
 * runner-up, then the individual honours — rather than by date. It comes sorted from
 * the server so this page and any future widget cannot disagree about precedence.
 *
 * Each honour shows the value that earned it where the scorer recorded one, because
 * "Best batter" with no figure invites exactly the argument the award was meant to
 * settle.
 */
export default function Awards() {
  const { t } = useTranslation();
  const lang = document.documentElement.lang === 'bn' ? 'bn' : 'en';

  const { season, identifier, isLoading: seasonLoading, isArchived } = useActiveSeason();
  const { data: awards = [], isLoading, isError, error, refetch } = useAwards({
    season: identifier,
  });

  const AWARD_LABELS = {
    CHAMPION: t('awards.champion'),
    RUNNER_UP: t('awards.runnerUp'),
    MAN_OF_THE_TOURNAMENT: t('awards.manOfTheTournament'),
    BEST_BATTER: t('awards.bestBatter'),
    BEST_BOWLER: t('awards.bestBowler'),
    BEST_FIELDER: t('awards.bestFielder'),
    MAN_OF_THE_MATCH: t('awards.manOfTheMatch'),
    PARTICIPATION_MEDAL: t('awards.participationMedal'),
  };

  const ICONS = {
    CHAMPION: '🏆',
    RUNNER_UP: '🥈',
    MAN_OF_THE_TOURNAMENT: '🏏',
    BEST_BATTER: '🏏',
    BEST_BOWLER: '🏏',
    BEST_FIELDER: '🧤',
    MAN_OF_THE_MATCH: '⭐',
    PARTICIPATION_MEDAL: '👥',
  };

  /** Note in the reader's language, preferring whichever was written. */
  const noteOf = (award) =>
    lang === 'bn' ? award.noteBn || award.noteEn : award.noteEn || award.noteBn;

  return (
    <>
      <SEO title={t('nav.awards')} description={t('awards.seoDescription')} path="/awards" />

      <PageHeader
        title={t('nav.awards')}
        subtitle={
          season
            ? t('awards.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
      />

      <div className="container-page py-8">
        {isLoading || seasonLoading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : awards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {awards.map((award) => {
              const player = award.winnerPlayerId;
              const team = award.winnerTeamId;

              return (
                <article
                  key={award.id}
                  className={`card flex items-start gap-4 p-4 ${
                    award.type === 'CHAMPION' ? 'border-gold/40 shadow-gold' : ''
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {ICONS[award.type] ?? '🏏'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
                      {AWARD_LABELS[award.type] ?? award.type}
                    </p>

                    {team?.name && (
                      <p className="mt-1 truncate font-display text-base font-bold text-content-primary">
                        {team.name}
                      </p>
                    )}

                    {player && (
                      <p className="mt-1 truncate text-sm font-semibold text-content-primary">
                        {player.jerseyName || player.fullName}
                      </p>
                    )}

                    {award.statValue && (
                      <p className="tabular mt-0.5 text-xs text-gold">{award.statValue}</p>
                    )}

                    {!award.statValue && noteOf(award) && (
                      <p className="mt-0.5 text-xs text-content-muted">{noteOf(award)}</p>
                    )}

                    {!team && !player && (
                      <p className="mt-1 text-sm text-content-muted">{t('awards.notDecided')}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            variant={isArchived ? 'noResults' : 'notStarted'}
            title={t('awards.emptyTitle')}
            description={t('awards.emptyBody')}
          />
        )}
      </div>
    </>
  );
}

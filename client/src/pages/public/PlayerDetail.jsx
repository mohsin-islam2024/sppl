import { useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import playerService from '../../services/playerService.js';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { initials, toBengaliDigits, formatRate } from '../../utils/format.js';

/**
 * Player page.
 *
 * The figures are laid out as the three tables a cricketer is actually judged on —
 * batting, bowling, fielding — rather than one undifferentiated list of numbers.
 *
 * A missing figure renders as a dash, never as a zero. A batter who has never been
 * dismissed does not have an average of 0.00; the number does not exist, and printing
 * a zero claims something false about them.
 *
 * Career totals appear only when a player has featured in more than one season — with
 * a single season the season view already IS the career.
 */
export default function PlayerDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { setSeason } = useActiveSeason();

  // The season picked in the header lives in the URL (?season=). Only an explicit pick
  // is sent to the API: a page opened from a link keeps showing the player it was
  // opened for, and only a deliberate switch changes the season.
  const [searchParams] = useSearchParams();
  const chosenSeason = searchParams.get('season');

  const { data, isLoading, isError, error, refetch } = useQuery({
    // The season is part of the key. It was not, so switching seasons found the same
    // cached answer and nothing on the page changed.
    queryKey: ['player', id, chosenSeason ?? 'own'],
    queryFn: () => playerService.get(id, chosenSeason ? { season: chosenSeason } : {}),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    // Keep the previous figures on screen while the next season loads, so the page
    // does not flash empty on every switch.
    placeholderData: (previous) => previous,
  });

  // Opened without a season: make the header's season selector show the season of the
  // player being displayed, instead of whatever season the site happens to default to.
  useEffect(() => {
    if (!chosenSeason && data?.season?.slug) setSeason(data.season.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenSeason, data?.season?.slug]);

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="card p-6">
          <div className="h-8 w-40 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-4 h-4 w-56 animate-pulse rounded bg-surface-sunken" />
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

  const { player, team, season, career, careerTotals, seasons = [], noRecord } = data ?? {};

  if (!player) {
    return (
      <div className="container-page py-16">
        <EmptyState variant="default" />
      </div>
    );
  }

  const hasBatting = career?.ballsFaced > 0 || career?.runs > 0;
  const hasBowling = career?.ballsBowled > 0;
  const hasFielding =
    (career?.catches ?? 0) + (career?.runOuts ?? 0) + (career?.stumpings ?? 0) > 0;

  return (
    <>
      <SEO
        title={player.jerseyName || player.fullName}
        description={t('player.seoDescription', {
          player: player.fullName,
          team: team?.name ?? '',
        })}
        path={`/players/${id}`}
        type="profile"
      />

      <PageHeader
        title={player.jerseyName || player.fullName}
        breadcrumb={[
          { label: t('nav.players'), to: '/players' },
          { label: player.jerseyName || player.fullName },
        ]}
      />

      <div className="container-page space-y-8 py-8">
        {/* The seasons this person has played: a second way to switch, and the way out
            of a "no record" page. */}
        {seasons.length > 1 && (
          <nav aria-label={t('player.seasonsPlayed')} className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
              {t('player.seasonsPlayed')}
            </span>
            {seasons.map((entry) => {
              const active = entry.season?.slug === season?.slug && !noRecord;
              return (
                <button
                  key={entry.playerId}
                  type="button"
                  onClick={() => setSeason(entry.season?.slug)}
                  aria-pressed={active}
                  className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-brand bg-brand/15 text-brand-light'
                      : 'border-surface-border text-content-secondary hover:bg-surface-sunken'
                  }`}
                >
                  {entry.season?.shortName} {toBengaliDigits(entry.season?.seasonNo)} · {toBengaliDigits(entry.season?.year)}
                </button>
              );
            })}
          </nav>
        )}

        {noRecord && (
          <p role="status" className="rounded-lg bg-gold/10 px-4 py-3 text-sm font-semibold text-gold-dark">
            {t('player.noRecordInSeason', {
              player: player.jerseyName || player.fullName,
              season: `${noRecord.season?.shortName ?? ''} ${toBengaliDigits(noRecord.season?.seasonNo)} · ${toBengaliDigits(noRecord.season?.year)}`,
            })}
          </p>
        )}

        <section className="card flex flex-wrap items-center gap-5 p-5">
          {player.photoUrl ? (
            <img
              src={player.photoUrl}
              alt={player.fullName}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-24 w-24 items-center justify-center rounded-full font-display text-2xl font-bold text-white"
              style={{ backgroundColor: team?.themeColor || '#1e6fd9' }}
              aria-hidden="true"
            >
              {initials(player.jerseyName || player.fullName)}
            </span>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-content-primary">
                {player.fullName}
              </h2>
              {player.isCaptain && <span className="badge bg-gold/20 text-gold-dark">C</span>}
              {player.isViceCaptain && (
                <span className="badge bg-brand/15 text-brand-light">VC</span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-content-secondary">
              <span className="tabular font-semibold">#{toBengaliDigits(player.jerseyNo)}</span>
              <span>{t(`player.${roleKey(player.role)}`)}</span>
              {team && (
                <Link
                  to={`/teams/${team.slug}`}
                  className="font-medium text-brand-light hover:underline"
                >
                  {team.name}
                </Link>
              )}
              {season && (
                <span className="text-content-muted">
                  {season.shortName} {toBengaliDigits(season.seasonNo)} · {toBengaliDigits(season.year)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Season batting */}
        {hasBatting && (
          <section aria-labelledby="batting-heading">
            <h2
              id="batting-heading"
              className="mb-3 font-display text-lg font-bold text-content-primary"
            >
              {t('player.batting')}
            </h2>
            <div className="card grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
              <Stat label={t('player.matches')} value={career.matches} />
              <Stat label={t('player.innings')} value={career.innings} />
              <Stat label={t('player.runs')} value={career.runs} highlight />
              <Stat label={t('player.ballsFaced')} value={career.ballsFaced} />
              <Stat
                label={t('player.highScore')}
                value={
                  career.highScore === null
                    ? '—'
                    : `${toBengaliDigits(career.highScore)}${career.highScoreNotOut ? '*' : ''}`
                }
              />
              <Stat label={t('player.average')} value={formatRate(career.average)} />
              <Stat label={t('player.strikeRate')} value={formatRate(career.strikeRate)} />
              <Stat label={t('player.fours')} value={career.fours} />
              <Stat label={t('player.sixes')} value={career.sixes} />
              <Stat label={t('player.fifties')} value={career.fifties} />
              <Stat label={t('player.hundreds')} value={career.hundreds} />
              <Stat label={t('player.ducks')} value={career.ducks} />
            </div>
          </section>
        )}

        {/* Season bowling */}
        {hasBowling && (
          <section aria-labelledby="bowling-heading">
            <h2
              id="bowling-heading"
              className="mb-3 font-display text-lg font-bold text-content-primary"
            >
              {t('player.bowling')}
            </h2>
            <div className="card grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
              <Stat
                label={t('player.overs')}
                value={toBengaliDigits(formatOversFigure(career.ballsBowled))}
              />
              <Stat label={t('player.wickets')} value={career.wickets} highlight />
              <Stat label={t('player.runsConceded')} value={career.runsConceded} />
              <Stat label={t('player.bestBowling')} value={career.bestBowling ?? '—'} />
              <Stat label={t('player.economy')} value={formatRate(career.economy)} />
              <Stat label={t('player.bowlingAverage')} value={formatRate(career.bowlingAverage)} />
              <Stat label={t('player.maidens')} value={career.maidens} />
              <Stat label={t('player.threeWicketHauls')} value={career.threeWicketHauls ?? 0} />
            </div>
          </section>
        )}

        {/* Season fielding */}
        {hasFielding && (
          <section aria-labelledby="fielding-heading">
            <h2
              id="fielding-heading"
              className="mb-3 font-display text-lg font-bold text-content-primary"
            >
              {t('player.fielding')}
            </h2>
            <div className="card grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
              <Stat label={t('player.catches')} value={career.catches} />
              <Stat label={t('player.runOuts')} value={career.runOuts} />
              <Stat label={t('player.stumpings')} value={career.stumpings} />
              <Stat
                label={t('player.playerOfMatch')}
                value={career.playerOfMatchAwards}
                highlight
              />
            </div>
          </section>
        )}

        {/* Nothing recorded yet */}
        {!hasBatting && !hasBowling && !hasFielding && (
          <EmptyState
            variant="notStarted"
            title={t('player.noStatsTitle')}
            description={t('player.noStatsBody')}
          />
        )}

        {/* Career totals, across every season the player has appeared in */}
        {careerTotals && careerTotals.seasons > 1 && (
          <section aria-labelledby="career-heading">
            <h2
              id="career-heading"
              className="mb-3 font-display text-lg font-bold text-content-primary"
            >
              {t('player.careerTotals')}
            </h2>
            <p className="mb-3 text-sm text-content-muted">
              {t('player.careerSeasons', { count: toBengaliDigits(careerTotals.seasons) })}
            </p>

            <div className="card grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
              <Stat label={t('player.matches')} value={careerTotals.matches} />
              <Stat label={t('player.runs')} value={careerTotals.runs} highlight />
              <Stat
                label={t('player.highScore')}
                value={
                  careerTotals.highScore === null
                    ? '—'
                    : `${toBengaliDigits(careerTotals.highScore)}${careerTotals.highScoreNotOut ? '*' : ''}`
                }
              />
              <Stat label={t('player.average')} value={formatRate(careerTotals.average)} />
              <Stat label={t('player.strikeRate')} value={formatRate(careerTotals.strikeRate)} />
              <Stat label={t('player.wickets')} value={careerTotals.wickets} highlight />
              <Stat label={t('player.economy')} value={formatRate(careerTotals.economy)} />
              <Stat label={t('player.bestBowling')} value={careerTotals.bestBowling ?? '—'} />
            </div>
          </section>
        )}

        {/* Registration details — from the organizer's jersey sheet */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-content-primary">{t('player.registration')}</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-surface-border py-1.5">
              <dt className="text-content-muted">{t('team.jerseyNo')}</dt>
              <dd className="tabular font-medium text-content-primary">
                {toBengaliDigits(player.jerseyNo)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-surface-border py-1.5">
              <dt className="text-content-muted">{t('player.jerseyName')}</dt>
              <dd className="font-medium text-content-primary">{player.jerseyName}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-surface-border py-1.5">
              <dt className="text-content-muted">{t('team.size')}</dt>
              <dd className="font-medium text-content-primary">
                {player.isKidsSize
                  ? t('team.kidsSize', { size: toBengaliDigits(player.size.replace('y', '')) })
                  : player.size}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-surface-border py-1.5">
              <dt className="text-content-muted">{t('player.jerseyStatus')}</dt>
              <dd
                className={
                  player.jerseyConfirmed ? 'font-medium text-win' : 'font-medium text-content-muted'
                }
              >
                {player.jerseyConfirmed ? t('player.confirmed') : t('player.pending')}
              </dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <Link to="/players" className="text-brand-light hover:underline">
            ← {t('nav.players')}
          </Link>
          <Link to={`/compare?ids=${id}`} className="text-brand-light hover:underline">
            {t('player.compare')} →
          </Link>
        </div>
      </div>
    </>
  );
}

/** One labelled figure. */
function Stat({ label, value, highlight = false }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
        {label}
      </dt>
      <dd
        className={`tabular mt-0.5 font-display text-lg font-bold ${
          highlight ? 'text-gold' : 'text-content-primary'
        }`}
      >
        {typeof value === 'number' || typeof value === 'string' ? toBengaliDigits(value) : value}
      </dd>
    </div>
  );
}

/** Overs as "3.4" from a legal-ball count. */
function formatOversFigure(balls = 0) {
  const safe = Math.max(0, Math.floor(balls || 0));
  return `${Math.floor(safe / 6)}.${safe % 6}`;
}

function roleKey(role) {
  switch (role) {
    case 'BOWLER':
      return 'bowler';
    case 'ALL_ROUNDER':
      return 'allRounder';
    case 'WICKET_KEEPER':
      return 'wicketKeeper';
    default:
      return 'batter';
  }
}

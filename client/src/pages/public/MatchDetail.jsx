import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import Scorecard from '../../components/cricket/Scorecard.jsx';
import matchService from '../../services/matchService.js';
import { toBengaliDigits, formatDate } from '../../utils/format.js';

/**
 * Match page.
 *
 * `GET /matches/:id` answers with the match itself at the top level, with the
 * resolved scorecard hanging off `scorecard` — there is no wrapper object, so the
 * page reads the payload directly.
 *
 * A finished match shows the result line above the scorecard; a fixture that has not
 * started shows the start time instead of an empty table. Those states are distinct
 * and each gets its own line rather than an empty table followed by an apology.
 */
export default function MatchDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchService.get(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="card space-y-3 p-6">
          <div className="h-6 w-56 animate-pulse rounded bg-surface-sunken" />
          <div className="h-4 w-80 animate-pulse rounded bg-surface-sunken" />
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

  // The payload IS the match. `scorecard` is a sibling key on it.
  const match = data ?? null;
  const scorecard = match?.scorecard ?? null;

  if (!match?.id) {
    return (
      <div className="container-page py-16">
        <EmptyState variant="default" />
      </div>
    );
  }

  const teamA = match.teamA ?? null;
  const teamB = match.teamB ?? null;
  const title = `${teamA?.name ?? ''} ${t('match.vs')} ${teamB?.name ?? ''}`.trim();

  // Result text exists in both languages; show the reader's one, falling back to
  // whichever is present rather than showing nothing.
  const resultText =
    (lang === 'bn' ? match.result?.textBn : match.result?.textEn) ||
    match.result?.textEn ||
    match.result?.textBn ||
    '';

  return (
    <>
      <SEO
        title={`${teamA?.shortName ?? ''} vs ${teamB?.shortName ?? ''}`}
        description={t('match.seoDescription', {
          teamA: teamA?.name ?? '',
          teamB: teamB?.name ?? '',
          date: match.startAt ? formatDate(match.startAt, lang) : '',
        })}
        path={`/matches/${id}`}
        type="article"
      />

      <PageHeader
        title={title}
        breadcrumb={[
          { label: t('nav.matches'), to: '/fixtures' },
          { label: `${teamA?.shortName ?? ''} vs ${teamB?.shortName ?? ''}` },
        ]}
      />

      <div className="container-page space-y-6 py-8">
        {/* Both teams, side by side */}
        <section className="card grid gap-4 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamBlock team={teamA} align="left" />
          <span className="text-center font-display text-sm font-bold uppercase tracking-widest text-content-muted">
            {t('match.vs')}
          </span>
          <TeamBlock team={teamB} align="right" />
        </section>

        {/* Match meta + result */}
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-content-secondary">
            {match.startAt && <span>{formatDate(match.startAt, lang, { withTime: true })}</span>}
            {match.venue && <span>{match.venue}</span>}
            {match.stage && (
              <span className="badge bg-surface-sunken">{t(`match.${stageKey(match.stage)}`)}</span>
            )}
            <span className={`badge ${statusClass(match.status)}`}>
              {t(`match.${statusKey(match.status)}`)}
            </span>
          </div>

          {resultText ? (
            <p className="font-display text-lg font-bold text-gold">{resultText}</p>
          ) : (
            <p className="text-sm text-content-muted">{t('match.resultPending')}</p>
          )}

          {/* Toss is optional and may be null on a match entered by hand. */}
          {match.toss?.winnerTeamId && (
            <p className="text-sm text-content-secondary">
              {t('match.toss', {
                team: tossWinnerName(match.toss.winnerTeamId, teamA, teamB),
                decision: t(`match.${String(match.toss.decision ?? 'bat').toLowerCase()}`),
              })}
            </p>
          )}

          {match.target > 0 && (
            <p className="text-sm text-content-secondary">
              {t('match.target', { runs: toBengaliDigits(match.target) })}
            </p>
          )}

          {match.motm && (
            <p className="text-sm text-content-secondary">
              {t('match.playerOfMatch')}:{' '}
              <Link
                to={`/players/${match.motm.id}`}
                className="font-medium text-brand-light hover:underline"
              >
                {match.motm.name || match.motm.fullName}
              </Link>
            </p>
          )}
        </section>

        {/* Scorecard — teamA/teamB go with it so the innings tabs can name the sides */}
        <Scorecard scorecard={scorecard} teamA={teamA} teamB={teamB} lang={lang} />

        <div className="flex justify-center text-sm font-semibold">
          <Link to="/fixtures" className="text-brand-light hover:underline">
            ← {t('nav.matches')}
          </Link>
        </div>
      </div>
    </>
  );
}

function TeamBlock({ team, align }) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''
      }`}
    >
      {team?.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white"
          style={{ backgroundColor: team?.themeColor || '#1e6fd9' }}
          aria-hidden="true"
        >
          {team?.shortName ?? '—'}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-display font-bold text-content-primary">{team?.name ?? '—'}</p>
        <p className="text-xs uppercase tracking-wider text-content-muted">
          {team?.shortName ?? ''}
        </p>
      </div>
    </div>
  );
}

function tossWinnerName(winnerTeamId, teamA, teamB) {
  const winner = String(winnerTeamId ?? '');
  if (String(teamA?.id ?? '') === winner) return teamA?.name ?? '';
  if (String(teamB?.id ?? '') === winner) return teamB?.name ?? '';
  return '';
}

function statusKey(status) {
  switch (status) {
    case 'LIVE':
      return 'live';
    case 'INNINGS_BREAK':
      return 'inningsBreak';
    case 'COMPLETED':
      return 'completed';
    case 'ABANDONED':
      return 'abandoned';
    default:
      return 'upcoming';
  }
}

function statusClass(status) {
  if (status === 'LIVE') return 'bg-loss/15 text-loss';
  if (status === 'COMPLETED') return 'bg-win/15 text-win';
  return 'bg-surface-sunken text-content-secondary';
}

function stageKey(stage) {
  if (stage === 'FINAL') return 'final';
  if (stage === 'SEMI_FINAL') return 'semiFinal';
  return 'league';
}

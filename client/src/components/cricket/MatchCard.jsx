import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MatchStatusBadge from './MatchStatusBadge.jsx';
import { formatDate, formatOvers, toBengaliDigits } from '../../utils/format.js';

/**
 * One fixture or result, as a card.
 *
 * Used by the fixtures page, the results page, the home page and a team page — so
 * it has to serve a match that has not started, one in progress and one that is
 * over. The shape is the same in all three cases and only the middle row changes.
 */
export default function MatchCard({ match, showStage = false }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  if (!match) return null;

  const isCompleted = match.status === 'COMPLETED';
  const isLive = match.status === 'LIVE';
  const firstInnings = match.innings?.[0];
  const secondInnings = match.innings?.[1];

  return (
    <article className="card overflow-hidden transition hover:border-brand/40">
      <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-content-muted">
            {t('match.matchNo', { number: toBengaliDigits(match.matchNo) })}
          </span>
          {showStage && match.stage !== 'LEAGUE' && (
            <span className="badge bg-gold/15 text-gold-dark">{match.stage.replace('_', ' ')}</span>
          )}
        </div>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="space-y-3 px-4 py-4">
        <TeamRow
          team={match.teamA}
          innings={firstInnings}
          isWinner={match.result?.winnerTeamId === match.teamA?.id}
        />
        <TeamRow
          team={match.teamB}
          innings={secondInnings}
          isWinner={match.result?.winnerTeamId === match.teamB?.id}
        />
      </div>

      <div className="border-t border-surface-border px-4 py-3">
        {isCompleted && match.result && (
          <p className="text-sm font-semibold text-content-primary">
            {(lang === 'bn' ? match.result.textBn : match.result.textEn) ||
              match.result.margin ||
              t('match.completed')}
          </p>
        )}

        {isLive && (
          <p className="text-sm text-content-secondary">
            {secondInnings && match.target
              ? t('match.chasingLine', {
                  runs: toBengaliDigits(secondInnings.runs),
                  wickets: toBengaliDigits(secondInnings.wickets),
                  overs: toBengaliDigits(formatOvers(secondInnings.balls)),
                  target: toBengaliDigits(match.target),
                })
              : t('match.inProgress')}
          </p>
        )}

        {!isCompleted && !isLive && (
          <p className="text-sm text-content-secondary">
            {formatDate(match.startAt, lang, { withYear: false, withTime: true })}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {match.venue && <span className="text-xs text-content-muted">{match.venue}</span>}
          <Link
            to={`/matches/${match.id}`}
            className="text-xs font-semibold text-brand-light hover:underline"
          >
            {isLive ? t('match.watchLive') : t('match.viewMatch')}
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * One team's line.
 *
 * When a side has not batted the row shows the team only — an empty "0/0 (0.0)"
 * would read as a collapse rather than "has not batted yet".
 */
function TeamRow({ team, innings, isWinner }) {
  if (!team) return null;

  const hasBatted = innings && (innings.balls > 0 || (innings.runs ?? 0) > 0);

  return (
    <div className="flex items-center gap-3">
      {team.logoUrl ? (
        <img
          src={team.logoUrl}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          className="h-8 w-8 shrink-0 rounded-md object-contain"
        />
      ) : (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-2xs font-bold text-white"
          style={{ backgroundColor: team.themeColor || '#1e6fd9' }}
          aria-hidden="true"
        >
          {team.shortName?.slice(0, 3) ?? '—'}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <Link
          to={`/teams/${team.slug}`}
          className={`truncate text-sm ${
            isWinner ? 'font-bold text-content-primary' : 'font-medium text-content-secondary'
          } hover:text-brand-light`}
        >
          {team.name}
        </Link>
      </div>

      {hasBatted && (
        <div className="tabular shrink-0 text-right">
          <span className="text-sm font-bold text-content-primary">
            {toBengaliDigits(innings.runs)}/{toBengaliDigits(innings.wickets)}
          </span>
          <span className="ml-1.5 text-xs text-content-muted">
            ({toBengaliDigits(formatOvers(innings.balls))})
          </span>
        </div>
      )}
    </div>
  );
}

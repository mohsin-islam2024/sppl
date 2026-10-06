import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initials, toBengaliDigits } from '../../utils/format.js';

/**
 * Player row, used in squad lists and search results.
 *
 * Two details are shown that a generic sports site would omit, and both come from
 * the way this tournament is actually run:
 *
 *   - the printed jersey name, which often differs from the full name
 *   - the jersey size, including the kids sizes, because the team page doubles as
 *     the place where the kit order gets checked
 *
 * `jerseyConfirmed: false` is marked rather than hidden. On the organizer's sheet
 * those entries had no tick, so a card without a tick is honest about a detail that
 * is still provisional.
 */
export default function PlayerCard({ player, showTeam = false, team = null }) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/players/${player.id}`}
      className="card group flex items-center gap-3 p-3.5 transition hover:border-brand/40"
    >
      {player.photoUrl ? (
        <img
          src={player.photoUrl}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: team?.themeColor || '#1e6fd9' }}
          aria-hidden="true"
        >
          {initials(player.jerseyName || player.fullName)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-bold text-content-primary group-hover:text-brand-light">
            {player.jerseyName || player.fullName}
          </h3>
          {player.isCaptain && (
            <span className="badge bg-gold/20 text-gold-dark" title={t('team.captain')}>
              C
            </span>
          )}
          {player.isViceCaptain && (
            <span className="badge bg-brand/15 text-brand-light" title={t('team.viceCaptain')}>
              VC
            </span>
          )}
        </div>

        {player.fullName && player.fullName !== player.jerseyName && (
          <p className="truncate text-2xs text-content-muted">{player.fullName}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-2xs text-content-muted">
          <span className="tabular">#{toBengaliDigits(player.jerseyNo)}</span>
          <span>{t(`player.${roleKey(player.role)}`)}</span>
          {showTeam && team && <span className="truncate">{team.name}</span>}
          {player.size && (
            <span className={player.isKidsSize ? 'text-gold-dark' : undefined}>
              {player.isKidsSize
                ? t('team.kidsSize', { size: toBengaliDigits(player.size.replace('y', '')) })
                : player.size}
            </span>
          )}
        </div>
      </div>

      {!player.jerseyConfirmed && (
        <span className="shrink-0 text-2xs text-content-muted" title={t('player.jerseyUnconfirmed')}>
          ?
        </span>
      )}
    </Link>
  );
}

/** Map the stored role enum onto a translation key. */
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

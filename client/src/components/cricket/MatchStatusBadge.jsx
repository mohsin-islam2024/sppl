import { useTranslation } from 'react-i18next';

/**
 * Match status pill.
 *
 * The LIVE state gets a pulsing dot rather than just red text, because the page is
 * often glanced at from across a room on a phone and motion is what makes "this is
 * happening now" register.
 */
export default function MatchStatusBadge({ status, className = '' }) {
  const { t } = useTranslation();

  const config = {
    LIVE: { className: 'badge-live', label: t('match.live'), pulse: true },
    TOSS: { className: 'badge-live', label: t('match.toss'), pulse: false },
    UPCOMING: { className: 'badge-upcoming', label: t('match.upcoming'), pulse: false },
    INNINGS_BREAK: { className: 'badge-upcoming', label: t('match.inningsBreak'), pulse: false },
    COMPLETED: { className: 'badge-completed', label: t('match.completed'), pulse: false },
    ABANDONED: { className: 'badge-completed', label: t('match.abandoned'), pulse: false },
  };

  const entry = config[status] ?? config.UPCOMING;

  return (
    <span className={`${entry.className} ${className}`}>
      {entry.pulse && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      {entry.label}
    </span>
  );
}

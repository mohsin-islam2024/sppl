import { useTranslation } from 'react-i18next';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';

/**
 * Season switcher.
 *
 * A native `<select>` rather than a custom dropdown, deliberately:
 *   - it is keyboard and screen-reader accessible for free
 *   - on a phone it opens the OS picker, which is far easier than a custom list
 *   - it costs no JavaScript
 *
 * The season choice lives in the URL (`?season=`), so a shared link keeps its
 * season and a refresh does not silently jump back to the current one.
 */
export default function SeasonSwitcher({ className = '' }) {
  const { t } = useTranslation();
  const { season, seasons, setSeason } = useActiveSeason();

  if (seasons.length < 2) return null;

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <span className="sr-only">{t('season.switchLabel')}</span>
      <select
        value={season?.slug ?? ''}
        onChange={(event) => setSeason(event.target.value)}
        className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-medium text-content-primary transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        {seasons.map((entry) => (
          <option key={entry.id} value={entry.slug}>
            {entry.shortName} {entry.seasonNo} · {entry.year}
            {entry.status === 'COMPLETED' ? ` (${t('season.completedTag')})` : ''}
            {entry.status === 'UPCOMING' ? ` (${t('season.upcomingTag')})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

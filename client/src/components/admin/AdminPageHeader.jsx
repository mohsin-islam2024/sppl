import { useTranslation } from 'react-i18next';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import SeasonSwitcher from '../season/SeasonSwitcher.jsx';

/**
 * Header for every admin management page.
 *
 * Carries the action button on the right and the season switcher, because almost
 * every admin list is scoped to one season and the operator needs to see which one
 * they are editing before they change anything.
 */
export default function AdminPageHeader({ title, description, action = null, showSwitcher = true }) {
  const { t } = useTranslation();
  const { season, seasons } = useActiveSeason();

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-xl font-bold text-content-primary sm:text-2xl">
            {title}
          </h1>
          {season && (
            <span className="badge bg-brand/15 text-brand-light">
              {season.shortName} {season.seasonNo} · {season.year}
            </span>
          )}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-content-muted">{description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showSwitcher && seasons.length > 1 && <SeasonSwitcher />}
        {action}
      </div>
    </div>
  );
}

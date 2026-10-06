import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import SeasonSwitcher from '../season/SeasonSwitcher.jsx';

/**
 * Season-aware page header.
 *
 * Two jobs, and they are related:
 *
 *  1. Show which season the page is about, so a visitor reading last year's points
 *     table is never confused about which year they are looking at.
 *  2. Carry the archive notice. Season 1 finished in January 2026 and Season 2 has
 *     no date yet, so a page can be showing either a completed season or an upcoming
 *     one with nothing in it. The notice is the difference between "this is history"
 *     and "this is broken".
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  showSwitcher = true,
}) {
  const { t } = useTranslation();
  const { season, isArchived, hasSchedule, seasons } = useActiveSeason();

  const showArchiveNotice = isArchived && season;

  // An upcoming season with no dates announced. This is Season 2's current state and
  // it must be explained rather than left looking like missing data.
  const showPendingNotice = !isArchived && season && !hasSchedule && season.status === 'UPCOMING';

  return (
    <header className="border-b border-surface-border bg-surface-sunken">
      <div className="container-page py-6 sm:py-8">
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-content-muted">
              {breadcrumb.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1.5">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {crumb.to ? (
                    <Link to={crumb.to} className="hover:text-brand-light">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-content-secondary">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-extrabold text-content-primary sm:text-3xl">
                {title}
              </h1>
              {season && (
                <span className="badge bg-brand/15 text-brand-light">
                  {season.shortName} {season.seasonNo} · {season.year}
                </span>
              )}
            </div>
            {subtitle && <p className="mt-2 max-w-2xl text-sm text-content-secondary">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {showSwitcher && seasons.length > 1 && <SeasonSwitcher />}
          </div>
        </div>

        {showArchiveNotice && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-content-muted/25 bg-surface-raised px-3.5 py-3">
            <span className="badge bg-content-muted/15 text-content-muted">
              {t('season.archiveBadge')}
            </span>
            <p className="text-sm text-content-secondary">
              {t('season.archiveNotice', {
                season: `${season.shortName} ${season.seasonNo}`,
                year: season.year,
              })}
            </p>
          </div>
        )}

        {showPendingNotice && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-3">
            <span className="badge bg-gold/20 text-gold-dark">{t('season.upcomingBadge')}</span>
            <p className="text-sm text-content-secondary">
              {t('season.noDatesNotice', { season: `${season.shortName} ${season.seasonNo}` })}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}

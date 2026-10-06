import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Team card for the teams grid.
 *
 * The crest sits on a tinted panel built from the team's own colour, so the four
 * teams are distinguishable before the name is read. Agni Riders and Legend Titans
 * were supplied on a black background, so the panel is dark-neutral rather than
 * white — a white panel would frame those two crests in a black box.
 */
export default function TeamCard({ team }) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/teams/${team.slug}`}
      className="card group flex flex-col overflow-hidden transition hover:border-brand/40 hover:shadow-raised"
    >
      <div
        className="flex h-28 items-center justify-center bg-surface-sunken"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 120%, ${team.themeColor ?? '#1e6fd9'}22, transparent 70%)`,
        }}
      >
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt=""
            width={80}
            height={80}
            loading="lazy"
            className="h-20 w-20 object-contain transition group-hover:scale-105"
          />
        ) : (
          <span
            className="flex h-16 w-16 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: team.themeColor || '#1e6fd9' }}
            aria-hidden="true"
          >
            {team.shortName?.slice(0, 3) ?? '—'}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-display text-base font-bold text-content-primary group-hover:text-brand-light">
          {team.name}
        </h2>
        <p className="mt-0.5 text-2xs uppercase tracking-widest text-content-muted">
          {team.shortName}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4 text-xs">
          <span className="text-content-secondary">
            {t('team.squadCount', { count: toBengaliDigits(team.squadSize ?? 0) })}
          </span>
          <span className="font-semibold text-brand-light">{t('common.viewAll')} →</span>
        </div>
      </div>
    </Link>
  );
}

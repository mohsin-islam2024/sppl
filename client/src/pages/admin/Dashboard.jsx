import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import useAuth from '../../hooks/useAuth.js';

/**
 * Admin dashboard.
 *
 * Shows who you are signed in as and what your role grants — because a newly promoted
 * admin's first question is always "did it work", and a stale token is the one thing
 * that makes a correctly configured site look broken.
 *
 * The section links matter on a phone: the sidebar is a slide-over there, so a direct
 * set of shortcuts means the organizer does not have to open the menu to reach the
 * screen they use every day.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const { profile, role, isAdmin, isScorer, isSuperAdmin } = useAuth();

  const accessLabel = isSuperAdmin
    ? t('admin.accessFull')
    : isAdmin
      ? t('admin.accessContent')
      : isScorer
        ? t('admin.accessScoring')
        : t('admin.accessMember');

  const sections = [
    { to: '/admin/seasons', label: t('admin.seasons') },
    { to: '/admin/teams', label: t('admin.teams') },
    { to: '/admin/players', label: t('admin.players') },
    { to: '/admin/matches', label: t('admin.matches') },
    { to: '/admin/live-scoring', label: t('admin.liveScoring'), scorerOnly: true },
  ];

  return (
    <>
      <SEO title={t('admin.dashboard')} noIndex />

      <div className="mx-auto max-w-content">
        <h1 className="font-display text-2xl font-bold text-content-primary">
          {t('admin.dashboard')}
        </h1>
        <p className="mt-1 text-sm text-content-muted">{t('admin.dashboardSubtitle')}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('admin.account')} value={profile?.name || '—'} />
          <StatCard label={t('admin.roleLabel')} value={role} highlight />
          <StatCard
            label={t('admin.emailVerified')}
            value={profile?.emailVerified ? t('common.yes') : t('common.no')}
          />
          <StatCard label={t('admin.accessLevel')} value={accessLabel} />
        </div>

        <div className="mt-8 card p-6">
          <h2 className="text-sm font-semibold text-content-primary">
            {t('admin.managementTitle')}
          </h2>
          <p className="mt-2 text-sm text-content-muted">{t('admin.managementBody')}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections
              .filter((section) => !section.scorerOnly || isScorer || isAdmin)
              .map((section) => (
                <Link
                  key={section.to}
                  to={section.to}
                  className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-raised px-4 py-3 text-sm font-semibold text-content-primary transition hover:border-brand/40 hover:bg-surface-sunken"
                >
                  {section.label}
                  <span className="text-brand-light" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

/** One statistic tile. */
function StatCard({ label, value, highlight = false }) {
  return (
    <div className="card p-4">
      <p className="text-2xs font-semibold uppercase tracking-widest text-content-muted">
        {label}
      </p>
      <p
        className={`mt-1.5 truncate text-lg font-bold ${
          highlight ? 'text-gold' : 'text-content-primary'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

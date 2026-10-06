import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import useAuth from '../../hooks/useAuth.js';

/**
 * Admin dashboard.
 *
 * Phase 1 shows identity and role so an admin can confirm their promotion landed —
 * the role arrives from the server, and a stale token is the one thing that makes a
 * newly-promoted admin think the site is broken. Management screens replace this
 * placeholder in the next phase.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const { profile, role, isAdmin, isScorer, isSuperAdmin } = useAuth();

  const accessLabel = isSuperAdmin
    ? 'Full access'
    : isAdmin
      ? 'Content + matches'
      : isScorer
        ? 'Scoring only'
        : 'Member';

  return (
    <>
      <SEO title={t('admin.dashboard')} noIndex />

      <div className="mx-auto max-w-content">
        <h1 className="font-display text-2xl font-bold text-content-primary">
          {t('admin.dashboard')}
        </h1>
        <p className="mt-1 text-sm text-content-muted">SPPL Season 1 · 2026</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Account" value={profile?.name || '—'} />
          <StatCard label="Role" value={role} highlight />
          <StatCard label="Email verified" value={profile?.emailVerified ? 'Yes' : 'No'} />
          <StatCard label="Access level" value={accessLabel} />
        </div>

        <div className="mt-8 card p-6">
          <h2 className="text-sm font-semibold text-content-primary">Management sections</h2>
          <p className="mt-2 text-sm text-content-muted">
            Season, team, player, match and content management arrive in the next phase. Until
            then this dashboard confirms your account and permissions are wired up correctly.
          </p>
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
        className={[
          'mt-1.5 truncate text-lg font-bold',
          highlight ? 'text-gold' : 'text-content-primary',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

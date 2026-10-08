import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Suspense } from 'react';
import logo from '/logos/sppl-logo.png';
import useAuth from '../../hooks/useAuth.js';
import useTheme from '../../hooks/useTheme.js';
import LanguageToggle from '../common/LanguageToggle.jsx';
import ThemeToggle from '../common/ThemeToggle.jsx';
import PageLoader from '../common/PageLoader.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';


/**
 * Public site chrome: header, main, footer.
 *
 * The mobile menu is a plain disclosure (no focus trap needed, no portal) because
 * the panel sits in the DOM flow directly under the button — simpler, and keyboard
 * users never lose their place.
 */
export default function PublicLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isAdmin, profile, logout } = useAuth();
  const { isDark } = useTheme();
  const { season } = useActiveSeason();
  const navigate = useNavigate();

  const navLinks = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/fixtures', label: t('nav.fixtures') },
    { to: '/points-table', label: t('nav.pointsTable') },
    { to: '/teams', label: t('nav.teams') },
    { to: '/gallery', label: t('nav.gallery') },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface-base">
      <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-base/85 backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label={t('common.appName')}>
            <img
              src={logo}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
            />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-display text-lg font-extrabold tracking-tight text-content-primary">
                {t('common.appName')}
              </span>
              {/* Reads the active season rather than a hard-coded year. As written the header
              claimed "Season 1 · 2026" while the page below it was showing Season 2. */}
              <span className="text-2xs font-medium uppercase tracking-widest text-gold">
                 {season ? `${season.shortName} ${season.seasonNo} · ${season.year}` : 'SPPL'}
              </span>

            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'rounded-pill px-3.5 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-brand/15 text-brand-light'
                      : 'text-content-secondary hover:bg-surface-sunken hover:text-content-primary',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />

            {isAuthenticated ? (
              <div className="hidden items-center gap-2 sm:flex">
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-gold-light"
                  >
                    {t('nav.admin')}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-pill border border-surface-border px-4 py-2 text-sm font-medium text-content-secondary transition hover:bg-surface-sunken"
                >
                  {t('nav.logout')}
                </button>
                <span className="sr-only">{profile?.name}</span>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:block"
              >
                {t('nav.login')}
              </Link>
            )}

            {/* Mobile disclosure */}
            <details className="relative lg:hidden">
              <summary
                className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-surface-border text-content-secondary"
                aria-label="Menu"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </summary>
              <div className="absolute right-0 top-12 w-60 rounded-card border border-surface-border bg-surface-raised p-2 shadow-raised">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      [
                        'block rounded-lg px-3 py-2.5 text-sm font-medium',
                        isActive
                          ? 'bg-brand/15 text-brand-light'
                          : 'text-content-secondary hover:bg-surface-sunken',
                      ].join(' ')
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="my-2 border-t border-surface-border" />
                {isAuthenticated ? (
                  <>
                    {isAdmin && (
                      <NavLink
                        to="/admin"
                        className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-gold"
                      >
                        {t('nav.admin')}
                      </NavLink>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-content-secondary hover:bg-surface-sunken"
                    >
                      {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <NavLink
                    to="/login"
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-light"
                  >
                    {t('nav.login')}
                  </NavLink>
                )}
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 pb-16">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-surface-border bg-surface-sunken">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src={logo} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="font-display font-bold text-content-primary">
                {t('common.appName')}
              </span>
            </div>
            <p className="mt-3 text-sm text-content-muted">{t('common.appFullName')}</p>
          </div>

          <FooterGroup
            title={t('nav.fixtures')}
            links={[
              { to: '/fixtures', label: t('nav.fixtures') },
              { to: '/results', label: t('nav.results') },
              { to: '/points-table', label: t('nav.pointsTable') },
              { to: '/rules', label: t('nav.rules') },
            ]}
          />

          <FooterGroup
            title={t('nav.teams')}
            links={[
              { to: '/teams', label: t('nav.teams') },
              { to: '/players', label: t('nav.players') },
              { to: '/stats', label: t('nav.stats') },
              { to: '/awards', label: t('nav.awards') },
            ]}
          />

          <FooterGroup
            title={t('nav.news')}
            links={[
              { to: '/gallery', label: t('nav.gallery') },
              { to: '/sponsors', label: t('nav.sponsors') },
              { to: '/rules', label: t('nav.rules') },
            ]}
          />
        </div>

        <div className="border-t border-surface-border">
          <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-content-muted sm:flex-row">
            <p>© {new Date().getFullYear()} SPPL · Sotahar Poshchim Para</p>
            <p>Made for the neighbourhood, built to last for every season.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterGroup({ title, links }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-content-muted">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-sm text-content-secondary transition hover:text-brand-light"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

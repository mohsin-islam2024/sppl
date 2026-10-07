import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Suspense } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useTheme from '../../hooks/useTheme.js';
import LanguageToggle from '../common/LanguageToggle.jsx';
import PageLoader from '../common/PageLoader.jsx';
import { ROLES, ROLE_HIERARCHY } from '@sppl/shared/constants/roles.js';
import { cn } from '../../utils/cn.js';

/**
 * Admin shell.
 *
 * The sidebar is filtered by the same hierarchy the server enforces — a scorer sees
 * one entry, an admin sees the content group, a super admin additionally sees Users.
 * Hiding a link is cosmetic; the API rejects the request regardless.
 *
 * The navigation is a slide-over drawer below `lg` rather than a hidden sidebar.
 * The organizer runs this from a phone at the ground, and a sidebar that simply
 * disappears on a small screen leaves them with no way to reach any other screen.
 */
export default function AdminLayout() {
  const { t } = useTranslation();
  const { role, profile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer on navigation. Without this, tapping a link on a phone leaves
  // the menu covering the page it just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock the page behind the drawer so the background does not scroll under it.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const level = ROLE_HIERARCHY[role] ?? -1;
  const canScore = level >= ROLE_HIERARCHY[ROLES.SCORER];
  const canManage = level >= ROLE_HIERARCHY[ROLES.ADMIN];
  const isSuper = level >= ROLE_HIERARCHY[ROLES.SUPER_ADMIN];

  const groups = [
    {
      title: t('admin.dashboard'),
      items: [{ to: '/admin', label: t('admin.dashboard'), end: true, show: true }],
    },
    {
      title: t('admin.matches'),
      items: [
        { to: '/admin/live-scoring', label: t('admin.liveScoring'), show: canScore },
        { to: '/admin/matches', label: t('admin.matches'), show: canManage },
        { to: '/admin/points', label: t('admin.points'), show: canManage },
      ],
    },
    {
      title: t('admin.teams'),
      items: [
        { to: '/admin/seasons', label: t('admin.seasons'), show: canManage },
        { to: '/admin/teams', label: t('admin.teams'), show: canManage },
        { to: '/admin/players', label: t('admin.players'), show: canManage },
      ],
    },
    {
      title: t('admin.gallery'),
      items: [
        { to: '/admin/gallery', label: t('admin.gallery'), show: canManage },
        { to: '/admin/sponsors', label: t('admin.sponsors'), show: canManage },
        { to: '/admin/awards', label: t('admin.awards'), show: canManage },
        { to: '/admin/announcements', label: t('admin.announcements'), show: canManage },
      ],
    },
    {
      title: t('admin.users'),
      items: [{ to: '/admin/users', label: t('admin.users'), show: isSuper }],
    },
  ];

  /** The nav list, shared between the desktop sidebar and the mobile drawer. */
  const navList = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin">
      {groups.map((group) => {
        const visible = group.items.filter((item) => item.show);
        if (visible.length === 0) return null;

        return (
          <div key={group.title}>
            <h2 className="px-3 pb-2 text-2xs font-semibold uppercase tracking-widest text-content-muted">
              {group.title}
            </h2>
            <ul className="space-y-0.5">
              {visible.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand/15 text-brand-light'
                          : 'text-content-secondary hover:bg-surface-raised hover:text-content-primary',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-surface-base">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-surface-border bg-surface-sunken lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-surface-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-xs font-bold text-white">
            SP
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-wider text-content-primary">
            Admin
          </span>
        </div>
        {navList}
        <div className="border-t border-surface-border p-3">
          <Link
            to="/"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition hover:bg-surface-raised hover:text-content-primary"
          >
            ← {t('nav.home')}
          </Link>
        </div>
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop — tapping it closes the drawer, which is the gesture people try first. */}
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-navy-950/70"
          />

          <div className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-surface-border bg-surface-sunken">
            <div className="flex h-16 items-center justify-between border-b border-surface-border px-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-xs font-bold text-white">
                  SP
                </span>
                <span className="font-display text-sm font-bold uppercase tracking-wider text-content-primary">
                  Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t('common.close')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-content-muted transition hover:bg-surface-raised"
              >
                ✕
              </button>
            </div>

            {navList}

            <div className="border-t border-surface-border p-3">
              <Link
                to="/"
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-content-muted transition hover:bg-surface-raised hover:text-content-primary"
              >
                ← {t('nav.home')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-surface-border bg-surface-base/90 px-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* The menu button, which is the whole point of this change */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('admin.openMenu')}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-border text-content-secondary transition hover:bg-surface-sunken lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-content-primary">{profile?.name}</p>
              <p className="truncate text-2xs uppercase tracking-wider text-gold">{role}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-content-secondary transition hover:bg-surface-sunken"
              aria-label={t('theme.dark')}
            >
              {isDark ? '☀' : '☾'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-pill border border-surface-border px-3 py-2 text-xs font-medium text-content-secondary transition hover:bg-surface-sunken sm:text-sm"
            >
              {t('nav.logout')}
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

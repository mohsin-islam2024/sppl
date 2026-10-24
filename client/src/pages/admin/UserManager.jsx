import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminTable from '../../components/admin/AdminTable.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAdminUsers, useUserMutations } from '../../hooks/useAdminOps.js';
import { formatShortDate } from '../../utils/format.js';
import { ROLES } from '@sppl/shared/constants/roles.js';

/**
 * User accounts (Super Admin only).
 *
 * Two powerful actions live here — changing a role and switching an account off —
 * so both go through a confirmation. Handing someone Admin by a mis-tap on a phone is
 * not something a page should allow with one touch.
 *
 * The server refuses to change your own role or status, and the controls for your own
 * row are disabled to match, so nobody discovers that by pressing a button.
 */

const ASSIGNABLE_ROLES = [
  ROLES.USER,
  ROLES.PLAYER,
  ROLES.SCORER,
  ROLES.UMPIRE,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

const inputClass =
  'rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

function describeError(err, fallback) {
  return err?.message ?? fallback;
}

export default function UserManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';
  const { profile } = useAuth();
  const selfId = String(profile?.id ?? profile?._id ?? '');

  const roleLabel = {
    USER: t('admin.roleUser'),
    PLAYER: t('admin.rolePlayer'),
    SCORER: t('admin.roleScorer'),
    UMPIRE: t('admin.roleUmpire'),
    ADMIN: t('admin.roleAdmin'),
    SUPER_ADMIN: t('admin.roleSuperAdmin'),
  };

  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null); // { kind: 'role' | 'active', user, value }
  const [banner, setBanner] = useState(null);

  // Wait for a pause in typing before asking the server: a search per keystroke would
  // fire a request for every letter of a name.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data, isLoading, isError, error, refetch } = useAdminUsers({ page, search, role: roleFilter });
  const { setRole, setActive } = useUserMutations();
  const items = data?.items ?? [];
  const meta = data?.meta;

  const idOf = (user) => String(user._id ?? user.id);
  const isSelf = (user) => idOf(user) === selfId;

  const onConfirm = async () => {
    if (!pending) return;
    const { kind, user, value } = pending;
    try {
      if (kind === 'role') await setRole.mutateAsync({ id: idOf(user), role: value });
      else await setActive.mutateAsync({ id: idOf(user), active: value });
      setBanner({ tone: 'success', text: t('admin.saved') });
    } catch (err) {
      setBanner({ tone: 'error', text: describeError(err, t('admin.saveFailed')) });
    } finally {
      setPending(null);
    }
  };

  const pendingMessage = () => {
    if (!pending) return '';
    const name = pending.user.name || pending.user.email;
    return pending.kind === 'role'
      ? t('admin.confirmRoleChange', { name, role: roleLabel[pending.value] ?? pending.value })
      : pending.value
        ? t('admin.confirmActivate', { name })
        : t('admin.confirmDeactivate', { name });
  };

  const columns = [
    {
      key: 'user',
      label: t('admin.users'),
      render: (user) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{user.name || '—'}</p>
          <p className="truncate text-2xs text-content-muted">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: t('admin.role'),
      render: (user) => (
        <select
          aria-label={`${t('admin.role')}: ${user.name || user.email}`}
          value={user.role}
          disabled={isSelf(user)}
          onChange={(event) =>
            event.target.value !== user.role &&
            setPending({ kind: 'role', user, value: event.target.value })
          }
          className={`${inputClass} py-1.5 disabled:opacity-60`}
        >
          {/* A role outside the assignable list (such as GUEST) still has to display. */}
          {!ASSIGNABLE_ROLES.includes(user.role) && <option value={user.role}>{user.role}</option>}
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel[role]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'active',
      label: t('admin.status'),
      align: 'center',
      render: (user) => (
        <button
          type="button"
          disabled={isSelf(user)}
          onClick={() => setPending({ kind: 'active', user, value: user.active === false })}
          className={`badge ${user.active === false ? 'badge-completed' : 'bg-win/15 text-win'} disabled:opacity-60`}
          title={user.active === false ? t('admin.activate') : t('admin.deactivate')}
        >
          {user.active === false ? t('admin.inactive') : t('admin.active')}
        </button>
      ),
    },
    {
      key: 'joined',
      label: t('admin.joined'),
      align: 'center',
      render: (user) => (user.createdAt ? formatShortDate(user.createdAt, lang) : '—'),
    },
  ];

  return (
    <>
      <SEO title={t('admin.users')} noIndex />
      <AdminPageHeader title={t('admin.users')} description={t('admin.usersHelp')} />

      {banner && (
        <div
          role="status"
          className={`mb-5 rounded-lg border px-3.5 py-3 text-sm ${
            banner.tone === 'error'
              ? 'border-live/30 bg-live/10 text-live-light'
              : 'border-win/30 bg-win/10 text-win'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={t('admin.searchUsers')}
          aria-label={t('common.search')}
          className={`${inputClass} w-full sm:w-72`}
        />
        <select
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setPage(1);
          }}
          aria-label={t('admin.role')}
          className={inputClass}
        >
          <option value="">{t('admin.allRoles')}</option>
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel[role]}
            </option>
          ))}
        </select>
      </div>

      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          rowKey={idOf}
          empty={isLoading ? t('common.loading') : t('admin.noUsers')}
        />
      )}

      {meta && meta.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
          <button
            type="button"
            disabled={!meta.hasPrev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-pill border border-surface-border px-4 py-2 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
          >
            ← {t('news.newer')}
          </button>
          <span className="tabular text-sm text-content-muted">
            {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!meta.hasNext}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-pill border border-surface-border px-4 py-2 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken disabled:opacity-40"
          >
            {t('news.older')} →
          </button>
        </nav>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={t('admin.confirmTitle')}
        message={pendingMessage()}
        busy={setRole.isPending || setActive.isPending}
        onConfirm={onConfirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

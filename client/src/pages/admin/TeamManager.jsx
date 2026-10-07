import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminTable, { RowAction, PrimaryButton } from '../../components/admin/AdminTable.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import { TextField, NumberField, SelectField, CheckboxField } from '../../components/admin/Field.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import {
  useAdminTeams,
  useAdminSelectors,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from '../../hooks/useAdmin.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Team manager.
 *
 * Scoped to the season chosen in the header — a team belongs to exactly one season,
 * so there is no such thing as editing "Agni Riders" without saying which year.
 *
 * Every numeric field carries `.catch()` on its zod rule. That is deliberate: a
 * number input the admin has not touched yet holds an empty string, and
 * `z.coerce.number()` turns an empty string into NaN, which the schema then rejects
 * with "Expected number, received nan". The form would refuse to submit even with
 * every visible field filled in.
 */

const teamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(80),
  shortName: z.string().trim().min(1, 'Short name is required').max(8),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only')
    .optional()
    .or(z.literal('')),
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #e63946')
    .catch('#1e6fd9'),
  logoUrl: z.string().trim().optional(),
  captainPlayerId: z.string().optional(),
  viceCaptainPlayerId: z.string().optional(),
  // `.catch` keeps an untouched or half-typed field from blocking the whole form.
  order: z.coerce.number().int().min(0).max(99).catch(0),
  active: z.boolean().catch(true),
});

export default function TeamManager() {
  const { t } = useTranslation();

  const { season, identifier } = useActiveSeason();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [banner, setBanner] = useState(null);

  const teamsQuery = useAdminTeams(identifier);
  const selectorsQuery = useAdminSelectors(identifier);

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const teams = teamsQuery.data ?? [];
  const players = selectorsQuery.data?.players ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(teamSchema),
    // Defaults are declared here so the first render already has real values. A
    // form that starts with `undefined` is what produced the NaN errors.
    defaultValues: {
      themeColor: '#1e6fd9',
      order: 0,
      active: true,
      slug: '',
      logoUrl: '',
      captainPlayerId: '',
      viceCaptainPlayerId: '',
    },
  });

  const captainOptions = (teamId) =>
    players
      .filter((player) => String(player.teamId) === String(teamId))
      .map((player) => ({
        value: player._id ?? player.id,
        label: `#${player.jerseyNo} ${player.jerseyName || player.fullName}`,
      }));

  const openCreate = () => {
    setEditing(null);
    setBanner(null);
    reset({
      name: '',
      shortName: '',
      slug: '',
      themeColor: '#1e6fd9',
      logoUrl: '',
      captainPlayerId: '',
      viceCaptainPlayerId: '',
      order: teams.length + 1 || 1,
      active: true,
    });
    setFormOpen(true);
  };

  const openEdit = (team) => {
    setEditing(team);
    setBanner(null);
    reset({
      name: team.name ?? '',
      shortName: team.shortName ?? '',
      slug: team.slug ?? '',
      themeColor: team.themeColor ?? '#1e6fd9',
      logoUrl: team.logoUrl ?? '',
      captainPlayerId: team.captainPlayerId ?? '',
      viceCaptainPlayerId: team.viceCaptainPlayerId ?? '',
      order: team.order ?? 0,
      active: team.active !== false,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values) => {
    setBanner(null);
    if (!season) {
      setBanner({ tone: 'error', text: t('admin.selectSeasonFirst') });
      return;
    }

    const payload = {
      seasonId: season.id,
      name: values.name,
      shortName: values.shortName,
      ...(values.slug ? { slug: values.slug } : {}),
      themeColor: values.themeColor,
      logoUrl: values.logoUrl ?? '',
      // An empty select sends '', which the API would reject as an invalid ObjectId.
      captainPlayerId: values.captainPlayerId || undefined,
      viceCaptainPlayerId: values.viceCaptainPlayerId || undefined,
      order: values.order,
      active: values.active,
    };

    try {
      if (editing) {
        await updateTeam.mutateAsync({ id: editing._id ?? editing.id, payload });
        setBanner({ tone: 'success', text: 'দল আপডেট হয়েছে / Team updated' });
      } else {
        await createTeam.mutateAsync(payload);
        setBanner({ tone: 'success', text: 'দল তৈরি হয়েছে / Team created' });
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? 'সেভ করা যায়নি' });
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      await deleteTeam.mutateAsync(confirmTarget._id ?? confirmTarget.id);
      setBanner({ tone: 'success', text: 'দল মুছে ফেলা হয়েছে / Team deleted' });
      setConfirmTarget(null);
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? 'মুছতে পারা যায়নি' });
      setConfirmTarget(null);
    }
  };

  const columns = [
    {
      key: 'logo',
      label: t('admin.logo'),
      className: 'w-16',
      render: (row) =>
        row.logoUrl ? (
          <img
            src={row.logoUrl}
            alt=""
            width={36}
            height={36}
            loading="lazy"
            className="h-9 w-9 rounded object-contain"
          />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded text-2xs font-bold text-white"
            style={{ backgroundColor: row.themeColor || '#1e6fd9' }}
            aria-hidden="true"
          >
            {row.shortName?.slice(0, 3)}
          </span>
        ),
    },
    {
      key: 'name',
      label: t('admin.teamName'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{row.name}</p>
          <p className="truncate text-2xs text-content-muted">
            {row.shortName} · {row.slug}
          </p>
        </div>
      ),
    },
    {
      key: 'themeColor',
      label: t('admin.themeColor'),
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-4 w-4 rounded border border-surface-border"
            style={{ backgroundColor: row.themeColor }}
            aria-hidden="true"
          />
          <span className="tabular text-2xs text-content-muted">{row.themeColor}</span>
        </span>
      ),
    },
    {
      key: 'squadSize',
      label: t('admin.players'),
      align: 'center',
      render: (row) => <span className="tabular">{toBengaliDigits(row.squadSize ?? 0)}</span>,
    },
    {
      key: 'active',
      label: t('admin.active'),
      align: 'center',
      render: (row) => (
        <span className={`badge ${row.active === false ? 'badge-completed' : 'bg-win/15 text-win'}`}>
          {row.active === false ? t('admin.inactive') : t('admin.active')}
        </span>
      ),
    },
  ];

  if (!season) {
    return (
      <>
        <SEO title={t('admin.teams')} noIndex />
        <AdminPageHeader title={t('admin.teams')} description={t('admin.selectSeasonFirst')} />
      </>
    );
  }

  return (
    <>
      <SEO title={t('admin.teams')} noIndex />

      <AdminPageHeader
        title={t('admin.teams')}
        description={t('admin.teamsHelp')}
        action={<PrimaryButton onClick={openCreate}>+ {t('admin.newTeam')}</PrimaryButton>}
      />

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

      {teamsQuery.isError ? (
        <ErrorState message={teamsQuery.error?.message} onRetry={teamsQuery.refetch} />
      ) : (
        <AdminTable
          columns={columns}
          rows={teams}
          rowKey={(row) => row._id ?? row.id}
          empty={teamsQuery.isLoading ? t('common.loading') : t('admin.noTeams')}
          actions={(row) => (
            <>
              <RowAction onClick={() => openEdit(row)}>{t('common.edit')}</RowAction>
              <Link
                to={`/admin/players?team=${row._id ?? row.id}`}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-light transition hover:bg-brand/10"
              >
                {t('admin.players')}
              </Link>
              <RowAction tone="danger" onClick={() => setConfirmTarget(row)}>
                {t('common.delete')}
              </RowAction>
            </>
          )}
        />
      )}

      {formOpen && (
        <div className="mt-8 card p-5">
          <h2 className="font-display text-base font-bold text-content-primary">
            {editing ? `${t('common.edit')}: ${editing.name}` : t('admin.newTeam')}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                id="name"
                label={t('admin.teamName')}
                required
                error={errors.name?.message}
                {...register('name')}
              />
              <TextField
                id="shortName"
                label={t('admin.shortName')}
                required
                hint="AGN"
                error={errors.shortName?.message}
                {...register('shortName')}
              />
              <TextField
                id="slug"
                label={t('admin.slug')}
                hint={t('admin.teamSlugHint')}
                placeholder="agni-riders"
                error={errors.slug?.message}
                {...register('slug')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                id="themeColor"
                label={t('admin.themeColor')}
                placeholder="#e63946"
                hint={t('admin.themeColorHint')}
                error={errors.themeColor?.message}
                {...register('themeColor')}
              />
              <TextField
                id="logoUrl"
                label={t('admin.logoUrl')}
                hint={t('admin.logoUrlHint')}
                placeholder="/logos/agni-riders.png"
                error={errors.logoUrl?.message}
                {...register('logoUrl')}
              />
              <NumberField
                id="order"
                label={t('admin.displayOrder')}
                error={errors.order?.message}
                {...register('order')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="captainPlayerId"
                label={t('team.captain')}
                placeholder={t('admin.noneSelected')}
                options={editing ? captainOptions(editing._id ?? editing.id) : []}
                hint={editing ? t('admin.captainHint') : t('admin.captainAfterPlayers')}
                disabled={!editing}
                {...register('captainPlayerId')}
              />
              <SelectField
                id="viceCaptainPlayerId"
                label={t('team.viceCaptain')}
                placeholder={t('admin.noneSelected')}
                options={editing ? captainOptions(editing._id ?? editing.id) : []}
                hint={editing ? t('admin.captainHint') : t('admin.captainAfterPlayers')}
                disabled={!editing}
                {...register('viceCaptainPlayerId')}
              />
            </div>

            <CheckboxField id="active" label={t('admin.activeHint')} {...register('active')} />

            <div className="flex flex-wrap gap-3">
              <PrimaryButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('common.save')}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
                className="rounded-pill border border-surface-border px-4 py-2.5 text-sm font-semibold text-content-secondary transition hover:bg-surface-sunken"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={t('admin.deleteTeamTitle')}
        message={t('admin.deleteTeamBody', { team: confirmTarget?.name ?? '' })}
        details={confirmTarget ? <p className="text-content-muted">{t('admin.deleteTeamWarning')}</p> : null}
        busy={deleteTeam.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

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
import { TextField, NumberField, DateTimeField, SelectField, CheckboxField } from '../../components/admin/Field.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useAdminSeasons, useCreateSeason, useUpdateSeason, useDeleteSeason } from '../../hooks/useAdmin.js';
import { toBengaliDigits, formatDate } from '../../utils/format.js';

/**
 * Season manager.
 *
 * The first screen the organizer needs, because everything else hangs off a season.
 * Two details are specific to how SPPL actually runs:
 *
 *   - dates are OPTIONAL. Season 2 has no announced date, and the form must let that
 *     be saved as empty rather than forcing a guess.
 *   - deleting a season cascades to teams, players, matches and balls, so the
 *     confirmation names the counts before the admin commits.
 */

const seasonSchema = z.object({
  seasonNo: z.coerce.number().int().min(1, 'Must be at least 1').max(999),
  year: z.coerce.number().int().min(2020, 'Too far in the past').max(2100),
  nameBn: z.string().trim().min(2, 'Name is required').max(200),
  nameEn: z.string().trim().min(2, 'Name is required').max(200),
  shortName: z.string().trim().min(2, 'Short name is required').max(30),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only')
    .optional()
    .or(z.literal('')),
  status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  venue: z.string().trim().max(200).optional(),
  oversPerInnings: z.coerce.number().int().min(1).max(50),
  playersPerSide: z.coerce.number().int().min(2).max(11),
  winPoints: z.coerce.number().int().min(0).max(10),
  tiePoints: z.coerce.number().int().min(0).max(10),
});

const STATUS_OPTIONS = [
  { value: 'UPCOMING', label: 'আসন্ন / Upcoming' },
  { value: 'ONGOING', label: 'চলমান / Ongoing' },
  { value: 'COMPLETED', label: 'সম্পন্ন / Completed' },
];

/**
 * A `datetime-local` value is `2026-01-09T09:00` — no timezone. The API stores UTC,
 * so the string is converted here rather than sent raw, which would be interpreted
 * against the server's clock.
 */
function localToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** An ISO date back to the `datetime-local` shape the input needs. */
function isoToLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SeasonManager() {
  const { t } = useTranslation();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [banner, setBanner] = useState(null);

  const { data: seasons = [], isLoading, isError, error, refetch } = useAdminSeasons();

  const createSeason = useCreateSeason();
  const updateSeason = useUpdateSeason();
  const deleteSeason = useDeleteSeason();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(seasonSchema) });

  const openCreate = () => {
    setEditing(null);
    setBanner(null);
    reset({
      seasonNo: (seasons[0]?.seasonNo ?? 0) + 1,
      year: new Date().getFullYear() + 1,
      shortName: 'SPPL',
      status: 'UPCOMING',
      oversPerInnings: 10,
      playersPerSide: 9,
      winPoints: 2,
      tiePoints: 1,
    });
    setFormOpen(true);
  };

  const openEdit = (season) => {
    setEditing(season);
    setBanner(null);
    reset({
      seasonNo: season.seasonNo,
      year: season.year,
      nameBn: season.nameBn,
      nameEn: season.nameEn,
      shortName: season.shortName,
      slug: season.slug,
      status: season.status,
      startDate: isoToLocal(season.startDate),
      endDate: isoToLocal(season.endDate),
      venue: season.venue ?? '',
      oversPerInnings: season.matchRules?.oversPerInnings ?? 10,
      playersPerSide: season.matchRules?.playersPerSide ?? 9,
      winPoints: season.pointsSystem?.win ?? 2,
      tiePoints: season.pointsSystem?.tieOrNoResult ?? 1,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values) => {
    setBanner(null);

    const payload = {
      seasonNo: values.seasonNo,
      year: values.year,
      nameBn: values.nameBn,
      nameEn: values.nameEn,
      shortName: values.shortName,
      // An empty slug means "let the server derive it from shortName + number + year".
      ...(values.slug ? { slug: values.slug } : {}),
      status: values.status,
      // Empty stays null. This is what lets Season 2 exist with no date.
      startDate: localToIso(values.startDate),
      endDate: localToIso(values.endDate),
      venue: values.venue ?? '',
      matchRules: {
        oversPerInnings: values.oversPerInnings,
        playersPerSide: values.playersPerSide,
      },
      pointsSystem: {
        win: values.winPoints,
        loss: 0,
        tieOrNoResult: values.tiePoints,
      },
    };

    try {
      if (editing) {
        await updateSeason.mutateAsync({ id: editing._id ?? editing.id, payload });
        setBanner({ tone: 'success', text: 'সিজন আপডেট হয়েছে / Season updated' });
      } else {
        await createSeason.mutateAsync(payload);
        setBanner({ tone: 'success', text: 'সিজন তৈরি হয়েছে / Season created' });
      }
      setFormOpen(false);
      setEditing(null);
      reset({});
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? 'সেভ করা যায়নি' });
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      const result = await deleteSeason.mutateAsync(confirmTarget._id ?? confirmTarget.id);
      setBanner({
        tone: 'success',
        text: `মুছে ফেলা হয়েছে: ${result.teams} দল, ${result.players} খেলোয়াড়, ${result.matches} ম্যাচ`,
      });
      setConfirmTarget(null);
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? 'মুছতে পারা যায়নি' });
      setConfirmTarget(null);
    }
  };

  const columns = [
    {
      key: 'seasonNo',
      label: t('admin.seasonNo'),
      align: 'center',
      className: 'w-16',
      render: (row) => <span className="tabular font-semibold">{toBengaliDigits(row.seasonNo)}</span>,
    },
    {
      key: 'name',
      label: t('admin.seasonName'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-content-primary">{row.nameEn}</p>
          <p className="truncate text-2xs text-content-muted">{row.nameBn}</p>
        </div>
      ),
    },
    {
      key: 'year',
      label: t('admin.year'),
      align: 'center',
      render: (row) => <span className="tabular">{toBengaliDigits(row.year)}</span>,
    },
    {
      key: 'status',
      label: t('admin.status'),
      align: 'center',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'startDate',
      label: t('admin.startDate'),
      render: (row) =>
        row.startDate ? (
          <span className="tabular text-xs">{formatDate(row.startDate, 'bn', { withYear: false })}</span>
        ) : (
          // Deliberately visible, not blank: an admin must be able to see at a
          // glance which season still has no date.
          <span className="text-xs font-medium text-gold-dark">{t('admin.noDate')}</span>
        ),
    },
    {
      key: 'teamCount',
      label: t('admin.teams'),
      align: 'center',
      render: (row) => <span className="tabular">{toBengaliDigits(row.teamCount ?? 0)}</span>,
    },
  ];

  return (
    <>
      <SEO title={t('admin.seasons')} noIndex />

      <AdminPageHeader
        title={t('admin.seasons')}
        description={t('admin.seasonsHelp')}
        showSwitcher={false}
        action={
          <PrimaryButton onClick={openCreate}>
            + {t('admin.newSeason')}
          </PrimaryButton>
        }
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

      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <AdminTable
          columns={columns}
          rows={seasons}
          rowKey={(row) => row._id ?? row.id}
          empty={isLoading ? t('common.loading') : t('admin.noSeasons')}
          actions={(row) => (
            <>
              <RowAction onClick={() => openEdit(row)}>{t('common.edit')}</RowAction>
              <Link
                to={`/admin/teams?season=${row.slug}`}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-light transition hover:bg-brand/10"
              >
                {t('admin.teams')}
              </Link>
              <RowAction tone="danger" onClick={() => setConfirmTarget(row)}>
                {t('common.delete')}
              </RowAction>
            </>
          )}
        />
      )}

      {/* Create / edit form */}
      {formOpen && (
        <div className="mt-8 card p-5">
          <h2 className="font-display text-base font-bold text-content-primary">
            {editing ? `${t('common.edit')}: ${editing.nameEn}` : t('admin.newSeason')}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField
                id="seasonNo"
                label={t('admin.seasonNo')}
                required
                error={errors.seasonNo?.message}
                {...register('seasonNo')}
              />
              <NumberField
                id="year"
                label={t('admin.year')}
                required
                error={errors.year?.message}
                {...register('year')}
              />
              <TextField
                id="shortName"
                label={t('admin.shortName')}
                required
                hint="SPPL"
                error={errors.shortName?.message}
                {...register('shortName')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="nameEn"
                label="Name (English)"
                required
                error={errors.nameEn?.message}
                {...register('nameEn')}
              />
              <TextField
                id="nameBn"
                label="নাম (বাংলা)"
                required
                error={errors.nameBn?.message}
                {...register('nameBn')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                id="slug"
                label={t('admin.slug')}
                hint={t('admin.slugHint')}
                placeholder="sppl-2-2027"
                error={errors.slug?.message}
                {...register('slug')}
              />
              <SelectField
                id="status"
                label={t('admin.status')}
                options={STATUS_OPTIONS}
                {...register('status')}
              />
              <TextField
                id="venue"
                label={t('admin.venue')}
                error={errors.venue?.message}
                {...register('venue')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeField
                id="startDate"
                label={t('admin.startDate')}
                // The hint is the point: an empty date is the correct answer for a
                // season whose schedule has not been announced.
                hint={t('admin.dateOptionalHint')}
                {...register('startDate')}
              />
              <DateTimeField
                id="endDate"
                label={t('admin.endDate')}
                hint={t('admin.dateOptionalHint')}
                {...register('endDate')}
              />
            </div>

            <fieldset className="rounded-lg border border-surface-border p-4">
              <legend className="px-2 text-sm font-semibold text-content-secondary">
                {t('rules.format')}
              </legend>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField
                  id="oversPerInnings"
                  label={t('admin.oversPerInnings')}
                  error={errors.oversPerInnings?.message}
                  {...register('oversPerInnings')}
                />
                <NumberField
                  id="playersPerSide"
                  label={t('admin.playersPerSide')}
                  error={errors.playersPerSide?.message}
                  {...register('playersPerSide')}
                />
                <NumberField
                  id="winPoints"
                  label={t('admin.winPoints')}
                  error={errors.winPoints?.message}
                  {...register('winPoints')}
                />
                <NumberField
                  id="tiePoints"
                  label={t('admin.tiePoints')}
                  error={errors.tiePoints?.message}
                  {...register('tiePoints')}
                />
              </div>
            </fieldset>

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
        title={t('admin.deleteSeasonTitle')}
        message={t('admin.deleteSeasonBody', { season: confirmTarget?.nameEn ?? '' })}
        details={
          confirmTarget ? (
            <ul className="space-y-1">
              <li>
                <strong>{toBengaliDigits(confirmTarget.teamCount ?? 0)}</strong> {t('admin.teams')}
              </li>
              <li className="text-content-muted">{t('admin.deleteSeasonWarning')}</li>
            </ul>
          ) : null
        }
        busy={deleteSeason.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

/** Status pill for a season. */
function StatusBadge({ status }) {
  const styles = {
    UPCOMING: 'bg-gold/15 text-gold-dark',
    ONGOING: 'bg-win/15 text-win',
    COMPLETED: 'bg-content-muted/15 text-content-muted',
  };
  const labels = { UPCOMING: 'আসন্ন', ONGOING: 'চলমান', COMPLETED: 'সম্পন্ন' };

  return <span className={`badge ${styles[status] ?? styles.COMPLETED}`}>{labels[status] ?? status}</span>;
}

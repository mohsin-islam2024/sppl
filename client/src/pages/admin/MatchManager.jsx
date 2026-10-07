import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminTable, { RowAction, PrimaryButton } from '../../components/admin/AdminTable.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import {
  TextField,
  NumberField,
  DateTimeField,
  SelectField,
} from '../../components/admin/Field.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import {
  useAdminMatches,
  useAdminSelectors,
  useCreateMatch,
  useUpdateMatch,
  useDeleteMatch,
} from '../../hooks/useAdmin.js';
import { toBengaliDigits, formatDate } from '../../utils/format.js';

/**
 * Match manager.
 *
 * Every required field carries `.catch()` on its zod rule so a blank input submits a
 * sensible default instead of failing validation. `startAt` is the one exception —
 * a match genuinely needs a date, so it is kept required and the field is prefilled
 * with the next hour when the form opens.
 */

const STAGE_OPTIONS = [
  { value: 'LEAGUE', label: 'লিগ / League' },
  { value: 'SEMI_FINAL', label: 'সেমি-ফাইনাল / Semi-final' },
  { value: 'FINAL', label: 'ফাইনাল / Final' },
];

const STATUS_OPTIONS = [
  { value: 'UPCOMING', label: 'আসন্ন / Upcoming' },
  { value: 'TOSS', label: 'টস / Toss' },
  { value: 'LIVE', label: 'লাইভ / Live' },
  { value: 'INNINGS_BREAK', label: 'ইনিংস বিরতি / Innings break' },
  { value: 'COMPLETED', label: 'সম্পন্ন / Completed' },
  { value: 'ABANDONED', label: 'পরিত্যক্ত / Abandoned' },
];

const matchSchema = z
  .object({
    matchNo: z.coerce.number().int().min(1, 'Must be at least 1').catch(1),
    stage: z.enum(['LEAGUE', 'SEMI_FINAL', 'FINAL']).catch('LEAGUE'),
    teamAId: z.string().min(1, 'Choose the first team'),
    teamBId: z.string().min(1, 'Choose the second team'),
    startAt: z.string().min(1, 'A date and time is required'),
    venue: z.string().trim().max(200).optional().catch(''),
    status: z
      .enum(['UPCOMING', 'TOSS', 'LIVE', 'INNINGS_BREAK', 'COMPLETED', 'ABANDONED'])
      .catch('UPCOMING'),
    streamUrl: z.string().trim().optional().catch(''),
  })
  .refine((values) => values.teamAId !== values.teamBId, {
    message: 'A match cannot be between the same team twice',
    path: ['teamBId'],
  });

function localToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const hasStarted = (match) => match && match.status && match.status !== 'UPCOMING';

export default function MatchManager() {
  const { t } = useTranslation();

  const { season, identifier } = useActiveSeason();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [banner, setBanner] = useState(null);

  const matchesQuery = useAdminMatches(identifier);
  const selectorsQuery = useAdminSelectors(identifier);

  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();

  const matches = matchesQuery.data ?? [];
  const teams = selectorsQuery.data?.teams ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      matchNo: 1,
      stage: 'LEAGUE',
      teamAId: '',
      teamBId: '',
      startAt: '',
      venue: '',
      status: 'UPCOMING',
      streamUrl: '',
    },
  });

  const teamOptions = teams.map((team) => ({ value: team.id, label: team.name }));

  const selectedTeamA = watch('teamAId');
  const teamBOptions = teamOptions.filter((option) => option.value !== selectedTeamA);

  const openCreate = () => {
    setEditing(null);
    setBanner(null);
    const numbered = matches.map((match) => match.matchNo ?? 0);
    const nextNo = numbered.length ? Math.max(...numbered) + 1 : 1;
    reset({
      matchNo: nextNo,
      stage: 'LEAGUE',
      teamAId: '',
      teamBId: '',
      startAt: isoToLocal(new Date(Date.now() + 60 * 60 * 1000)),
      venue: '',
      status: 'UPCOMING',
      streamUrl: '',
    });
    setFormOpen(true);
  };

  const openEdit = (match) => {
    setEditing(match);
    setBanner(null);
    reset({
      matchNo: match.matchNo ?? 1,
      stage: match.stage ?? 'LEAGUE',
      teamAId: String(match.teamAId?._id ?? match.teamAId ?? ''),
      teamBId: String(match.teamBId?._id ?? match.teamBId ?? ''),
      startAt: isoToLocal(match.startAt),
      venue: match.venue ?? '',
      status: match.status ?? 'UPCOMING',
      streamUrl: match.streamUrl ?? '',
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
      matchNo: values.matchNo,
      stage: values.stage,
      teamAId: values.teamAId,
      teamBId: values.teamBId,
      startAt: localToIso(values.startAt),
      venue: values.venue ?? '',
      status: values.status,
      streamUrl: values.streamUrl ?? '',
    };

    try {
      if (editing) {
        await updateMatch.mutateAsync({ id: editing._id ?? editing.id, payload });
        setBanner({ tone: 'success', text: 'ম্যাচ আপডেট হয়েছে / Match updated' });
      } else {
        await createMatch.mutateAsync(payload);
        setBanner({ tone: 'success', text: 'ম্যাচ তৈরি হয়েছে / Match created' });
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
      await deleteMatch.mutateAsync(confirmTarget._id ?? confirmTarget.id);
      setBanner({ tone: 'success', text: 'ম্যাচ মুছে ফেলা হয়েছে / Match deleted' });
      setConfirmTarget(null);
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? 'মুছতে পারা যায়নি' });
      setConfirmTarget(null);
    }
  };

  const columns = [
    {
      key: 'matchNo',
      label: t('admin.matchNo'),
      align: 'center',
      className: 'w-16',
      render: (row) => <span className="tabular font-semibold">{toBengaliDigits(row.matchNo)}</span>,
    },
    {
      key: 'teams',
      label: t('admin.matchup'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content-primary">
            {row.teamAId?.name ?? '—'} <span className="text-content-muted">vs</span>{' '}
            {row.teamBId?.name ?? '—'}
          </p>
          {row.stage !== 'LEAGUE' && (
            <p className="text-2xs text-gold-dark">{row.stage.replace('_', ' ')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'startAt',
      label: t('admin.startDate'),
      render: (row) => (
        <span className="tabular text-xs">
          {formatDate(row.startAt, 'bn', { withYear: false, withTime: true })}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('admin.status'),
      align: 'center',
      render: (row) => <MatchStatusLabel status={row.status} />,
    },
    {
      key: 'venue',
      label: t('admin.venue'),
      render: (row) => (
        <span className="truncate text-xs text-content-muted">{row.venue || '—'}</span>
      ),
    },
  ];

  if (!season) {
    return (
      <>
        <SEO title={t('admin.matches')} noIndex />
        <AdminPageHeader title={t('admin.matches')} description={t('admin.selectSeasonFirst')} />
      </>
    );
  }

  const editingStarted = editing ? hasStarted(editing) : false;

  return (
    <>
      <SEO title={t('admin.matches')} noIndex />

      <AdminPageHeader
        title={t('admin.matches')}
        description={t('admin.matchesHelp')}
        action={
          <PrimaryButton onClick={openCreate} disabled={teams.length < 2}>
            + {t('admin.newMatch')}
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

      {matchesQuery.isError ? (
        <ErrorState message={matchesQuery.error?.message} onRetry={matchesQuery.refetch} />
      ) : teams.length < 2 ? (
        <div className="card p-8 text-center text-sm text-content-muted">
          {t('admin.needTwoTeams')}
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={matches}
          rowKey={(row) => row._id ?? row.id}
          empty={matchesQuery.isLoading ? t('common.loading') : t('admin.noMatches')}
          actions={(row) => (
            <>
              <RowAction onClick={() => openEdit(row)}>{t('common.edit')}</RowAction>
              <RowAction
                tone="danger"
                onClick={() => setConfirmTarget(row)}
                disabled={hasStarted(row)}
                title={hasStarted(row) ? t('admin.cannotDeleteStarted') : undefined}
              >
                {t('common.delete')}
              </RowAction>
            </>
          )}
        />
      )}

      {formOpen && (
        <div className="mt-8 card p-5">
          <h2 className="font-display text-base font-bold text-content-primary">
            {editing
              ? `${t('common.edit')}: ${t('match.matchNo', { number: editing.matchNo })}`
              : t('admin.newMatch')}
          </h2>

          {editingStarted && (
            <p className="mt-3 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-3 text-sm text-content-secondary">
              {t('admin.matchStartedLocked')}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                id="matchNo"
                label={t('admin.matchNo')}
                required
                disabled={editingStarted}
                error={errors.matchNo?.message}
                {...register('matchNo')}
              />
              <SelectField
                id="stage"
                label={t('admin.stage')}
                options={STAGE_OPTIONS}
                {...register('stage')}
              />
              <SelectField
                id="status"
                label={t('admin.status')}
                options={STATUS_OPTIONS}
                {...register('status')}
              />
              <DateTimeField
                id="startAt"
                label={t('admin.startDate')}
                required
                error={errors.startAt?.message}
                {...register('startAt')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="teamAId"
                label={t('admin.teamA')}
                required
                placeholder={t('admin.noneSelected')}
                options={teamOptions}
                disabled={editingStarted}
                error={errors.teamAId?.message}
                {...register('teamAId')}
              />
              <SelectField
                id="teamBId"
                label={t('admin.teamB')}
                required
                placeholder={t('admin.noneSelected')}
                options={teamBOptions}
                disabled={editingStarted}
                error={errors.teamBId?.message}
                {...register('teamBId')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="venue"
                label={t('admin.venue')}
                hint={t('admin.venueHint')}
                {...register('venue')}
              />
              <TextField
                id="streamUrl"
                label={t('admin.streamUrl')}
                hint={t('admin.streamUrlHint')}
                placeholder="[youtube.com](https://youtube.com/watch?v=)"
                {...register('streamUrl')}
              />
            </div>

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
        title={t('admin.deleteMatchTitle')}
        message={t('match.matchNo', { number: confirmTarget?.matchNo ?? '' })}
        details={<p className="text-content-muted">{t('admin.deleteMatchWarning')}</p>}
        busy={deleteMatch.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

function MatchStatusLabel({ status }) {
  const styles = {
    LIVE: 'badge-live',
    TOSS: 'badge-live',
    UPCOMING: 'badge-upcoming',
    INNINGS_BREAK: 'badge-upcoming',
    COMPLETED: 'badge-completed',
    ABANDONED: 'badge-completed',
  };
  const labels = {
    LIVE: 'লাইভ',
    TOSS: 'টস',
    UPCOMING: 'আসন্ন',
    INNINGS_BREAK: 'বিরতি',
    COMPLETED: 'সম্পন্ন',
    ABANDONED: 'পরিত্যক্ত',
  };

  return <span className={styles[status] ?? styles.UPCOMING}>{labels[status] ?? status}</span>;
}

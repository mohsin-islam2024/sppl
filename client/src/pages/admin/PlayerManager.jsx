import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminTable, { RowAction, PrimaryButton } from '../../components/admin/AdminTable.jsx';
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx';
import { TextField, NumberField, SelectField, CheckboxField, FieldShell } from '../../components/admin/Field.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import {
  useAdminPlayers,
  useAdminSelectors,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
} from '../../hooks/useAdmin.js';
import { toBengaliDigits } from '../../utils/format.js';

/**
 * Player manager.
 *
 * The jersey fields are the reason this page exists in the shape it does. Two
 * things the organizer's sheet needs that a generic player form would not have:
 *
 *   - a KIDS size. "4 years" is not an adult S/M/L, and a kids shirt is ordered
 *     from a different chart. The size field accepts both, and flags which is which.
 *   - `jerseyConfirmed`, mirroring the ✅ marks on the sheet. An admin can enter a
 *     squad before the kit is ordered and see at a glance what is still provisional.
 *
 * Jersey numbers are validated unique per team by the API. The form shows only that
 * team's players in the captain selector, and the API's own error is surfaced as-is
 * rather than re-implemented here.
 */

const ADULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const playerSchema = z.object({
  teamId: z.string().min(1, 'Choose a team'),
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  jerseyName: z.string().trim().min(1, 'Jersey name is required').max(20),
  jerseyNo: z.coerce.number().int().min(0, 'Cannot be negative').max(999),
  size: z.string().trim().min(1, 'Size is required'),
  role: z.enum(['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']),
  battingStyle: z.enum(['', 'RIGHT_HAND', 'LEFT_HAND']).optional(),
  bowlingStyle: z.string().optional(),
  ageYears: z.union([z.coerce.number().int().min(0).max(99), z.literal('')]).optional(),
  photoUrl: z.string().trim().optional(),
  isCaptain: z.boolean().default(false),
  isViceCaptain: z.boolean().default(false),
  jerseyConfirmed: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(99).catch(0),
  active: z.boolean().default(true),
});

const ROLE_OPTIONS = [
  { value: 'BATTER', label: 'ব্যাটসম্যান / Batter' },
  { value: 'BOWLER', label: 'বোলার / Bowler' },
  { value: 'ALL_ROUNDER', label: 'অলরাউন্ডার / All-rounder' },
  { value: 'WICKET_KEEPER', label: 'উইকেট কিপার / Wicket keeper' },
];

const BATTING_OPTIONS = [
  { value: 'RIGHT_HAND', label: 'ডানহাতি / Right hand' },
  { value: 'LEFT_HAND', label: 'বাঁহাতি / Left hand' },
];

const BOWLING_OPTIONS = [
  { value: 'RIGHT_ARM_FAST', label: 'ডানহাতি ফাস্ট' },
  { value: 'RIGHT_ARM_MEDIUM', label: 'ডানহাতি মিডিয়াম' },
  { value: 'RIGHT_ARM_OFF_SPIN', label: 'অফ স্পিন' },
  { value: 'RIGHT_ARM_LEG_SPIN', label: 'লেগ স্পিন' },
  { value: 'LEFT_ARM_FAST', label: 'বাঁহাতি ফাস্ট' },
  { value: 'LEFT_ARM_MEDIUM', label: 'বাঁহাতি মিডিয়াম' },
  { value: 'LEFT_ARM_ORTHODOX', label: 'বাঁহাতি অর্থোডক্স' },
  { value: 'LEFT_ARM_CHINAMAN', label: 'চায়নাম্যান' },
];

/** Is this size a kids size? Mirrors the rule the API applies. */
const isKidsSize = (size) => /^\d{1,2}y$/.test(String(size ?? ''));

export default function PlayerManager() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { season, identifier } = useActiveSeason();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [banner, setBanner] = useState(null);

  /** The team filter lives in the URL, so a link to one squad can be shared. */
  const teamFilter = searchParams.get('team') ?? '';
  const setTeamFilter = (value) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set('team', value);
        else next.delete('team');
        return next;
      },
      { replace: true },
    );
  };

  const playersQuery = useAdminPlayers({ season: identifier, team: teamFilter || undefined });
  const selectorsQuery = useAdminSelectors(identifier);

  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const players = playersQuery.data ?? [];
  const teams = selectorsQuery.data?.teams ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(playerSchema) });

  const teamOptions = teams.map((team) => ({
    value: team.id,
    label: `${team.name} (${team.shortName})`,
  }));

  const openCreate = () => {
    setEditing(null);
    setBanner(null);
    reset({
      teamId: teamFilter || teams[0]?.id || '',
      role: 'BATTER',
      size: 'M',
      order: 0,
      active: true,
      jerseyConfirmed: false,
    });
    setFormOpen(true);
  };

  const openEdit = (player) => {
    setEditing(player);
    setBanner(null);
    reset({
      teamId: String(player.teamId?._id ?? player.teamId),
      fullName: player.fullName,
      jerseyName: player.jerseyName,
      jerseyNo: player.jerseyNo,
      size: player.size,
      role: player.role,
      battingStyle: player.battingStyle ?? '',
      bowlingStyle: player.bowlingStyle ?? '',
      ageYears: player.ageYears ?? '',
      photoUrl: player.photoUrl ?? '',
      isCaptain: Boolean(player.isCaptain),
      isViceCaptain: Boolean(player.isViceCaptain),
      jerseyConfirmed: Boolean(player.jerseyConfirmed),
      order: player.order ?? 0,
      active: player.active !== false,
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
      teamId: values.teamId,
      fullName: values.fullName,
      jerseyName: values.jerseyName,
      jerseyNo: values.jerseyNo,
      size: values.size,
      // Sent explicitly so the admin's intent is visible in the record, even though
      // the API derives the same value from the size string.
      isKidsSize: isKidsSize(values.size),
      role: values.role,
      // Empty strings become undefined so the API stores null rather than "".
      battingStyle: values.battingStyle || undefined,
      bowlingStyle: values.bowlingStyle || undefined,
      ageYears: values.ageYears === '' ? undefined : values.ageYears,
      photoUrl: values.photoUrl ?? '',
      isCaptain: values.isCaptain,
      isViceCaptain: values.isViceCaptain,
      jerseyConfirmed: values.jerseyConfirmed,
      order: values.order,
      active: values.active,
    };

    try {
      if (editing) {
        await updatePlayer.mutateAsync({ id: editing._id ?? editing.id, payload });
        setBanner({ tone: 'success', text: 'খেলোয়াড় আপডেট হয়েছে / Player updated' });
      } else {
        await createPlayer.mutateAsync(payload);
        setBanner({ tone: 'success', text: 'খেলোয়াড় যোগ হয়েছে / Player added' });
      }
      setFormOpen(false);
      setEditing(null);
      reset({});
    } catch (err) {
      // The duplicate-jersey error comes straight from the API and names the player
      // already using that number — shown verbatim so the admin knows who to talk to.
      setBanner({ tone: 'error', text: err?.message ?? 'সেভ করা যায়নি' });
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmTarget) return;
    try {
      await deletePlayer.mutateAsync(confirmTarget._id ?? confirmTarget.id);
      setBanner({ tone: 'success', text: 'খেলোয়াড় মুছে ফেলা হয়েছে / Player deleted' });
      setConfirmTarget(null);
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? 'মুছতে পারা যায়নি' });
      setConfirmTarget(null);
    }
  };

  const columns = [
    {
      key: 'jerseyNo',
      label: t('team.jerseyNo'),
      align: 'center',
      className: 'w-16',
      render: (row) => (
        <span className="tabular font-bold text-content-primary">
          {toBengaliDigits(row.jerseyNo)}
        </span>
      ),
    },
    {
      key: 'name',
      label: t('admin.playerName'),
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium text-content-primary">
              {row.jerseyName || row.fullName}
            </p>
            {row.isCaptain && <span className="badge bg-gold/20 text-gold-dark">C</span>}
            {row.isViceCaptain && <span className="badge bg-brand/15 text-brand-light">VC</span>}
          </div>
          {row.fullName && row.fullName !== row.jerseyName && (
            <p className="truncate text-2xs text-content-muted">{row.fullName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'teamId',
      label: t('nav.teams'),
      render: (row) => (
        <span className="truncate text-sm text-content-secondary">
          {row.teamId?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'size',
      label: t('team.size'),
      align: 'center',
      render: (row) => (
        <span className={row.isKidsSize ? 'font-semibold text-gold-dark' : 'text-content-secondary'}>
          {row.isKidsSize
            ? t('team.kidsSize', { size: toBengaliDigits(String(row.size).replace('y', '')) })
            : row.size}
        </span>
      ),
    },
    {
      key: 'jerseyConfirmed',
      label: t('player.jerseyStatus'),
      align: 'center',
      render: (row) => (
        <span className={`badge ${row.jerseyConfirmed ? 'bg-win/15 text-win' : 'badge-completed'}`}>
          {row.jerseyConfirmed ? t('player.confirmed') : t('player.pending')}
        </span>
      ),
    },
  ];

  if (!season) {
    return (
      <>
        <SEO title={t('admin.players')} noIndex />
        <AdminPageHeader title={t('admin.players')} description={t('admin.selectSeasonFirst')} />
      </>
    );
  }

  return (
    <>
      <SEO title={t('admin.players')} noIndex />

      <AdminPageHeader
        title={t('admin.players')}
        description={t('admin.playersHelp')}
        action={
          <PrimaryButton onClick={openCreate} disabled={!teams.length}>
            + {t('admin.newPlayer')}
          </PrimaryButton>
        }
      />

      {/* Team filter */}
      {teams.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <span className="font-medium">{t('nav.teams')}:</span>
            <select
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-medium text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">{t('players.allTeams')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-content-muted">
            {t('players.resultCount', { count: players.length })}
          </span>
        </div>
      )}

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

      {playersQuery.isError ? (
        <ErrorState message={playersQuery.error?.message} onRetry={playersQuery.refetch} />
      ) : !teams.length ? (
        <div className="card p-8 text-center text-sm text-content-muted">
          {t('admin.addTeamFirst')}
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={players}
          rowKey={(row) => row._id ?? row.id}
          empty={playersQuery.isLoading ? t('common.loading') : t('admin.noPlayers')}
          actions={(row) => (
            <>
              <RowAction onClick={() => openEdit(row)}>{t('common.edit')}</RowAction>
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
            {editing
              ? `${t('common.edit')}: ${editing.jerseyName || editing.fullName}`
              : t('admin.newPlayer')}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                id="teamId"
                label={t('nav.teams')}
                required
                options={teamOptions}
                error={errors.teamId?.message}
                {...register('teamId')}
              />
              <TextField
                id="jerseyName"
                label={t('player.jerseyName')}
                required
                hint={t('admin.jerseyNameHint')}
                error={errors.jerseyName?.message}
                {...register('jerseyName')}
              />
              <TextField
                id="fullName"
                label={t('admin.fullName')}
                required
                error={errors.fullName?.message}
                {...register('fullName')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                id="jerseyNo"
                label={t('team.jerseyNo')}
                required
                error={errors.jerseyNo?.message}
                {...register('jerseyNo')}
              />
              <FieldShell
                label={t('team.size')}
                htmlFor="size"
                required
                hint={t('admin.sizeHint')}
                error={errors.size?.message}
              >
                <input
                  id="size"
                  list="sppl-size-options"
                  autoComplete="off"
                  className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  aria-invalid={Boolean(errors.size)}
                  aria-describedby={errors.size ? 'size-error' : undefined}
                  {...register('size')}
                />
                {/* One datalist serving both adult and kids sizes: the organizer's
                    sheet has both in the same column, and typing "4y" must be as
                    easy as picking "M". */}
                <datalist id="sppl-size-options">
                  {ADULT_SIZES.map((size) => (
                    <option key={size} value={size} />
                  ))}
                  {['2y', '4y', '5y', '7y', '8y', '9y', '10y', '11y', '12y'].map((size) => (
                    <option key={size} value={size} />
                  ))}
                </datalist>
              </FieldShell>
              <SelectField
                id="role"
                label={t('admin.role')}
                options={ROLE_OPTIONS}
                {...register('role')}
              />
              <NumberField
                id="order"
                label={t('admin.displayOrder')}
                error={errors.order?.message}
                {...register('order')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                id="battingStyle"
                label={t('admin.battingStyle')}
                placeholder={t('admin.noneSelected')}
                options={BATTING_OPTIONS}
                {...register('battingStyle')}
              />
              <SelectField
                id="bowlingStyle"
                label={t('admin.bowlingStyle')}
                placeholder={t('admin.noneSelected')}
                options={BOWLING_OPTIONS}
                {...register('bowlingStyle')}
              />
              <NumberField
                id="ageYears"
                label={t('admin.ageYears')}
                hint={t('admin.ageHint')}
                error={errors.ageYears?.message}
                {...register('ageYears')}
              />
              <TextField
                id="photoUrl"
                label={t('admin.photoUrl')}
                hint={t('admin.photoUrlHint')}
                {...register('photoUrl')}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CheckboxField
                id="isCaptain"
                label={t('team.captain')}
                {...register('isCaptain')}
              />
              <CheckboxField
                id="isViceCaptain"
                label={t('team.viceCaptain')}
                {...register('isViceCaptain')}
              />
              <CheckboxField
                id="jerseyConfirmed"
                label={t('admin.jerseyConfirmedHint')}
                {...register('jerseyConfirmed')}
              />
              <CheckboxField id="active" label={t('admin.activeHint')} {...register('active')} />
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
        title={t('admin.deletePlayerTitle')}
        message={t('admin.deletePlayerBody', {
          player: confirmTarget?.jerseyName || confirmTarget?.fullName || '',
        })}
        details={<p className="text-content-muted">{t('admin.deletePlayerWarning')}</p>}
        busy={deletePlayer.isPending}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

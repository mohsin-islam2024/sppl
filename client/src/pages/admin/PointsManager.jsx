import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminTable, { PrimaryButton } from '../../components/admin/AdminTable.jsx';
import { ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { usePointsTable } from '../../hooks/usePointsTable.js';
import { useGenerateFinal, useRecalculatePoints } from '../../hooks/useAdminOps.js';
import { formatNrr, toBengaliDigits } from '../../utils/format.js';

/**
 * Points table, admin view.
 *
 * The standings are derived data. They are rebuilt from completed matches after every
 * result, so there is deliberately nothing to type here: a hand-edited table would
 * disagree with the matches behind it the next time one finished.
 *
 * What this page is for is the other case: the matches changed without the scorer's
 * screen being involved (a result corrected in the database, a match deleted), and
 * the stored table is out of date. "Recalculate" rebuilds it from the matches.
 */
export default function PointsManager() {
  const { t } = useTranslation();
  const { season, identifier } = useActiveSeason();
  const [banner, setBanner] = useState(null);

  const { data, isLoading, isError, error, refetch } = usePointsTable({
    season: identifier,
    seasonId: season?.id,
  });
  const recalculate = useRecalculatePoints();
  const generateFinal = useGenerateFinal();
  const [finalDate, setFinalDate] = useState('');
  const [finalVenue, setFinalVenue] = useState('');
  const rows = data?.table ?? [];

  const onRecalculate = async () => {
    setBanner(null);
    try {
      await recalculate.mutateAsync({ season: identifier });
      setBanner({ tone: 'success', text: t('admin.pointsRecalculated') });
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? t('admin.saveFailed') });
    }
  };

  const onCreateFinal = async (event) => {
    event.preventDefault();
    setBanner(null);
    try {
      // The datetime-local value is the admin's own local time; converting here, on
      // their device, stops the server from reading it as UTC and shifting the hour.
      await generateFinal.mutateAsync({
        seasonId: season.id,
        startAt: new Date(finalDate).toISOString(),
        ...(finalVenue.trim() ? { venue: finalVenue.trim() } : {}),
      });
      setBanner({ tone: 'success', text: t('admin.finalCreated') });
      setFinalDate('');
      setFinalVenue('');
    } catch (err) {
      setBanner({ tone: 'error', text: err?.message ?? t('admin.saveFailed') });
    }
  };

  const number = (key) => ({ key, align: 'center', render: (row) => <span className="tabular">{toBengaliDigits(row[key])}</span> });

  const columns = [
    { key: 'position', label: '#', align: 'center', className: 'w-12', render: (row) => <span className="tabular">{toBengaliDigits(row.position)}</span> },
    {
      key: 'team',
      label: t('nav.teams'),
      render: (row) => <span className="font-medium text-content-primary">{row.team?.name ?? '—'}</span>,
    },
    { ...number('played'), label: t('team.matches') },
    { ...number('won'), label: t('team.won') },
    { ...number('lost'), label: t('team.lost') },
    { ...number('tied'), label: t('team.tied') },
    { ...number('noResult'), label: 'NR' },
    {
      key: 'points',
      label: t('team.points'),
      align: 'center',
      render: (row) => <span className="tabular font-bold text-content-primary">{toBengaliDigits(row.points)}</span>,
    },
    {
      key: 'nrr',
      label: t('team.nrr'),
      align: 'center',
      render: (row) => <span className="tabular">{formatNrr(row.nrr)}</span>,
    },
  ];

  if (!season) {
    return (
      <>
        <SEO title={t('admin.points')} noIndex />
        <AdminPageHeader title={t('admin.points')} description={t('admin.selectSeasonFirst')} />
      </>
    );
  }

  return (
    <>
      <SEO title={t('admin.points')} noIndex />
      <AdminPageHeader
        title={t('admin.points')}
        description={t('admin.pointsHelp')}
        action={
          <PrimaryButton onClick={onRecalculate} disabled={recalculate.isPending}>
            {recalculate.isPending ? t('common.loading') : t('admin.recalculate')}
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
          rows={rows}
          rowKey={(row) => String(row.teamId)}
          empty={isLoading ? t('common.loading') : t('admin.noPoints')}
        />
      )}

      <p className="mt-4 text-xs text-content-muted">{t('admin.pointsNote')}</p>

      <form onSubmit={onCreateFinal} className="card mt-8 max-w-2xl space-y-4 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-content-primary">{t('admin.createFinal')}</h2>
          <p className="mt-1 text-sm text-content-muted">{t('admin.createFinalHelp')}</p>
          {data?.progress && (
            <p className="tabular mt-2 text-xs text-content-muted">
              {t('pointsTable.progress', {
                played: data.progress.completedMatches,
                total: data.progress.totalMatches,
              })}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-content-secondary">{t('admin.matchDate')}</span>
            <input
              type="datetime-local"
              required
              value={finalDate}
              onChange={(event) => setFinalDate(event.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-content-secondary">{t('admin.venue')}</span>
            <input
              type="text"
              maxLength={200}
              value={finalVenue}
              onChange={(event) => setFinalVenue(event.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-content-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
        </div>
        <PrimaryButton type="submit" disabled={!finalDate || generateFinal.isPending}>
          {generateFinal.isPending ? t('common.loading') : t('admin.createFinal')}
        </PrimaryButton>
      </form>
    </>
  );
}

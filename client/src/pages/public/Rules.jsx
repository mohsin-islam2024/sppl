import { useTranslation } from 'react-i18next';
import SEO from '../../components/common/SEO.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { TableSkeleton, ErrorState } from '../../components/common/Skeleton.jsx';
import { useActiveSeason } from '../../hooks/useActiveSeason.js';
import { useSeasonRules } from '../../hooks/useSeason.js';
import { formatDate, toBengaliDigits } from '../../utils/format.js';

/**
 * Rules page.
 *
 * The rules are read from the season document, not hard-coded here. Overs, players
 * per side and the points system can all change between seasons, and a page that
 * states last year's rules as fact is worse than no page at all.
 *
 * The season's dates are shown exactly as stored — including when they are absent,
 * which is Season 2's current state.
 */
export default function Rules() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('bn') ? 'bn' : 'en';

  const { season, identifier, isLoading: seasonLoading } = useActiveSeason();
  const { data, isLoading, isError, error, refetch } = useSeasonRules(identifier);

  const rules = data?.matchRules ?? {};
  const points = data?.pointsSystem ?? {};

  const conduct = lang === 'bn' ? rules.conductRulesBn : rules.conductRulesEn;

  return (
    <>
      <SEO title={t('rules.title')} description={t('rules.seoDescription')} path="/rules" />

      <PageHeader
        title={t('rules.title')}
        subtitle={
          season
            ? t('rules.subtitle', { season: `${season.shortName} ${season.seasonNo}` })
            : undefined
        }
      />

      <div className="container-page space-y-8 py-8">
        {isLoading || seasonLoading ? (
          <TableSkeleton rows={6} columns={2} />
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : !data ? (
          <EmptyState variant="noDates" />
        ) : (
          <>
            {/* Schedule */}
            <section className="card p-5">
              <h2 className="font-display text-base font-bold text-content-primary">
                {t('rules.schedule')}
              </h2>
              {season?.startDate && season?.endDate ? (
                <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                  <Field
                    label={t('rules.startDate')}
                    value={formatDate(season.startDate, lang, { withYear: true })}
                  />
                  <Field
                    label={t('rules.endDate')}
                    value={formatDate(season.endDate, lang, { withYear: true })}
                  />
                  <Field label={t('rules.venue')} value={season.venue || '—'} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-content-muted">
                  {t('rules.datesPending', {
                    season: season ? `${season.shortName} ${season.seasonNo}` : '',
                  })}
                </p>
              )}
            </section>

            {/* Format */}
            <section className="card p-5">
              <h2 className="font-display text-base font-bold text-content-primary">
                {t('rules.format')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-content-secondary">
                {rules.oversPerInnings && (
                  <Rule>{t('rules.overs', { count: toBengaliDigits(rules.oversPerInnings) })}</Rule>
                )}
                {rules.playersPerSide && (
                  <Rule>
                    {t('rules.playersPerSide', { count: toBengaliDigits(rules.playersPerSide) })}
                  </Rule>
                )}
                {rules.wideRuns !== undefined && (
                  <Rule>{t('rules.wideRuns', { count: toBengaliDigits(rules.wideRuns) })}</Rule>
                )}
                {rules.noBallRuns !== undefined && (
                  <Rule>{t('rules.noBallRuns', { count: toBengaliDigits(rules.noBallRuns) })}</Rule>
                )}
                {rules.byeRuns && <Rule>{t('rules.byes')}</Rule>}
                {rules.freeHit?.enabled && (
                  <Rule>
                    {rules.freeHit.dismissalRestriction === 'RUN_OUT_ONLY'
                      ? t('rules.freeHitRunOut')
                      : t('rules.freeHit')}
                  </Rule>
                )}
                {rules.superOverOnTie && (
                  <Rule>
                    {rules.sharePointsIfSuperOverTied
                      ? t('rules.superOverShare')
                      : t('rules.superOver')}
                  </Rule>
                )}
              </ul>
            </section>

            {/* Points */}
            <section className="card p-5">
              <h2 className="font-display text-base font-bold text-content-primary">
                {t('rules.pointsSystem')}
              </h2>
              <table className="data-table mt-3">
                <caption className="sr-only">{t('rules.pointsSystem')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('rules.result')}</th>
                    <th scope="col" className="text-center">
                      {t('team.points')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{t('team.won')}</td>
                    <td className="tabular text-center font-bold text-content-primary">
                      {toBengaliDigits(points.win ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>{t('team.lost')}</td>
                    <td className="tabular text-center text-content-primary">
                      {toBengaliDigits(points.loss ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>{t('rules.tieOrNoResult')}</td>
                    <td className="tabular text-center text-content-primary">
                      {toBengaliDigits(points.tieOrNoResult ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Conduct */}
            {conduct?.length > 0 && (
              <section className="card p-5">
                <h2 className="font-display text-base font-bold text-content-primary">
                  {t('rules.conduct')}
                </h2>
                <ol className="mt-3 space-y-2 text-sm text-content-secondary">
                  {conduct.map((rule, index) => (
                    <li key={rule} className="flex gap-3">
                      <span className="tabular shrink-0 font-semibold text-content-muted">
                        {toBengaliDigits(index + 1)}.
                      </span>
                      {rule}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Awards, from the organizer's proposal sheet */}
            <section className="card p-5">
              <h2 className="font-display text-base font-bold text-content-primary">
                {t('rules.awardsTitle')}
              </h2>
              <ul className="mt-3 grid gap-2 text-sm text-content-secondary sm:grid-cols-2">
                {[
                  t('awards.champion'),
                  t('awards.runnerUp'),
                  t('awards.manOfTheMatch'),
                  t('awards.manOfTheTournament'),
                  t('awards.bestBatter'),
                  t('awards.bestBowler'),
                  t('awards.bestFielder'),
                  t('awards.participationMedal'),
                ].map((award) => (
                  <li key={award} className="flex gap-3">
                    <span className="text-gold" aria-hidden="true">
                      🏆
                    </span>
                    {award}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

/** One bullet in the format list. */
function Rule({ children }) {
  return (
    <li className="flex gap-3">
      <span className="text-gold" aria-hidden="true">
        •
      </span>
      {children}
    </li>
  );
}

/** One labelled value in the schedule block. */
function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-surface-border py-1.5 sm:block sm:border-0">
      <dt className="text-content-muted">{label}</dt>
      <dd className="font-medium text-content-primary sm:mt-0.5">{value}</dd>
    </div>
  );
}
